"""
Smart Scan EW — Synthetic RF Simulator
=======================================
Generates realistic Frequency-Hopping Spread Spectrum (FHSS) signals
using Markov transition matrices with time-evolving probabilities.
Outputs per-channel power spectral density (PSD) in dBm with AWGN.
"""

import numpy as np
from typing import List, Set, Tuple, Optional
from app.config import (
    NUM_CHANNELS, NOISE_FLOOR_DBM, NOISE_VARIANCE_DB,
    SIGNAL_POWER_MIN_DBM, SIGNAL_POWER_MAX_DBM,
)


class FHSSEmitter:
    """
    Simulates a single Frequency-Hopping Spread Spectrum emitter.
    
    The emitter hops across channels according to a Markov transition
    matrix whose probabilities evolve over time to model adaptive
    hopping patterns used in real EW scenarios.
    """

    def __init__(
        self,
        num_channels: int = NUM_CHANNELS,
        emitter_id: int = 0,
        hop_rate: float = 1.0,
        seed: Optional[int] = None,
    ):
        self.num_channels = num_channels
        self.emitter_id = emitter_id
        self.hop_rate = hop_rate
        self.rng = np.random.RandomState(seed)

        # Current channel
        self.current_channel: int = self.rng.randint(0, num_channels)

        # Initialize Markov transition matrix with random probabilities
        raw = self.rng.dirichlet(np.ones(num_channels), size=num_channels)
        self.transition_matrix: np.ndarray = raw.astype(np.float64)

        # Signal power for this emitter (dBm)
        self.signal_power_dbm: float = self.rng.uniform(
            SIGNAL_POWER_MIN_DBM, SIGNAL_POWER_MAX_DBM
        )

        # Time step counter for transition evolution
        self.time_step: int = 0

        # Hop history for analysis
        self.hop_history: List[int] = [self.current_channel]

    def evolve_transitions(self, perturbation_scale: float = 0.02) -> None:
        """
        Slowly perturb the transition matrix to simulate adaptive hopping.
        Each row gets a small random perturbation, then re-normalized.
        """
        noise = self.rng.randn(self.num_channels, self.num_channels) * perturbation_scale
        self.transition_matrix += noise
        # Clamp to non-negative
        self.transition_matrix = np.clip(self.transition_matrix, 1e-6, None)
        # Re-normalize rows to sum to 1
        row_sums = self.transition_matrix.sum(axis=1, keepdims=True)
        self.transition_matrix /= row_sums

    def hop(self) -> int:
        """
        Sample the next channel from the current row of the transition matrix.
        Returns the new channel index.
        """
        probs = self.transition_matrix[self.current_channel]
        self.current_channel = self.rng.choice(self.num_channels, p=probs)
        self.time_step += 1
        self.hop_history.append(self.current_channel)

        # Keep history bounded
        if len(self.hop_history) > 2000:
            self.hop_history = self.hop_history[-1000:]

        # Evolve transitions every 50 hops
        if self.time_step % 50 == 0:
            self.evolve_transitions()

        return self.current_channel

    def get_observed_transitions(self) -> np.ndarray:
        """
        Compute observed transition counts from hop history.
        Returns an [N, N] matrix of transition counts.
        """
        counts = np.zeros((self.num_channels, self.num_channels), dtype=np.float64)
        for i in range(len(self.hop_history) - 1):
            src = self.hop_history[i]
            dst = self.hop_history[i + 1]
            counts[src, dst] += 1
        return counts


class RFSimulator:
    """
    Manages multiple concurrent FHSS emitters and generates
    composite power spectral density readings per channel.
    """

    def __init__(
        self,
        num_channels: int = NUM_CHANNELS,
        num_emitters: int = 2,
        seed: Optional[int] = None,
    ):
        self.num_channels = num_channels
        self.num_emitters = num_emitters
        self.rng = np.random.RandomState(seed)

        # Create emitters with different seeds
        self.emitters: List[FHSSEmitter] = []
        for i in range(num_emitters):
            emitter_seed = self.rng.randint(0, 100000) if seed is not None else None
            self.emitters.append(
                FHSSEmitter(
                    num_channels=num_channels,
                    emitter_id=i,
                    hop_rate=self.rng.uniform(0.5, 2.0),
                    seed=emitter_seed,
                )
            )

        self.step_count: int = 0

    def step(self) -> Tuple[np.ndarray, Set[int]]:
        """
        Advance all emitters by one hop and generate composite PSD.
        
        Returns:
            channel_powers: np.ndarray of shape [num_channels] — power in dBm
            active_channels: set of channel indices where emitters are active
        """
        # Start with AWGN noise floor on all channels
        channel_powers = self.rng.normal(
            NOISE_FLOOR_DBM, NOISE_VARIANCE_DB, size=self.num_channels
        )

        active_channels: Set[int] = set()

        for emitter in self.emitters:
            # Hop to next channel
            ch = emitter.hop()
            active_channels.add(ch)

            # Add signal power to that channel (in dBm — approximate power addition)
            # Convert to linear, add, convert back
            noise_linear = 10 ** (channel_powers[ch] / 10.0)
            signal_linear = 10 ** (emitter.signal_power_dbm / 10.0)
            combined_linear = noise_linear + signal_linear
            channel_powers[ch] = 10.0 * np.log10(combined_linear)

        self.step_count += 1
        return channel_powers, active_channels

    def get_all_observed_transitions(self) -> np.ndarray:
        """
        Aggregate observed transition counts from all emitters.
        Returns [N, N] matrix.
        """
        total = np.zeros((self.num_channels, self.num_channels), dtype=np.float64)
        for emitter in self.emitters:
            total += emitter.get_observed_transitions()
        return total

    def reset(self, num_emitters: Optional[int] = None) -> None:
        """Reset the simulator with fresh emitters."""
        if num_emitters is not None:
            self.num_emitters = num_emitters
        self.__init__(
            num_channels=self.num_channels,
            num_emitters=self.num_emitters,
        )
