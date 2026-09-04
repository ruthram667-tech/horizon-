"""
Smart Scan EW — Custom Gymnasium Environment (Enhanced)
=========================================================
SpectrumScanEnv with:
- Shaped reward function (proximity bonus, exploration bonus)
- Observation normalization (running mean/std)
- Multi-emitter scaling (dynamic difficulty)
- Curriculum learning support

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

# Conditionally import GNN
try:
    from ai_engine.models.gnn_embedder import GNNEmbedder, build_graph
    import torch
    HAS_GNN = True
except ImportError:
    HAS_GNN = False


class RunningStats:
    """Welford's online algorithm for running mean and variance."""

    def __init__(self, shape):
        self.n = 0
        self.mean = np.zeros(shape, dtype=np.float64)
        self.M2 = np.zeros(shape, dtype=np.float64)

    def update(self, x):
        self.n += 1
        delta = x - self.mean
        self.mean += delta / self.n
        delta2 = x - self.mean
        self.M2 += delta * delta2

    @property
    def std(self):
        if self.n < 2:
            return np.ones_like(self.mean)
        return np.sqrt(self.M2 / (self.n - 1)) + 1e-8

    def normalize(self, x):
        return (x - self.mean) / self.std


class SpectrumScanEnv(gym.Env):
    """
    Enhanced Gymnasium environment for RF spectrum scanning.

    Improvements:
    - Shaped reward: proximity bonus for near-hits, exploration bonus
    - Observation normalization for stable training
    - Curriculum learning: start easy, increase difficulty
    - Dynamic emitter count changes mid-episode
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
        # Curriculum learning
        curriculum: bool = False,
        min_emitters: int = 1,
        max_emitters: int = 3,
        # Observation normalization
        normalize_obs: bool = True,
    ):
        super().__init__()
        self.num_channels = num_channels
        self.num_emitters = num_emitters
        self.embedding_dim = embedding_dim
        self.episode_length = episode_length
        self.use_gnn = use_gnn and HAS_GNN
        self.render_mode = render_mode

        # Curriculum settings
        self.curriculum = curriculum
        self.min_emitters = min_emitters
        self.max_emitters = max_emitters
        self.curriculum_episode = 0
        self.curriculum_phase = 0  # 0=easy, 1=medium, 2=hard

        # Observation normalization
        self.normalize_obs_flag = normalize_obs
        obs_dim = num_channels * embedding_dim + num_channels
        self.obs_stats = RunningStats(obs_dim)

        # Observation space
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
        )

        # Action space
        self.action_space = spaces.Discrete(num_channels)

        # Internal state
        self.simulator: Optional[RFSimulator] = None
        self.current_channel: int = 0
        self.step_count: int = 0

        # GNN model
        if self.use_gnn:
            self.gnn_model = GNNEmbedder()
            self.gnn_model.eval()
        else:
            self.gnn_model = None

        # Per-channel statistics
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
        self._consecutive_misses: int = 0
        self._last_hit_step: int = 0

    def _get_curriculum_emitters(self) -> int:
        """Determine emitter count based on curriculum phase."""
        if not self.curriculum:
            return self.num_emitters

        # Phase transitions: easy → medium → hard
        if self.curriculum_episode < 50:
            return self.min_emitters
        elif self.curriculum_episode < 150:
            return min(self.min_emitters + 1, self.max_emitters)
        else:
            return self.max_emitters

    def reset(
        self, seed: Optional[int] = None, options: Optional[Dict] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reset the environment for a new episode."""
        super().reset(seed=seed)

        # Curriculum: update emitter count
        n_emitters = self._get_curriculum_emitters()
        self.curriculum_episode += 1

        self.simulator = RFSimulator(
            num_channels=self.num_channels,
            num_emitters=n_emitters,
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
        self._consecutive_misses = 0
        self._last_hit_step = 0

        obs = self._get_observation()
        info = self._get_info()

        return obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Execute one step with enhanced shaped reward."""
        assert self.action_space.contains(action), f"Invalid action {action}"

        prev_channel = self.current_channel
        self.current_channel = action
        self.step_count += 1

        # Advance RF simulator
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
            self._consecutive_misses = 0
            self._last_hit_step = self.step_count
        else:
            self._consecutive_misses += 1

        # Count missed active channels
        missed = [ch for ch in active_channels if ch != action]
        self.total_misses += len(missed)
        self.total_active += len(active_channels)

        # ── Enhanced Shaped Reward ──
        reward = self._compute_shaped_reward(
            action, prev_channel, is_hit, active_channels, missed, channel_powers
        )

        self.episode_reward += reward

        # Episode termination
        terminated = False
        truncated = self.step_count >= self.episode_length

        # Observation
        obs = self._get_observation()
        info = self._get_info()
        info["is_hit"] = is_hit
        info["active_channels"] = list(active_channels)
        info["channel_powers"] = channel_powers.tolist()

        return obs, reward, terminated, truncated, info

    def _compute_shaped_reward(
        self, action, prev_channel, is_hit, active_channels, missed, channel_powers
    ) -> float:
        """
        Enhanced multi-component shaped reward function.

        Components:
        1. Intercept hit/miss base reward
        2. Proximity bonus for near-hits
        3. Exploration bonus for visiting unvisited channels
        4. Switching penalty
        5. Consecutive miss penalty (escalating)
        """
        reward = 0.0

        # 1. Base intercept reward
        if is_hit:
            reward += REWARD_INTERCEPT_HIT
        else:
            reward += REWARD_EMPTY_SCAN

        # 2. Proximity bonus: partial reward for being close to active channel
        if not is_hit and len(active_channels) > 0:
            min_dist = min(abs(action - ch) for ch in active_channels)
            if min_dist == 1:
                reward += 2.0   # Adjacent to active — good signal
            elif min_dist == 2:
                reward += 0.5   # Two away — warm

        # 3. Missed active channels penalty
        reward += REWARD_MISSED_ACTIVE * len(missed)

        # 4. Switching penalty (proportional to distance)
        switching_cost = SWITCHING_PENALTY_ALPHA * abs(action - prev_channel)
        reward -= switching_cost

        # 5. Exploration bonus: reward visiting least-visited channels
        total_visits = max(self.step_count, 1)
        visit_ratio = self._channel_visit_counts[action] / total_visits
        if visit_ratio < 1.0 / self.num_channels:
            reward += 0.3  # Bonus for exploring under-visited channels

        # 6. Escalating penalty for consecutive misses
        if self._consecutive_misses > 5:
            reward -= 0.5 * (self._consecutive_misses - 5)

        return reward

    def _get_observation(self) -> np.ndarray:
        """Build observation vector with optional normalization."""
        node_features = self._build_node_features()

        # Get GNN embeddings
        if self.use_gnn and self.gnn_model is not None:
            observed_transitions = None
            if self.simulator is not None:
                observed_transitions = self.simulator.get_all_observed_transitions()

            graph = build_graph(node_features, self.num_channels, observed_transitions)

            with torch.no_grad():
                embeddings = self.gnn_model(graph)
                embeddings_flat = embeddings.cpu().numpy().flatten()
        else:
            embeddings_flat = np.zeros(
                self.num_channels * self.embedding_dim, dtype=np.float32
            )
            for i in range(self.num_channels):
                start = i * self.embedding_dim
                embeddings_flat[start:start + 4] = node_features[i]

        # One-hot current channel
        one_hot = np.zeros(self.num_channels, dtype=np.float32)
        one_hot[self.current_channel] = 1.0

        obs = np.concatenate([embeddings_flat, one_hot]).astype(np.float32)

        # Normalize observation
        if self.normalize_obs_flag:
            self.obs_stats.update(obs)
            if self.obs_stats.n > 100:
                obs = self.obs_stats.normalize(obs).astype(np.float32)

        return obs

    def _build_node_features(self) -> np.ndarray:
        """Build [N, 4] node feature matrix."""
        features = np.zeros((self.num_channels, 4), dtype=np.float32)

        for i in range(self.num_channels):
            # RSSI normalized
            rssi_norm = (self._latest_powers[i] - (-90.0)) / 80.0
            features[i, 0] = np.clip(rssi_norm, 0.0, 1.0)

            # Dwell time
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
            "epsilon": 0.0,
            "curriculum_phase": self.curriculum_episode,
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
