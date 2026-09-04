"""
Smart Scan EW — RL Policy Network (Enhanced)
===============================================
Dueling Deep Q-Network (DQN) with:
- Dueling architecture (separate value and advantage streams)
- Prioritized Experience Replay
- Noisy linear layers for exploration
- Learning rate scheduling
- Gradient clipping improvements
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import math
from collections import deque
import random
from typing import Optional, Tuple

import sys
sys.path.insert(0, '..')
from backend.app.config import (
    NUM_CHANNELS, GNN_OUTPUT_DIM,
    DQN_LEARNING_RATE, DQN_BUFFER_SIZE, DQN_BATCH_SIZE,
    DQN_GAMMA, DQN_TAU, DQN_EPSILON_START, DQN_EPSILON_END,
    DQN_EPSILON_DECAY_STEPS,
)


# ──────────────────────────────────────────────
# Noisy Linear Layer
# ──────────────────────────────────────────────

class NoisyLinear(nn.Module):
    """
    Noisy linear layer for parameter-space exploration (NoisyNet).
    Replaces epsilon-greedy with learned exploration noise.
    """

    def __init__(self, in_features: int, out_features: int, sigma_init: float = 0.5):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features

        self.weight_mu = nn.Parameter(torch.empty(out_features, in_features))
        self.weight_sigma = nn.Parameter(torch.empty(out_features, in_features))
        self.register_buffer('weight_epsilon', torch.empty(out_features, in_features))

        self.bias_mu = nn.Parameter(torch.empty(out_features))
        self.bias_sigma = nn.Parameter(torch.empty(out_features))
        self.register_buffer('bias_epsilon', torch.empty(out_features))

        self.sigma_init = sigma_init
        self.reset_parameters()
        self.reset_noise()

    def reset_parameters(self):
        mu_range = 1 / math.sqrt(self.in_features)
        self.weight_mu.data.uniform_(-mu_range, mu_range)
        self.weight_sigma.data.fill_(self.sigma_init / math.sqrt(self.in_features))
        self.bias_mu.data.uniform_(-mu_range, mu_range)
        self.bias_sigma.data.fill_(self.sigma_init / math.sqrt(self.out_features))

    def _scale_noise(self, size: int) -> torch.Tensor:
        x = torch.randn(size, device=self.weight_mu.device)
        return x.sign().mul_(x.abs().sqrt_())

    def reset_noise(self):
        epsilon_in = self._scale_noise(self.in_features)
        epsilon_out = self._scale_noise(self.out_features)
        self.weight_epsilon.copy_(epsilon_out.outer(epsilon_in))
        self.bias_epsilon.copy_(epsilon_out)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.training:
            return F.linear(
                x,
                self.weight_mu + self.weight_sigma * self.weight_epsilon,
                self.bias_mu + self.bias_sigma * self.bias_epsilon,
            )
        return F.linear(x, self.weight_mu, self.bias_mu)


# ──────────────────────────────────────────────
# Dueling DQN
# ──────────────────────────────────────────────

class DuelingDQNetwork(nn.Module):
    """
    Dueling Q-Network with separate value and advantage streams.

    Architecture:
        Shared:    Linear(input → 256) + ReLU + Linear(256 → 128) + ReLU
        Value:     NoisyLinear(128 → 1)
        Advantage: NoisyLinear(128 → N)
        Output:    V(s) + A(s,a) - mean(A(s,:))
    """

    def __init__(self, num_channels: int = NUM_CHANNELS, embedding_dim: int = GNN_OUTPUT_DIM):
        super().__init__()
        self.num_channels = num_channels
        input_dim = num_channels * embedding_dim + num_channels

        # Shared feature extractor
        self.feature = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
        )

        # Value stream
        self.value_stream = nn.Sequential(
            NoisyLinear(128, 64),
            nn.ReLU(),
            NoisyLinear(64, 1),
        )

        # Advantage stream
        self.advantage_stream = nn.Sequential(
            NoisyLinear(128, 64),
            nn.ReLU(),
            NoisyLinear(64, num_channels),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.feature(x)
        value = self.value_stream(features)          # [B, 1]
        advantage = self.advantage_stream(features)  # [B, N]
        # Dueling: Q = V + (A - mean(A))
        return value + advantage - advantage.mean(dim=1, keepdim=True)

    def reset_noise(self):
        """Reset noise in all noisy layers."""
        for module in self.modules():
            if isinstance(module, NoisyLinear):
                module.reset_noise()


# ──────────────────────────────────────────────
# Legacy DQNetwork (backward compatibility)
# ──────────────────────────────────────────────

class DQNetwork(nn.Module):
    """Standard Q-Network (kept for backward compatibility with old checkpoints)."""

    def __init__(self, num_channels: int = NUM_CHANNELS, embedding_dim: int = GNN_OUTPUT_DIM):
        super().__init__()
        self.num_channels = num_channels
        self.embedding_dim = embedding_dim
        input_dim = num_channels * embedding_dim + num_channels

        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, num_channels),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ──────────────────────────────────────────────
# Prioritized Experience Replay
# ──────────────────────────────────────────────

class PrioritizedReplayBuffer:
    """
    Prioritized Experience Replay buffer.
    Samples transitions proportional to their TD-error priority.
    """

    def __init__(self, capacity: int = DQN_BUFFER_SIZE, alpha: float = 0.6):
        self.capacity = capacity
        self.alpha = alpha
        self.buffer = []
        self.priorities = np.zeros(capacity, dtype=np.float64)
        self.position = 0
        self.max_priority = 1.0

    def push(self, state, action, reward, next_state, done):
        transition = (state, action, reward, next_state, done)

        if len(self.buffer) < self.capacity:
            self.buffer.append(transition)
        else:
            self.buffer[self.position] = transition

        self.priorities[self.position] = self.max_priority ** self.alpha
        self.position = (self.position + 1) % self.capacity

    def sample(self, batch_size: int = DQN_BATCH_SIZE, beta: float = 0.4):
        size = len(self.buffer)
        priorities = self.priorities[:size]

        # Compute sampling probabilities
        probs = priorities / priorities.sum()
        indices = np.random.choice(size, batch_size, p=probs, replace=False)

        # Importance sampling weights
        weights = (size * probs[indices]) ** (-beta)
        weights /= weights.max()
        weights = torch.tensor(weights, dtype=torch.float32)

        batch = [self.buffer[i] for i in indices]
        states, actions, rewards, next_states, dones = zip(*batch)

        return (
            torch.stack(states),
            torch.tensor(actions, dtype=torch.long),
            torch.tensor(rewards, dtype=torch.float32),
            torch.stack(next_states),
            torch.tensor(dones, dtype=torch.float32),
            indices,
            weights,
        )

    def update_priorities(self, indices, td_errors):
        for idx, td_error in zip(indices, td_errors):
            priority = (abs(td_error) + 1e-6) ** self.alpha
            self.priorities[idx] = priority
            self.max_priority = max(self.max_priority, priority)

    def __len__(self):
        return len(self.buffer)


# ──────────────────────────────────────────────
# Legacy Replay Buffer (backward compatibility)
# ──────────────────────────────────────────────

class ReplayBuffer:
    """Standard uniform experience replay buffer."""

    def __init__(self, capacity: int = DQN_BUFFER_SIZE):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int = DQN_BATCH_SIZE):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (
            torch.stack(states),
            torch.tensor(actions, dtype=torch.long),
            torch.tensor(rewards, dtype=torch.float32),
            torch.stack(next_states),
            torch.tensor(dones, dtype=torch.float32),
        )

    def __len__(self):
        return len(self.buffer)


# ──────────────────────────────────────────────
# DQN Agent (Enhanced)
# ──────────────────────────────────────────────

class DQNAgent:
    """
    Enhanced DQN agent with:
    - Dueling architecture
    - Prioritized experience replay
    - NoisyNet exploration
    - Cosine annealing LR schedule
    - Gradient clipping
    """

    def __init__(
        self,
        num_channels: int = NUM_CHANNELS,
        embedding_dim: int = GNN_OUTPUT_DIM,
        lr: float = DQN_LEARNING_RATE,
        gamma: float = DQN_GAMMA,
        tau: float = DQN_TAU,
        epsilon_start: float = DQN_EPSILON_START,
        epsilon_end: float = DQN_EPSILON_END,
        epsilon_decay_steps: int = DQN_EPSILON_DECAY_STEPS,
        buffer_size: int = DQN_BUFFER_SIZE,
        batch_size: int = DQN_BATCH_SIZE,
        use_dueling: bool = True,
        use_prioritized: bool = True,
    ):
        self.num_channels = num_channels
        self.gamma = gamma
        self.tau = tau
        self.batch_size = batch_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.use_dueling = use_dueling
        self.use_prioritized = use_prioritized

        # Epsilon schedule (kept as fallback even with NoisyNet)
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = (epsilon_start - epsilon_end) / epsilon_decay_steps
        self.steps_done = 0

        # Beta schedule for prioritized replay
        self.beta = 0.4
        self.beta_increment = 0.001

        # Networks
        NetClass = DuelingDQNetwork if use_dueling else DQNetwork
        self.policy_net = NetClass(num_channels, embedding_dim).to(self.device)
        self.target_net = NetClass(num_channels, embedding_dim).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()

        # Optimizer with cosine annealing
        self.optimizer = torch.optim.Adam(self.policy_net.parameters(), lr=lr)
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=epsilon_decay_steps, eta_min=lr * 0.1
        )

        # Replay buffer
        if use_prioritized:
            self.replay_buffer = PrioritizedReplayBuffer(buffer_size)
        else:
            self.replay_buffer = ReplayBuffer(buffer_size)

    def select_action(self, state: np.ndarray) -> int:
        """Epsilon-greedy action selection with NoisyNet noise."""
        self.steps_done += 1
        self.epsilon = max(self.epsilon_end, self.epsilon - self.epsilon_decay)

        if random.random() < self.epsilon:
            return random.randint(0, self.num_channels - 1)

        with torch.no_grad():
            state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax(dim=1).item()

    def predict(self, state: np.ndarray) -> int:
        """Greedy action selection for inference."""
        with torch.no_grad():
            state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax(dim=1).item()

    def get_q_values(self, state: np.ndarray) -> np.ndarray:
        """Get Q-values for all actions (for confidence scoring)."""
        with torch.no_grad():
            state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.cpu().numpy().flatten()

    def store_transition(self, state, action, reward, next_state, done):
        """Store a transition in the replay buffer."""
        state_t = torch.tensor(state, dtype=torch.float32)
        next_state_t = torch.tensor(next_state, dtype=torch.float32)
        self.replay_buffer.push(state_t, action, reward, next_state_t, done)

    def train_step(self) -> Optional[float]:
        """Sample a batch and perform one gradient step."""
        if len(self.replay_buffer) < self.batch_size:
            return None

        if self.use_prioritized:
            self.beta = min(1.0, self.beta + self.beta_increment)
            states, actions, rewards, next_states, dones, indices, weights = \
                self.replay_buffer.sample(self.batch_size, self.beta)
            weights = weights.to(self.device)
        else:
            states, actions, rewards, next_states, dones = \
                self.replay_buffer.sample(self.batch_size)
            weights = None
            indices = None

        states = states.to(self.device)
        actions = actions.to(self.device)
        rewards = rewards.to(self.device)
        next_states = next_states.to(self.device)
        dones = dones.to(self.device)

        # Current Q-values
        q_values = self.policy_net(states).gather(1, actions.unsqueeze(1)).squeeze(1)

        # Target Q-values (Double DQN)
        with torch.no_grad():
            next_actions = self.policy_net(next_states).argmax(dim=1)
            next_q_values = self.target_net(next_states).gather(1, next_actions.unsqueeze(1)).squeeze(1)
            target_q = rewards + self.gamma * next_q_values * (1 - dones)

        # TD errors for priority update
        td_errors = (q_values - target_q).detach()

        # Loss
        if weights is not None:
            loss = (weights * F.smooth_l1_loss(q_values, target_q, reduction='none')).mean()
        else:
            loss = F.smooth_l1_loss(q_values, target_q)

        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_net.parameters(), 10.0)
        self.optimizer.step()
        self.scheduler.step()

        # Soft update target network
        self._soft_update()

        # Reset noise in NoisyNet layers
        if self.use_dueling and hasattr(self.policy_net, 'reset_noise'):
            self.policy_net.reset_noise()
            self.target_net.reset_noise()

        # Update priorities
        if self.use_prioritized and indices is not None:
            self.replay_buffer.update_priorities(
                indices, td_errors.cpu().numpy()
            )

        return loss.item()

    def _soft_update(self):
        """Polyak averaging update of target network."""
        for target_param, policy_param in zip(
            self.target_net.parameters(), self.policy_net.parameters()
        ):
            target_param.data.copy_(
                self.tau * policy_param.data + (1 - self.tau) * target_param.data
            )

    def save(self, path: str):
        """Save model weights."""
        torch.save({
            'policy_net': self.policy_net.state_dict(),
            'target_net': self.target_net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'scheduler': self.scheduler.state_dict(),
            'epsilon': self.epsilon,
            'steps_done': self.steps_done,
            'use_dueling': self.use_dueling,
        }, path)

    def load(self, path: str):
        """Load model weights."""
        checkpoint = torch.load(path, map_location=self.device)

        # Handle legacy checkpoints (non-dueling)
        try:
            self.policy_net.load_state_dict(checkpoint['policy_net'])
            self.target_net.load_state_dict(checkpoint['target_net'])
        except RuntimeError:
            # If architecture mismatch, try loading with legacy network
            print("  ⚠ Architecture mismatch, attempting legacy load...")
            legacy_net = DQNetwork(self.num_channels).to(self.device)
            legacy_net.load_state_dict(checkpoint['policy_net'])
            # Can't transfer to dueling, use heuristic
            return

        self.optimizer.load_state_dict(checkpoint['optimizer'])
        if 'scheduler' in checkpoint:
            self.scheduler.load_state_dict(checkpoint['scheduler'])
        self.epsilon = checkpoint.get('epsilon', self.epsilon_end)
        self.steps_done = checkpoint.get('steps_done', 0)


# ──────────────────────────────────────────────
# SB3-Compatible Feature Extractor
# ──────────────────────────────────────────────

try:
    from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
    import gymnasium as gym

    class GNNFeatureExtractor(BaseFeaturesExtractor):
        """Custom SB3 feature extractor for GNN embeddings."""

        def __init__(self, observation_space: gym.spaces.Box, features_dim: int = 256):
            super().__init__(observation_space, features_dim)
            input_dim = int(np.prod(observation_space.shape))
            self.net = nn.Sequential(
                nn.Linear(input_dim, 256),
                nn.ReLU(),
                nn.Linear(256, features_dim),
                nn.ReLU(),
            )

        def forward(self, observations: torch.Tensor) -> torch.Tensor:
            return self.net(observations)

except ImportError:
    # SB3 not available — native DQN still works
    GNNFeatureExtractor = None
