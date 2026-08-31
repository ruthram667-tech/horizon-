"""
Smart Scan EW — Live Inference Runner
=======================================
Loads a trained RL model and runs live inference,
feeding tuning decisions back to the backend state manager.
Designed to run alongside the FastAPI server.
"""

import os
import sys
import time
import numpy as np
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.config import NUM_CHANNELS, GNN_OUTPUT_DIM
from app.state_manager import SystemState
from dsp.sdr_interface import SimulatedSDR


class InferenceRunner:
    """
    Live inference engine that bridges the trained RL model
    with the backend state manager and SDR interface.
    """

    def __init__(
        self,
        state: SystemState,
        sdr: SimulatedSDR,
        model_path: Optional[str] = None,
        num_channels: int = NUM_CHANNELS,
        use_trained_model: bool = True,
    ):
        self.state = state
        self.sdr = sdr
        self.num_channels = num_channels
        self.current_channel = 0
        self.running = False
        self.step_count = 0

        # Load trained model if available
        self.agent = None
        if use_trained_model and model_path and os.path.exists(model_path):
            try:
                from models.rl_policy import DQNAgent
                self.agent = DQNAgent(num_channels=num_channels)
                self.agent.load(model_path)
                self.agent.epsilon = 0.0  # Pure exploitation
                print(f"  ✓ Loaded trained model from {model_path}")
            except Exception as e:
                print(f"  ⚠ Could not load model: {e}")
                print(f"  → Falling back to heuristic policy")
                self.agent = None
        else:
            print("  → Using heuristic policy (no trained model)")

    def _build_observation(self) -> np.ndarray:
        """Build observation vector from current state."""
        node_features = self.state.get_node_features()

        # Simplified: use padded node features as embeddings
        embeddings_flat = np.zeros(
            self.num_channels * GNN_OUTPUT_DIM, dtype=np.float32
        )
        for i in range(self.num_channels):
            start = i * GNN_OUTPUT_DIM
            embeddings_flat[start:start + 4] = node_features[i]

        # One-hot current channel
        one_hot = np.zeros(self.num_channels, dtype=np.float32)
        one_hot[self.current_channel] = 1.0

        return np.concatenate([embeddings_flat, one_hot]).astype(np.float32)

    def _heuristic_policy(self) -> int:
        """
        Smart heuristic policy used when no trained model is available.
        Combines power-based scanning with exploration.
        
        Strategy:
        1. 70% of the time: tune to the channel with highest recent power
        2. 20% of the time: tune to least-recently-visited channel
        3. 10% of the time: random exploration
        """
        snapshot = self.state.snapshot()
        powers = np.array(snapshot["channel_powers"])

        r = np.random.random()

        if r < 0.7:
            # Power-based: tune to highest power channel
            return int(np.argmax(powers))
        elif r < 0.9:
            # Exploration: least recently visited
            node_features = self.state.get_node_features()
            dwell_times = node_features[:, 1]  # Higher = longer since visit
            return int(np.argmax(dwell_times))
        else:
            # Random
            return np.random.randint(0, self.num_channels)

    def step(self) -> dict:
        """
        Execute one inference step:
        1. Read current state
        2. Select action (trained model or heuristic)
        3. Advance SDR
        4. Update state manager
        
        Returns:
            State snapshot after update
        """
        # Select action
        if self.agent is not None:
            obs = self._build_observation()
            action = self.agent.predict(obs)
        else:
            action = self._heuristic_policy()

        self.current_channel = action

        # Advance SDR simulator
        channel_powers, active_channels = self.sdr.step()
        self.sdr.tune(action)

        # Check if hit
        is_hit = action in active_channels

        # Compute reward
        from app.config import (
            REWARD_INTERCEPT_HIT, REWARD_EMPTY_SCAN,
            REWARD_MISSED_ACTIVE, SWITCHING_PENALTY_ALPHA,
        )
        reward = 0.0
        if is_hit:
            reward += REWARD_INTERCEPT_HIT
        else:
            reward += REWARD_EMPTY_SCAN

        missed = [ch for ch in active_channels if ch != action]
        reward += REWARD_MISSED_ACTIVE * len(missed)

        # Update state
        self.state.update(
            channel_powers=channel_powers,
            active_target_channels=list(active_channels),
            tuned_channel=action,
            is_hit=is_hit,
            reward=reward,
        )

        self.step_count += 1
        return self.state.snapshot()

    def run_loop(self, fps: float = 30.0):
        """
        Blocking inference loop at specified FPS.
        Call from a thread or async task.
        """
        self.running = True
        interval = 1.0 / fps

        print(f"\n  🚀 Inference loop started at {fps} FPS")
        while self.running:
            start = time.time()
            self.step()
            elapsed = time.time() - start
            sleep_time = max(0, interval - elapsed)
            time.sleep(sleep_time)

    def stop(self):
        """Stop the inference loop."""
        self.running = False
        print("  ⏹ Inference loop stopped")


if __name__ == "__main__":
    """Test inference standalone."""
    state = SystemState()
    sdr = SimulatedSDR()
    runner = InferenceRunner(state, sdr, use_trained_model=False)

    print("\n  Running 100 inference steps...")
    for i in range(100):
        snapshot = runner.step()
        if i % 20 == 0:
            print(f"  Step {i}: Pd={snapshot['pd']:.3f}, Hits={snapshot['total_hits']}, "
                  f"Tuned=Ch{snapshot['tuned_ch']}, Hit={snapshot['is_hit']}")

    print(f"\n  Final: Pd={snapshot['pd']:.3f}, Total Hits={snapshot['total_hits']}/{snapshot['total_hops']}")
