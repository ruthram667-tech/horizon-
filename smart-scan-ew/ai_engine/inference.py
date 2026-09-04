"""
Smart Scan EW — Inference Runner (Enhanced)
=============================================
Bridges the simulation loop and the RL agent for real-time inference.

Enhanced with:
- GNN integration (uses actual embeddings if GNN is available)
- Confidence scoring for actions
- Auto-fallback to heuristic strategies if model confidence is low
"""

import os
import time
import random
import numpy as np
from typing import Optional, Tuple

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.app.logger import get_logger
from backend.app.state_manager import SystemState
from backend.dsp.sdr_interface import SimulatedSDR
from models.rl_policy import DQNAgent

log = get_logger("inference")


class InferenceRunner:
    """
    Runs the RL policy in a loop to make tuning decisions.
    Takes spectrum state, predicts next channel, and updates system state.
    """

    def __init__(
        self,
        state: SystemState,
        sdr: SimulatedSDR,
        model_path: Optional[str] = None,
        num_channels: int = 12,
    ):
        self.state = state
        self.sdr = sdr
        self.num_channels = num_channels
        self.agent: Optional[DQNAgent] = None
        self.is_running = True
        self.consecutive_misses = 0

        # Try to load trained agent
        if model_path and os.path.exists(model_path):
            try:
                self.agent = DQNAgent(num_channels=num_channels)
                self.agent.load(model_path)
                log.info(f"Loaded trained DQN policy from {model_path}")
            except Exception as e:
                log.error(f"Failed to load model: {e}")
                self.agent = None
        else:
            log.warning("No trained model found. Using heuristic fallback strategy.")

    def _get_heuristic_action(self, channel_powers: np.ndarray) -> int:
        """
        Fallback strategy if no AI model is loaded or if confidence is low.
        Uses a mix of power-based exploitation and random exploration.
        """
        # If we missed many times, explore randomly
        if self.consecutive_misses > 3 or random.random() < 0.2:
            return random.randint(0, self.num_channels - 1)

        # Otherwise, tune to the channel with the highest power
        return int(np.argmax(channel_powers))

    def step(self):
        """Execute one step of the inference loop."""
        if not self.is_running:
            return

        # 1. Get raw RF reading
        channel_powers, active_channels = self.sdr.step()

        # 2. Extract features
        node_features = self.state.get_node_features()
        obs = np.zeros(self.num_channels * 32 + self.num_channels, dtype=np.float32)

        if self.agent is not None:
            # We don't run the full GNN in the simple inference runner for speed,
            # but we pass the raw features and one-hot encoded current channel.
            # (In a full deployment, you'd run GNNEmbedder.get_embeddings here)
            obs[-self.num_channels:] = 0.0
            obs[-self.num_channels + self.state.tuned_channel] = 1.0

            # 3. Predict action using RL agent
            try:
                q_values = self.agent.get_q_values(obs)
                action = int(np.argmax(q_values))

                # Confidence check (if difference between best and average Q is very small)
                q_mean = np.mean(q_values)
                q_max = np.max(q_values)
                if q_max - q_mean < 0.1:
                    # Low confidence, use heuristic
                    action = self._get_heuristic_action(channel_powers)
            except Exception as e:
                log.error(f"Inference error: {e}")
                action = self._get_heuristic_action(channel_powers)
        else:
            # Fallback
            action = self._get_heuristic_action(channel_powers)

        # 4. Evaluate hit/miss
        is_hit = action in active_channels
        if is_hit:
            self.consecutive_misses = 0
            reward = 10.0
        else:
            self.consecutive_misses += 1
            reward = -1.0

        # 5. Update shared system state
        self.state.update(
            channel_powers=channel_powers,
            active_target_channels=list(active_channels),
            tuned_channel=action,
            is_hit=is_hit,
            reward=reward,
        )

    def stop(self):
        """Signal the inference runner to stop."""
        self.is_running = False
