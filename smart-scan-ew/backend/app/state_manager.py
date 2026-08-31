"""
Smart Scan EW — Thread-Safe State Manager
==========================================
Shared memory container that bridges the RF simulation loop,
the RL inference engine, and the WebSocket broadcaster.
All mutations are protected by a threading.Lock.
"""

import threading
import time
import numpy as np
from typing import Dict, Any, List, Optional
from app.config import NUM_CHANNELS, CHANNEL_FREQS_GHZ


class SystemState:
    """
    Central state object holding the latest scan telemetry.
    Thread-safe: all reads/writes go through the lock.
    """

    def __init__(self, num_channels: int = NUM_CHANNELS):
        self._lock = threading.Lock()
        self.num_channels = num_channels

        # ── Spectrum Data ──
        self.channel_powers: np.ndarray = np.full(num_channels, -90.0)
        self.channel_freqs_ghz: np.ndarray = np.linspace(
            CHANNEL_FREQS_GHZ[0], CHANNEL_FREQS_GHZ[-1], num_channels
        )

        # ── Emitter / Tuner State ──
        self.active_target_channels: List[int] = []
        self.tuned_channel: int = 0
        self.is_hit: bool = False

        # ── Metrics ──
        self.total_hops: int = 0
        self.total_hits: int = 0
        self.total_misses: int = 0
        self.total_false_alarms: int = 0
        self.total_active_opportunities: int = 0
        self.total_scans: int = 0
        self.pd: float = 0.0   # Detection probability
        self.pfa: float = 0.0  # False alarm rate

        # ── RL Telemetry ──
        self.reward: float = 0.0
        self.episode_reward: float = 0.0

        # ── Control ──
        self.mode: str = "synthetic"
        self.is_running: bool = False
        self.timestamp: float = time.time()

        # ── Tuner History (for GNN dwell time / duty cycle) ──
        self.tuner_history: List[int] = []
        self.channel_visit_counts: np.ndarray = np.zeros(num_channels, dtype=np.int64)
        self.channel_last_visit: np.ndarray = np.zeros(num_channels, dtype=np.float64)
        self.channel_hit_counts: np.ndarray = np.zeros(num_channels, dtype=np.int64)

    def update(
        self,
        channel_powers: np.ndarray,
        active_target_channels: List[int],
        tuned_channel: int,
        is_hit: bool,
        reward: float = 0.0,
    ) -> None:
        """Atomically update the state after one scan step."""
        with self._lock:
            self.timestamp = time.time()
            self.channel_powers = channel_powers.copy()
            self.active_target_channels = list(active_target_channels)
            self.tuned_channel = tuned_channel
            self.is_hit = is_hit
            self.reward = reward
            self.episode_reward += reward

            # Metrics bookkeeping
            self.total_hops += 1
            self.total_scans += 1

            if is_hit:
                self.total_hits += 1

            # Count missed active channels (active but not tuned)
            missed = [ch for ch in active_target_channels if ch != tuned_channel]
            self.total_misses += len(missed)

            # False alarm: tuned to a non-active channel but detected signal above threshold
            if not is_hit and tuned_channel not in active_target_channels:
                if channel_powers[tuned_channel] > -50.0:
                    self.total_false_alarms += 1

            # Track active opportunities for Pd calculation
            self.total_active_opportunities += len(active_target_channels)

            # Update Pd and Pfa
            if self.total_active_opportunities > 0:
                self.pd = self.total_hits / self.total_active_opportunities
            if self.total_scans > 0:
                self.pfa = self.total_false_alarms / self.total_scans

            # Tuner history
            self.tuner_history.append(tuned_channel)
            if len(self.tuner_history) > 1000:
                self.tuner_history = self.tuner_history[-500:]
            self.channel_visit_counts[tuned_channel] += 1
            self.channel_last_visit[tuned_channel] = self.timestamp

            if is_hit:
                self.channel_hit_counts[tuned_channel] += 1

    def snapshot(self) -> Dict[str, Any]:
        """Return a JSON-serializable copy of the current state."""
        with self._lock:
            return {
                "timestamp": self.timestamp,
                "channel_powers": self.channel_powers.tolist(),
                "channel_freqs_ghz": self.channel_freqs_ghz.tolist(),
                "active_target_ch": list(self.active_target_channels),
                "tuned_ch": self.tuned_channel,
                "is_hit": self.is_hit,
                "pd": round(self.pd, 4),
                "pfa": round(self.pfa, 4),
                "total_hops": self.total_hops,
                "total_hits": self.total_hits,
                "total_misses": self.total_misses,
                "reward": round(self.reward, 4),
                "episode_reward": round(self.episode_reward, 4),
                "mode": self.mode,
            }

    def get_node_features(self) -> np.ndarray:
        """
        Build GNN node feature matrix [N, 4].
        Features: [latest_rssi, dwell_time_since_last_visit, duty_cycle, detection_prob]
        """
        with self._lock:
            now = time.time()
            n = self.num_channels
            features = np.zeros((n, 4), dtype=np.float32)

            for i in range(n):
                # Feature 0: Latest RSSI (normalized to [0,1] from [-90, -10])
                rssi_norm = (self.channel_powers[i] - (-90.0)) / 80.0
                features[i, 0] = np.clip(rssi_norm, 0.0, 1.0)

                # Feature 1: Dwell time since last visit (seconds, capped at 10)
                if self.channel_last_visit[i] > 0:
                    dwell = min(now - self.channel_last_visit[i], 10.0) / 10.0
                else:
                    dwell = 1.0  # Never visited
                features[i, 1] = dwell

                # Feature 2: Historical duty cycle
                if self.total_hops > 0:
                    features[i, 2] = self.channel_visit_counts[i] / self.total_hops
                else:
                    features[i, 2] = 0.0

                # Feature 3: Detection probability per channel
                if self.channel_visit_counts[i] > 0:
                    features[i, 3] = self.channel_hit_counts[i] / self.channel_visit_counts[i]
                else:
                    features[i, 3] = 0.0

            return features

    def reset_episode(self) -> None:
        """Reset per-episode counters while keeping cumulative stats."""
        with self._lock:
            self.episode_reward = 0.0
            self.tuner_history.clear()

    def reset_all(self) -> None:
        """Full reset of all state."""
        with self._lock:
            self.__init__(self.num_channels)
