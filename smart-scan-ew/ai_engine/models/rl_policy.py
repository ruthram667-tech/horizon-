"""
Smart Scan EW — RL Policy Network
===================================
Deep Q-Network (DQN) policy for spectrum scanning decisions.
Supports both a native PyTorch DQN implementation and an
SB3-compatible custom feature extractor for GNN embeddings.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
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
# Native PyTorch DQN
# ──────────────────────────────────────────────

class DQNetwork(nn.Module):
    """
    Q-Network for spectrum scanning.
    
    Input: flattened GNN embeddings [N × 32] + one-hot current channel [N]
           Total: N * GNN_OUTPUT_DIM + N
    Output: Q-values for each channel [N]
    """

    def __init__(self, num_channels: int = NUM_CHANNELS, embedding_dim: int = GNN_OUTPUT_DIM):
        super().__init__()
        self.num_channels = num_channels
        self.embedding_dim = embedding_dim
        input_dim = num_channels * embedding_dim + num_channels  # flattened embeddings + one-hot

        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, num_channels),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass returning Q-values for each channel."""
        return self.net(x)


class ReplayBuffer:
    """Experience replay buffer for DQN training."""

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


class DQNAgent:
    """
    Complete DQN agent with epsilon-greedy exploration,
    experience replay, and soft target network updates.
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
    ):
        self.num_channels = num_channels
        self.gamma = gamma
        self.tau = tau
        self.batch_size = batch_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Epsilon schedule
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = (epsilon_start - epsilon_end) / epsilon_decay_steps
        self.steps_done = 0

        # Networks
        self.policy_net = DQNetwork(num_channels, embedding_dim).to(self.device)
        self.target_net = DQNetwork(num_channels, embedding_dim).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()

        # Optimizer
        self.optimizer = torch.optim.Adam(self.policy_net.parameters(), lr=lr)

        # Replay buffer
        self.replay_buffer = ReplayBuffer(buffer_size)

    def select_action(self, state: np.ndarray) -> int:
        """
        Epsilon-greedy action selection.
        
        Args:
            state: Flattened observation vector
            
        Returns:
            Channel index to tune to
        """
        self.steps_done += 1
        self.epsilon = max(self.epsilon_end, self.epsilon - self.epsilon_decay)

        if random.random() < self.epsilon:
            return random.randint(0, self.num_channels - 1)

        with torch.no_grad():
            state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax(dim=1).item()

    def predict(self, state: np.ndarray) -> int:
        """
        Greedy action selection (no exploration). For inference.
        """
        with torch.no_grad():
            state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax(dim=1).item()

    def store_transition(self, state, action, reward, next_state, done):
        """Store a transition in the replay buffer."""
        state_t = torch.tensor(state, dtype=torch.float32)
        next_state_t = torch.tensor(next_state, dtype=torch.float32)
        self.replay_buffer.push(state_t, action, reward, next_state_t, done)

    def train_step(self) -> Optional[float]:
        """
        Sample a batch and perform one gradient step.
        Returns the loss value, or None if buffer is too small.
        """
        if len(self.replay_buffer) < self.batch_size:
            return None

        states, actions, rewards, next_states, dones = self.replay_buffer.sample(self.batch_size)
        states = states.to(self.device)
        actions = actions.to(self.device)
        rewards = rewards.to(self.device)
        next_states = next_states.to(self.device)
        dones = dones.to(self.device)

        # Current Q-values
        q_values = self.policy_net(states).gather(1, actions.unsqueeze(1)).squeeze(1)

        # Target Q-values (Double DQN style)
        with torch.no_grad():
            next_actions = self.policy_net(next_states).argmax(dim=1)
            next_q_values = self.target_net(next_states).gather(1, next_actions.unsqueeze(1)).squeeze(1)
            target_q = rewards + self.gamma * next_q_values * (1 - dones)

        # Huber loss
        loss = F.smooth_l1_loss(q_values, target_q)

        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_net.parameters(), 1.0)
        self.optimizer.step()

        # Soft update target network
        self._soft_update()

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
            'epsilon': self.epsilon,
            'steps_done': self.steps_done,
        }, path)

    def load(self, path: str):
        """Load model weights."""
        checkpoint = torch.load(path, map_location=self.device)
        self.policy_net.load_state_dict(checkpoint['policy_net'])
        self.target_net.load_state_dict(checkpoint['target_net'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])
        self.epsilon = checkpoint.get('epsilon', self.epsilon_end)
        self.steps_done = checkpoint.get('steps_done', 0)


# ──────────────────────────────────────────────
# SB3-Compatible Feature Extractor
# ──────────────────────────────────────────────

try:
    from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
    import gymnasium as gym

    class GNNFeatureExtractor(BaseFeaturesExtractor):
        """
        Custom SB3 feature extractor that can be used with
        the GNN embeddings as part of the observation.
        """

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
