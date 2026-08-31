"""
Smart Scan EW — Custom Gymnasium Environment
==============================================
SpectrumScanEnv: A Gymnasium-compatible environment that simulates
the RF scanning problem. The agent decides which channel to tune to,
and receives rewards based on intercept success, misses, and switching cost.

State: Concatenation of GNN node embeddings + one-hot current channel position.
Action: Discrete channel index to tune to.
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Optional, Tuple, Dict, Any

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from app.config import (
    NUM_CHANNELS, GNN_OUTPUT_DIM, EPISODE_LENGTH,
    REWARD_INTERCEPT_HIT, REWARD_EMPTY_SCAN,
    REWARD_MISSED_ACTIVE, SWITCHING_PENALTY_ALPHA,
    DETECTION_THRESHOLD_DBM,
)
from dsp.rf_simulator import RFSimulator

# Conditionally import GNN — fall back to random embeddings if unavailable
try:
    from ai_engine.models.gnn_embedder import GNNEmbedder, build_graph
    import torch
    HAS_GNN = True
except ImportError:
    HAS_GNN = False


class SpectrumScanEnv(gym.Env):
    """
    Custom Gymnasium environment for RF spectrum scanning.
    
    The agent controls a receiver tuner that can listen on one channel
    at a time. FHSS emitters hop across channels, and the agent must
    intercept (tune to) active channels to score hits.
    
    Observation Space:
        Concatenation of:
        - GNN node embeddings: [N × embedding_dim] flattened
        - One-hot current channel: [N]
        Total dimension: N * embedding_dim + N
        
    Action Space:
        Discrete(N) — index of target channel to tune to
        
    Reward:
        +10.0  — intercept hit (tuned to active channel)
        -1.0   — empty/noise scan (tuned to inactive channel)
        -5.0   — per missed active channel (active but not tuned)
        -α|Δf| — switching penalty proportional to frequency distance
    """

    metadata = {"render_modes": ["human", "ansi"]}

    def __init__(
        self,
        num_channels: int = NUM_CHANNELS,
        num_emitters: int = 2,
        embedding_dim: int = GNN_OUTPUT_DIM,
        episode_length: int = EPISODE_LENGTH,
        use_gnn: bool = True,
        render_mode: Optional[str] = None,
    ):
        super().__init__()
        self.num_channels = num_channels
        self.num_emitters = num_emitters
        self.embedding_dim = embedding_dim
        self.episode_length = episode_length
        self.use_gnn = use_gnn and HAS_GNN
        self.render_mode = render_mode

        # Observation: flattened GNN embeddings + one-hot channel position
        obs_dim = num_channels * embedding_dim + num_channels
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
        )

        # Action: which channel to tune to
        self.action_space = spaces.Discrete(num_channels)

        # Internal state
        self.simulator: Optional[RFSimulator] = None
        self.current_channel: int = 0
        self.step_count: int = 0

        # GNN model (shared across episodes)
        if self.use_gnn:
            self.gnn_model = GNNEmbedder()
            self.gnn_model.eval()
        else:
            self.gnn_model = None

        # Per-channel statistics for node features
        self._channel_visit_counts = np.zeros(num_channels, dtype=np.float64)
        self._channel_hit_counts = np.zeros(num_channels, dtype=np.float64)
        self._channel_last_visit = np.zeros(num_channels, dtype=np.float64)
        self._latest_powers = np.full(num_channels, -90.0)

        # Episode metrics
        self.total_hits: int = 0
        self.total_misses: int = 0
        self.total_active: int = 0
        self.total_false_alarms: int = 0
        self.episode_reward: float = 0.0

    def reset(
        self, seed: Optional[int] = None, options: Optional[Dict] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reset the environment for a new episode."""
        super().reset(seed=seed)

        self.simulator = RFSimulator(
            num_channels=self.num_channels,
            num_emitters=self.num_emitters,
            seed=seed,
        )
        self.current_channel = self.np_random.integers(0, self.num_channels)
        self.step_count = 0

        # Reset statistics
        self._channel_visit_counts = np.zeros(self.num_channels, dtype=np.float64)
        self._channel_hit_counts = np.zeros(self.num_channels, dtype=np.float64)
        self._channel_last_visit = np.zeros(self.num_channels, dtype=np.float64)
        self._latest_powers = np.full(self.num_channels, -90.0)

        self.total_hits = 0
        self.total_misses = 0
        self.total_active = 0
        self.total_false_alarms = 0
        self.episode_reward = 0.0

        # Generate initial observation
        obs = self._get_observation()
        info = self._get_info()

        return obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """
        Execute one step: tune to `action` channel, advance simulator, compute reward.
        """
        assert self.action_space.contains(action), f"Invalid action {action}"

        prev_channel = self.current_channel
        self.current_channel = action
        self.step_count += 1

        # Advance the RF simulator
        channel_powers, active_channels = self.simulator.step()
        self._latest_powers = channel_powers

        # Update visit statistics
        self._channel_visit_counts[action] += 1
        self._channel_last_visit[action] = float(self.step_count)

        # Determine hit/miss
        is_hit = action in active_channels

        if is_hit:
            self.total_hits += 1
            self._channel_hit_counts[action] += 1

        # Count missed active channels
        missed = [ch for ch in active_channels if ch != action]
        self.total_misses += len(missed)
        self.total_active += len(active_channels)

        # ── Compute Reward ──
        reward = 0.0

        # Intercept hit
        if is_hit:
            reward += REWARD_INTERCEPT_HIT

        # Empty scan (tuned to noise)
        if not is_hit:
            reward += REWARD_EMPTY_SCAN

        # Missed active channels
        reward += REWARD_MISSED_ACTIVE * len(missed)

        # Switching penalty
        switching_cost = SWITCHING_PENALTY_ALPHA * abs(action - prev_channel)
        reward -= switching_cost

        self.episode_reward += reward

        # ── Episode Termination ──
        terminated = False
        truncated = self.step_count >= self.episode_length

        # Generate next observation
        obs = self._get_observation()
        info = self._get_info()
        info["is_hit"] = is_hit
        info["active_channels"] = list(active_channels)
        info["channel_powers"] = channel_powers.tolist()

        return obs, reward, terminated, truncated, info

    def _get_observation(self) -> np.ndarray:
        """
        Build observation vector:
        [flattened GNN embeddings (N*32)] + [one-hot current channel (N)]
        """
        # Build node features [N, 4]
        node_features = self._build_node_features()

        # Get GNN embeddings
        if self.use_gnn and self.gnn_model is not None:
            # Build graph and run GNN
            observed_transitions = None
            if self.simulator is not None:
                observed_transitions = self.simulator.get_all_observed_transitions()

            graph = build_graph(node_features, self.num_channels, observed_transitions)

            with torch.no_grad():
                embeddings = self.gnn_model(graph)  # [N, 32]
                embeddings_flat = embeddings.cpu().numpy().flatten()
        else:
            # Fallback: use raw node features padded to embedding_dim
            embeddings_flat = np.zeros(
                self.num_channels * self.embedding_dim, dtype=np.float32
            )
            # Place node features in first 4 dims of each channel's embedding
            for i in range(self.num_channels):
                start = i * self.embedding_dim
                embeddings_flat[start:start + 4] = node_features[i]

        # One-hot current channel
        one_hot = np.zeros(self.num_channels, dtype=np.float32)
        one_hot[self.current_channel] = 1.0

        obs = np.concatenate([embeddings_flat, one_hot]).astype(np.float32)
        return obs

    def _build_node_features(self) -> np.ndarray:
        """Build [N, 4] node feature matrix."""
        features = np.zeros((self.num_channels, 4), dtype=np.float32)

        for i in range(self.num_channels):
            # RSSI normalized to [0, 1]
            rssi_norm = (self._latest_powers[i] - (-90.0)) / 80.0
            features[i, 0] = np.clip(rssi_norm, 0.0, 1.0)

            # Dwell time since last visit (normalized, capped at episode_length)
            if self._channel_last_visit[i] > 0:
                dwell = min(self.step_count - self._channel_last_visit[i], 100.0) / 100.0
            else:
                dwell = 1.0
            features[i, 1] = dwell

            # Duty cycle
            total = max(self.step_count, 1)
            features[i, 2] = self._channel_visit_counts[i] / total

            # Detection probability
            visits = self._channel_visit_counts[i]
            features[i, 3] = self._channel_hit_counts[i] / visits if visits > 0 else 0.0

        return features

    def _get_info(self) -> Dict[str, Any]:
        """Return info dict with current metrics."""
        pd = self.total_hits / max(self.total_active, 1)
        total_scans = max(self.step_count, 1)
        pfa = self.total_false_alarms / total_scans

        return {
            "step": self.step_count,
            "pd": round(pd, 4),
            "pfa": round(pfa, 4),
            "total_hits": self.total_hits,
            "total_misses": self.total_misses,
            "episode_reward": round(self.episode_reward, 2),
            "epsilon": 0.0,  # Filled by agent
        }

    def render(self):
        """Render current state to console."""
        if self.render_mode == "ansi":
            powers = self._latest_powers
            bar_width = 40
            lines = [f"\n{'='*60}", f"  Step {self.step_count} | Tuned: Ch{self.current_channel}"]
            for i in range(self.num_channels):
                power_norm = (powers[i] - (-90.0)) / 80.0
                bar_len = int(power_norm * bar_width)
                marker = ""
                if i == self.current_channel:
                    marker = " ◄ TUNED"
                lines.append(f"  Ch{i:2d} [{powers[i]:6.1f}dBm] {'█' * bar_len}{'░' * (bar_width - bar_len)}{marker}")
            lines.append(f"  Pd={self._get_info()['pd']:.3f}  Hits={self.total_hits}  Reward={self.episode_reward:.1f}")
            return "\n".join(lines)
