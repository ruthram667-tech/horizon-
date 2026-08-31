"""
Smart Scan EW — System Configuration
=====================================
Central configuration for the Electronic Warfare Support system.
Defines frequency bands, DSP parameters, RL hyperparameters, and API settings.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
import numpy as np


# ──────────────────────────────────────────────
# Frequency Band Configuration
# ──────────────────────────────────────────────
NUM_CHANNELS: int = 12
FREQ_MIN_GHZ: float = 2.0
FREQ_MAX_GHZ: float = 18.0

# Linearly spaced channel center frequencies (GHz)
CHANNEL_FREQS_GHZ: np.ndarray = np.linspace(FREQ_MIN_GHZ, FREQ_MAX_GHZ, NUM_CHANNELS)
CHANNEL_BANDWIDTH_MHZ: float = 500.0  # per-channel bandwidth

# ──────────────────────────────────────────────
# DSP / Signal Parameters
# ──────────────────────────────────────────────
FFT_SIZE: int = 1024
SAMPLE_RATE_MSPS: float = 20.0  # Mega-samples per second

NOISE_FLOOR_DBM: float = -90.0       # Thermal noise floor
NOISE_VARIANCE_DB: float = 5.0       # AWGN spread
SIGNAL_POWER_MIN_DBM: float = -30.0  # Weakest emitter signal
SIGNAL_POWER_MAX_DBM: float = -10.0  # Strongest emitter signal
DETECTION_THRESHOLD_DBM: float = -50.0  # Energy detection threshold

# ──────────────────────────────────────────────
# RL / Training Hyperparameters
# ──────────────────────────────────────────────
REWARD_INTERCEPT_HIT: float = 10.0
REWARD_EMPTY_SCAN: float = -1.0
REWARD_MISSED_ACTIVE: float = -5.0
SWITCHING_PENALTY_ALPHA: float = 0.3
EPISODE_LENGTH: int = 500

# DQN Hyperparameters
DQN_LEARNING_RATE: float = 1e-3
DQN_BUFFER_SIZE: int = 50_000
DQN_BATCH_SIZE: int = 64
DQN_GAMMA: float = 0.99
DQN_TAU: float = 0.005           # Soft update coefficient
DQN_EPSILON_START: float = 1.0
DQN_EPSILON_END: float = 0.05
DQN_EPSILON_DECAY_STEPS: int = 10_000

# GNN Architecture
GNN_INPUT_DIM: int = 4        # [RSSI, dwell_time, duty_cycle, detection_prob]
GNN_HIDDEN_DIM: int = 32
GNN_HEADS: int = 4
GNN_OUTPUT_DIM: int = 32
GNN_DROPOUT: float = 0.3

# ──────────────────────────────────────────────
# API / WebSocket Settings
# ──────────────────────────────────────────────
WS_BROADCAST_FPS: int = 30
API_HOST: str = "0.0.0.0"
API_PORT: int = 8000

# ──────────────────────────────────────────────
# Pydantic Models for API Validation
# ──────────────────────────────────────────────

class ScanConfig(BaseModel):
    """Runtime scan configuration adjustable via REST API."""
    num_channels: int = Field(default=NUM_CHANNELS, ge=4, le=32)
    freq_min_ghz: float = Field(default=FREQ_MIN_GHZ, ge=0.1, le=40.0)
    freq_max_ghz: float = Field(default=FREQ_MAX_GHZ, ge=0.1, le=40.0)
    detection_threshold_dbm: float = Field(default=DETECTION_THRESHOLD_DBM)
    mode: str = Field(default="synthetic", pattern="^(synthetic|hardware)$")
    num_emitters: int = Field(default=2, ge=1, le=5)


class ScanState(BaseModel):
    """JSON payload broadcast over WebSocket at each frame."""
    timestamp: float
    channel_powers: List[float]
    channel_freqs_ghz: List[float]
    active_target_ch: List[int]
    tuned_ch: int
    is_hit: bool
    pd: float              # Detection probability
    pfa: float             # False alarm rate
    total_hops: int
    total_hits: int
    total_misses: int
    reward: float
    episode_reward: float
    mode: str = "synthetic"
