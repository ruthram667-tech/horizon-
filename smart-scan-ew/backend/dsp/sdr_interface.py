"""
Smart Scan EW — SDR Interface
==============================
Abstract base class for Software-Defined Radio interfaces.
Provides a SimulatedSDR (default) backed by the RFSimulator,
and a stub SoapySDRDevice for future hardware integration.
"""

from abc import ABC, abstractmethod
from typing import Set, Tuple, Optional
import numpy as np

from dsp.rf_simulator import RFSimulator
from app.config import NUM_CHANNELS


class SDRInterface(ABC):
    """Abstract SDR interface for spectrum scanning."""

    @abstractmethod
    def tune(self, channel: int) -> None:
        """Tune the receiver to the specified channel index."""
        ...

    @abstractmethod
    def read_power(self) -> np.ndarray:
        """Read power spectral density across all channels. Returns dBm array."""
        ...

    @abstractmethod
    def step(self) -> Tuple[np.ndarray, Set[int]]:
        """Advance one time step: tune, read, and return (powers, active_channels)."""
        ...

    @abstractmethod
    def reset(self) -> None:
        """Reset the SDR to initial state."""
        ...


class SimulatedSDR(SDRInterface):
    """
    SDR backed by the synthetic RF simulator.
    Default mode for development, training, and demonstration.
    """

    def __init__(
        self,
        num_channels: int = NUM_CHANNELS,
        num_emitters: int = 2,
        seed: Optional[int] = None,
    ):
        self.num_channels = num_channels
        self.num_emitters = num_emitters
        self.simulator = RFSimulator(
            num_channels=num_channels,
            num_emitters=num_emitters,
            seed=seed,
        )
        self.current_channel: int = 0
        self._latest_powers: np.ndarray = np.full(num_channels, -90.0)
        self._latest_active: Set[int] = set()

    def tune(self, channel: int) -> None:
        """Tune to a specific channel."""
        self.current_channel = max(0, min(channel, self.num_channels - 1))

    def read_power(self) -> np.ndarray:
        """Return latest PSD reading."""
        return self._latest_powers.copy()

    def step(self) -> Tuple[np.ndarray, Set[int]]:
        """Advance the simulator and return new readings."""
        powers, active = self.simulator.step()
        self._latest_powers = powers
        self._latest_active = active
        return powers, active

    def get_observed_transitions(self) -> np.ndarray:
        """Get aggregated transition matrix from all emitters."""
        return self.simulator.get_all_observed_transitions()

    def reset(self) -> None:
        """Reset the simulator."""
        self.simulator.reset(self.num_emitters)
        self.current_channel = 0
        self._latest_powers = np.full(self.num_channels, -90.0)
        self._latest_active = set()


class SoapySDRDevice(SDRInterface):
    """
    Stub for real SoapySDR hardware integration.
    
    To use with real hardware:
    1. Install SoapySDR: pip install SoapySDR
    2. Connect your SDR device (RTL-SDR, HackRF, USRP, etc.)
    3. Implement the abstract methods with actual SDR API calls
    """

    def __init__(self, device_args: str = "", num_channels: int = NUM_CHANNELS):
        self.device_args = device_args
        self.num_channels = num_channels
        self.current_channel: int = 0
        raise NotImplementedError(
            "SoapySDR hardware interface is not yet implemented. "
            "Use SimulatedSDR for development and demonstration. "
            "To implement: install SoapySDR, connect your device, "
            "and override tune/read_power/step methods."
        )

    def tune(self, channel: int) -> None:
        raise NotImplementedError("SoapySDR tune not implemented")

    def read_power(self) -> np.ndarray:
        raise NotImplementedError("SoapySDR read_power not implemented")

    def step(self) -> Tuple[np.ndarray, Set[int]]:
        raise NotImplementedError("SoapySDR step not implemented")

    def reset(self) -> None:
        raise NotImplementedError("SoapySDR reset not implemented")
