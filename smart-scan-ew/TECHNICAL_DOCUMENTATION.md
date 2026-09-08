# 📘 Smart Scan EW — Technical Documentation

**Team HORIZON — SIH26055**
*AI-Powered Electronic Warfare Support System*

> **Version:** 2.0.0
> **Last Updated:** September 2026
> **Authors:** Team HORIZON

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Why We Chose This Stack](#4-why-we-chose-this-stack)
5. [Module Deep-Dive](#5-module-deep-dive)
   - 5.1 [Frontend](#51-frontend)
   - 5.2 [Backend](#52-backend)
   - 5.3 [AI Engine](#53-ai-engine)
   - 5.4 [DSP Layer](#54-dsp-layer)
6. [Data Flow & Pipeline](#6-data-flow--pipeline)
7. [AI/ML Pipeline Details](#7-aiml-pipeline-details)
8. [API Reference](#8-api-reference)
9. [Configuration Reference](#9-configuration-reference)
10. [Deployment](#10-deployment)
11. [Project Structure](#11-project-structure)

---

## 1. Project Overview

**Smart Scan EW** is an AI-powered Electronic Warfare Support (ES) system designed to intercept fast-hopping **Frequency-Hopping Spread Spectrum (FHSS)** radio signals — without requiring any prior intelligence about the target's hopping pattern.

### Problem Statement

FHSS emitters change their transmission frequency up to hundreds of times per second using pseudo-random hopping sequences. Traditional scanning approaches (sequential or random) fail to achieve reliable interception because:

- The scanner cannot cover all channels simultaneously
- Without knowing the hopping pattern, the scanner must predict where the emitter will transmit next
- Multiple emitters can operate concurrently, creating a multi-target tracking problem

### Our Solution

We model the RF spectrum as a **dynamic graph** where frequency channels are nodes and observed hopping transitions form edges. A **Graph Neural Network (GAT)** learns structural embeddings from this graph, and a **Reinforcement Learning agent (DQN)** uses these embeddings to learn an optimal scanning policy — which channel to tune to at each time step to maximize interception probability.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ WaterfallPlot│  │ MetricsPanel │  │ ControlPanel │              │
│  │  (Canvas 2D) │  │  (Pd, Pfa)   │  │ (Start/Stop) │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                      │
│         └─────────────────┼──────────────────┘                      │
│                           │                                         │
│                  ┌────────┴────────┐                                │
│                  │ useWebSocket.js │ (Auto-reconnect WS consumer)   │
│                  └────────┬────────┘                                │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ WebSocket (ws://localhost:8000/ws/stream)
                            │ 30 FPS JSON frames
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + Uvicorn)                       │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │  REST API    │  │  WebSocket Hub   │  │  State Manager      │   │
│  │ /api/scan/*  │  │  /ws/stream      │  │  (Thread-safe)      │   │
│  │ /api/status  │  │  30 FPS push     │  │  Shared state store │   │
│  └──────────────┘  └──────────────────┘  └──────────┬──────────┘   │
│                                                      │              │
│  ┌───────────────────────────────────────────────────┼───────────┐  │
│  │                DSP Layer                          │           │  │
│  │  ┌────────────────┐  ┌────────────────┐           │           │  │
│  │  │ RF Simulator   │  │ SDR Interface  │───────────┘           │  │
│  │  │ (FHSS/AWGN)    │  │ (Sim/Hardware) │                      │  │
│  │  └────────────────┘  └────────────────┘                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI ENGINE (PyTorch)                            │
│  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────┐   │
│  │  GNN Embedder    │  │  DQN Agent        │  │  Gymnasium Env │   │
│  │  (2-layer GAT)   │──▶  (Dueling + PER)  │  │ (SpectrumScan) │   │
│  │  4→128→32 dims   │  │  select_action()  │  │  step/reset    │   │
│  └──────────────────┘  └───────────────────┘  └────────────────┘   │
│                                                                     │
│  ┌──────────────────┐  ┌───────────────────┐                       │
│  │  Inference Runner│  │  Training Pipeline│                       │
│  │  (Live loop)     │  │  (Offline)        │                       │
│  └──────────────────┘  └───────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend

| Technology | Version | Role |
|---|---|---|
| **React** | 18.3 | Component-based UI framework |
| **Vite** | 5.4 | Build tool & development server |
| **Tailwind CSS** | 3.4 | Utility-first CSS framework |
| **React Router DOM** | 7.18 | Client-side page routing |
| **React Plotly.js** | 2.6 | Interactive spectrum charts |
| **HTML5 Canvas** | Native | Real-time waterfall spectrogram |
| **WebSocket API** | Native | 30 FPS real-time data streaming |

### 3.2 Backend

| Technology | Version | Role |
|---|---|---|
| **FastAPI** | ≥ 0.110 | Async REST API + WebSocket server |
| **Uvicorn** | ≥ 0.29 | ASGI application server |
| **Pydantic** | ≥ 2.5 | Data validation & configuration models |
| **WebSockets** | ≥ 12.0 | Real-time bidirectional communication |
| **NumPy** | ≥ 1.26 | Numerical computation for RF simulation |

### 3.3 AI Engine

| Technology | Version | Role |
|---|---|---|
| **PyTorch** | ≥ 2.2 | Deep learning framework |
| **PyTorch Geometric (PyG)** | ≥ 2.5 | Graph Neural Network layers |
| **Gymnasium** | ≥ 0.29 | Reinforcement learning environment interface |
| **Stable-Baselines3** | ≥ 2.3 | Pre-built RL algorithm implementations |
| **TensorBoard** | Optional | Training visualization & metrics logging |

### 3.4 DevOps & Deployment

| Technology | Role |
|---|---|
| **Docker** | Containerized deployment |
| **Docker Compose** | Multi-service orchestration |

---

## 4. Why We Chose This Stack

### 4.1 Frontend: React + Vite + Canvas

| Decision | Choice | Alternative Considered | Rationale |
|---|---|---|---|
| **UI Framework** | React 18 | Angular, Vue, Svelte | React's virtual DOM handles 30 FPS WebSocket updates efficiently without full re-renders. Massive ecosystem for data-viz. Angular is too heavy; Vue has smaller data-viz ecosystem. |
| **Build Tool** | Vite 5 | Webpack, CRA | Vite uses native ES modules for near-instant HMR (~50ms). CRA is deprecated. Webpack is 10-20x slower for dev startup. |
| **Rendering** | HTML5 Canvas | SVG, D3.js, WebGL | The waterfall spectrogram needs to render at **30 FPS**. Canvas is the only viable option — SVG would choke on that many DOM mutations per second. WebGL is overkill for 2D. |
| **Styling** | Tailwind CSS | Vanilla CSS, Material UI | Rapid prototyping of glassmorphism UI with utility classes. For a hackathon, Tailwind reduces styling time by ~60% vs vanilla CSS. |
| **Charts** | React Plotly.js | Chart.js, Recharts | Plotly supports interactive spectrum visualization with hover tooltips, zoom, and logarithmic axes out of the box. Best for scientific data. |

### 4.2 Backend: FastAPI + Uvicorn

| Decision | Choice | Alternative Considered | Rationale |
|---|---|---|---|
| **API Framework** | FastAPI | Flask, Django, Express.js | **Native async/await** and built-in WebSocket support — critical for streaming spectrum data at 30 FPS. Flask requires Socket.IO (extra dependency + overhead). Django is far too heavy. Express.js would split the backend into a different language. |
| **Server** | Uvicorn (ASGI) | Gunicorn (WSGI) | ASGI is async-native, matching FastAPI's event loop. Gunicorn is synchronous and would bottleneck WebSocket connections. |
| **Validation** | Pydantic v2 | Marshmallow, Cerberus | Deeply integrated with FastAPI — automatic request/response validation, auto-generated OpenAPI docs, and type-safe configuration models. |
| **Language** | Python | Node.js, Go, Rust | Python is required for seamless integration with PyTorch/PyG AI engine. Having frontend-backend-AI all in different languages would add unnecessary complexity. |

### 4.3 AI Engine: PyTorch + PyG + DQN

| Decision | Choice | Alternative Considered | Rationale |
|---|---|---|---|
| **DL Framework** | PyTorch | TensorFlow, JAX | PyTorch's **dynamic computation graph** is essential — the GNN graph topology changes every time step as new hop transitions are observed. TensorFlow's static graph makes this painful. PyTorch also integrates seamlessly with PyG. |
| **GNN Library** | PyTorch Geometric | DGL, Spektral | PyG is the most mature GNN library with 15k+ GitHub stars. Provides `GATConv` out of the box. DGL has less community support. Spektral is Keras-only (incompatible with PyTorch RL stack). |
| **GNN Architecture** | GAT (Graph Attention) | GCN, GraphSAGE, MLP | GAT learns **attention weights** between channels, automatically discovering which channel transitions matter most. GCN uses fixed equal weighting. GraphSAGE doesn't model pairwise attention. MLP loses all structural information. |
| **RL Algorithm** | DQN (Dueling + PER) | PPO, A3C, SAC | The action space is **discrete** (select 1 of N channels). DQN with experience replay is more sample-efficient for discrete actions than PPO. SAC is designed for continuous actions. The project uses 4 enhancements: Dueling architecture, Prioritized Experience Replay, NoisyNet, and Double DQN. |
| **RL Environment** | Gymnasium | Custom interface | Gymnasium's standard `step()`/`reset()` API means SB3 algorithms (DQN, PPO) can be dropped in with zero adapter code. Industry-standard interface. |
| **Feature Representation** | GNN (graph-based) | CNN (image-based), MLP (flat) | **Key architectural insight**: The RF spectrum is naturally a graph. Channels = nodes, hop transitions = edges. A GNN learns spatial relationships AND observed hopping patterns simultaneously. A CNN would only see local spectral adjacency; an MLP would lose all structure. |

### 4.4 Why Not Other Complete Stacks?

| Alternative Stack | Why Not |
|---|---|
| **MERN (MongoDB, Express, React, Node)** | No native Python AI integration. Would require a separate AI microservice, adding latency and complexity. |
| **Django + TensorFlow** | Django is a monolithic framework overkill for a real-time data pipeline. TensorFlow's static graph is unsuitable for dynamic GNN topologies. |
| **Streamlit / Gradio** | Great for quick ML demos but cannot handle 30 FPS real-time waterfall rendering or custom Canvas-based UIs. |
| **C++ / CUDA backend** | Maximum performance but extreme development time. Python's 30 FPS is sufficient for this application; the bottleneck is RF physics, not code speed. |

---

## 5. Module Deep-Dive

### 5.1 Frontend

The frontend is a **React SPA** built with Vite, serving as a real-time Electronic Warfare dashboard.

#### Pages

| Page | File | Description |
|---|---|---|
| Landing | `pages/LandingPage.jsx` | Hero page with system overview and entry point |
| Dashboard | `pages/DashboardPage.jsx` | Main operational view with waterfall, metrics, and controls |
| Analytics | `pages/AnalyticsPage.jsx` | Historical session data and performance trends |
| Settings | `pages/SettingsPage.jsx` | System configuration (channels, thresholds, mode) |

#### Core Components

| Component | File | Description |
|---|---|---|
| **WaterfallPlot** | `components/WaterfallPlot.jsx` | Canvas-based 2D spectrogram rendering at 30 FPS. Each row is a time slice showing channel powers as color-mapped pixels. Scrolls downward continuously. |
| **MetricsPanel** | `components/MetricsPanel.jsx` | Displays real-time metrics: Detection Probability (Pd), False Alarm Rate (Pfa), total intercepts, scan efficiency. |
| **ControlPanel** | `components/ControlPanel.jsx` | Start/Stop scan controls, mode selection (synthetic/hardware), channel count configuration. |
| **GNNVisualizer** | `components/GNNVisualizer.jsx` | Visualizes the GNN graph structure — nodes as channels, edges as observed transitions. |
| **Navbar** | `components/Navbar.jsx` | Navigation bar with routing between pages. |

#### Hooks

| Hook | File | Description |
|---|---|---|
| **useWebSocket** | `hooks/useWebSocket.js` | Custom hook managing WebSocket connection with auto-reconnect. Receives 30 FPS JSON frames from backend and exposes reactive state. |

#### Design System

- **Theme**: Dark mode with glassmorphism effects
- **CSS**: Tailwind CSS 3.4 with custom configuration
- **Typography**: Modern sans-serif stack
- **Animations**: CSS transitions for hover effects and micro-interactions

---

### 5.2 Backend

The backend is a **FastAPI** application serving both REST endpoints and a WebSocket streaming hub.

#### Core Modules

| Module | File | Description |
|---|---|---|
| **Main Server** | `app/main.py` | FastAPI application with lifespan management, CORS, REST endpoints, WebSocket hub, and simulation loop orchestration. |
| **Configuration** | `app/config.py` | Central config: frequency bands, DSP parameters, RL hyperparameters, API settings. Supports env vars. |
| **State Manager** | `app/state_manager.py` | Thread-safe shared state container. Bridges the async API layer and the simulation/inference loop. Tracks metrics, sessions, and scan history. |
| **Logger** | `app/logger.py` | Structured logging setup with named loggers for different components. |
| **Exceptions** | `app/exceptions.py` | Custom exception classes: `ScanAlreadyRunning`, `ScanNotRunning`, `WebSocketLimitExceeded`. |

#### Key Design Patterns

1. **Async Event Loop**: The simulation runs as an `asyncio.Task` inside FastAPI's event loop, avoiding thread synchronization issues.
2. **State Separation**: `SystemState` acts as the single source of truth, decoupling the simulation engine from the API layer.
3. **Graceful Lifecycle**: Uses FastAPI's `@asynccontextmanager` lifespan for clean startup/shutdown.
4. **Global Exception Handler**: Catches unhandled errors and returns structured JSON responses.

---

### 5.3 AI Engine

The AI engine implements a **GNN + RL** pipeline for learning optimal spectrum scanning strategies.

#### Graph Neural Network (GNN Embedder)

**File**: `ai_engine/models/gnn_embedder.py`

| Layer | Input | Output | Details |
|---|---|---|---|
| Input Projection | `[N, 4]` | `[N, 128]` | Linear + ELU |
| GAT Layer 1 | `[N, 128]` | `[N, 128]` | 4-head attention, concat, + skip connection + LayerNorm |
| GAT Layer 2 | `[N, 128]` | `[N, 32]` | 1-head attention, + skip connection (with projection) + LayerNorm |

**Node Features** (4 per channel):

| Feature | Range | Description |
|---|---|---|
| RSSI (normalized) | [0, 1] | Received signal strength, normalized from dBm |
| Dwell Time | [0, 1] | Time since last visit to this channel |
| Duty Cycle | [0, 1] | Fraction of total scans spent on this channel |
| Detection Probability | [0, 1] | Historical hit rate on this channel |

**Edge Construction** (from `build_graph()`):

1. **Spectral adjacency**: Channels within ±2 of each other are always connected (weighted by `1/distance`)
2. **Observed hop transitions**: Non-adjacent channels are connected if observed transition probability exceeds threshold (0.01)
3. **Self-loops**: Every channel connects to itself

#### Reinforcement Learning Agent (DQN)

**File**: `ai_engine/models/rl_policy.py`

The agent uses a **Dueling Double DQN** with four enhancements:

| Enhancement | Class | Purpose |
|---|---|---|
| **Dueling Architecture** | `DuelingDQNetwork` | Separates value V(s) and advantage A(s,a) streams. Output: V + A - mean(A). Better state evaluation. |
| **Prioritized Experience Replay** | `PrioritizedReplayBuffer` | Samples transitions proportional to TD-error. Focuses learning on surprising/informative experiences. |
| **NoisyNet Exploration** | `NoisyLinear` | Replaces ε-greedy with learned parameter noise. More efficient exploration in later training stages. |
| **Double DQN** | In `train_step()` | Uses policy network for action selection, target network for Q-value estimation. Reduces Q-value overestimation. |

**Network Architecture** (Dueling DQN):

```
Input: [N×32 GNN embeddings + N one-hot channel] = 416 dims (for N=12)
  ↓
Shared Feature Extractor:
  Linear(416 → 256) + ReLU
  Linear(256 → 128) + ReLU
  ↓                      ↓
Value Stream:          Advantage Stream:
  NoisyLinear(128→64)    NoisyLinear(128→64)
  ReLU                   ReLU
  NoisyLinear(64→1)      NoisyLinear(64→N)
  ↓                      ↓
Output: V(s) + A(s,a) - mean(A(s,:))   →  Q-values [N]
```

#### Gymnasium Environment

**File**: `ai_engine/env/spectrum_env.py`

| Property | Value |
|---|---|
| **Observation Space** | `Box(shape=(N×32 + N,), dtype=float32)` — GNN embeddings + one-hot position |
| **Action Space** | `Discrete(N)` — Channel index to tune to |
| **Episode Length** | 500 steps |
| **Reward Function** | Multi-component shaped reward (see below) |

**Reward Function**:

| Component | Value | Condition |
|---|---|---|
| Intercept hit | **+10.0** | Tuned to an active emitter channel |
| Empty scan | **−1.0** | Tuned to an inactive channel |
| Missed active | **−5.0 × count** | Per active channel that was NOT scanned |
| Switching penalty | **−0.3 × |Δf|** | Proportional to channel distance moved |
| Proximity bonus | **+2.0** / **+0.5** | Adjacent / 2-away from an active channel |
| Exploration bonus | **+0.3** | Visiting an under-explored channel |
| Consecutive miss penalty | **−0.5 × (n−5)** | Escalating after 5 consecutive misses |

**Advanced Features**:
- **Observation Normalization**: Welford's online algorithm for running mean/std
- **Curriculum Learning**: Starts with 1 emitter, gradually increases to 3
- **Dynamic Difficulty**: Emitter transition matrices evolve every 50 hops

---

### 5.4 DSP Layer

The DSP (Digital Signal Processing) layer simulates realistic RF environments.

#### RF Simulator

**File**: `backend/dsp/rf_simulator.py`

| Class | Purpose |
|---|---|
| `FHSSEmitter` | Simulates a single frequency-hopping emitter with Markov transition matrices |
| `RFSimulator` | Manages multiple concurrent emitters and generates composite power spectral density |

**Signal Model**:

- **Noise Floor**: AWGN at −90 dBm with 5 dB variance
- **Signal Power**: −30 to −10 dBm per emitter
- **Hopping Pattern**: Markov chain with time-evolving transition probabilities
- **Transition Evolution**: Transition matrix is perturbed every 50 hops (perturbation scale: 0.02)
- **Power Addition**: Physically accurate linear power addition in mW domain, then conversion back to dBm

#### SDR Interface

**File**: `backend/dsp/sdr_interface.py`

Provides an abstraction layer with two implementations:

| Implementation | Description |
|---|---|
| `SimulatedSDR` | Wraps `RFSimulator` for software-only operation |
| `SoapySDR` (stub) | Placeholder for real hardware SDR integration via SoapySDR API |

---

## 6. Data Flow & Pipeline

### 6.1 Real-Time Scan Loop (30 FPS)

```
Step 1: RF Simulator generates channel_powers [N] and active_channels {set}
    ↓
Step 2: InferenceRunner builds observation vector
    ├── GNN embeddings (if GNN is loaded) or raw features
    └── One-hot current channel position
    ↓
Step 3: DQN Agent predicts best channel (argmax Q-values)
    ├── If confidence high → use RL action
    └── If confidence low → fallback to heuristic (argmax power)
    ↓
Step 4: Evaluate hit/miss → compute reward
    ↓
Step 5: Update SystemState (thread-safe)
    ├── channel_powers, tuned_channel, is_hit
    ├── Update running Pd, Pfa metrics
    └── Append to history buffers
    ↓
Step 6: WebSocket broadcasts state snapshot as JSON
    ↓
Step 7: React frontend receives frame → updates Canvas + Metrics
```

### 6.2 Training Pipeline (Offline)

```
Step 1: Create SpectrumScanEnv (wraps RFSimulator + GNNEmbedder)
    ↓
Step 2: Reset environment → get initial observation
    ↓
Step 3: For each timestep:
    ├── Agent selects action (ε-greedy or NoisyNet)
    ├── Environment steps → returns (obs, reward, done, info)
    ├── Store transition in Prioritized Replay Buffer
    ├── Sample batch → compute TD-error → gradient step
    ├── Soft-update target network (Polyak averaging, τ=0.005)
    └── Decay epsilon
    ↓
Step 4: Every 10,000 steps:
    ├── Save checkpoint
    └── Run 5 evaluation episodes → log metrics
    ↓
Step 5: Save best_model.pt, training_log.json, TensorBoard logs
```

---

## 7. AI/ML Pipeline Details

### 7.1 Training Configuration

| Hyperparameter | Value | Notes |
|---|---|---|
| Learning Rate | 1e-3 | With cosine annealing (min: 1e-4) |
| Replay Buffer Size | 50,000 | Prioritized with α=0.6 |
| Batch Size | 64 | |
| Discount Factor (γ) | 0.99 | |
| Soft Update Rate (τ) | 0.005 | Polyak averaging |
| ε Start → End | 1.0 → 0.05 | Over 10,000 steps |
| Gradient Clipping | 10.0 | Max gradient norm |
| Episode Length | 500 steps | |

### 7.2 Training Commands

```bash
# Native PyTorch DQN (recommended)
python train.py --timesteps 100000 --algo dqn

# With curriculum learning
python train.py --timesteps 100000 --algo dqn --curriculum

# Resume from checkpoint
python train.py --timesteps 100000 --algo dqn --resume checkpoints/checkpoint_50000.pt

# Stable-Baselines3 DQN
python train.py --timesteps 50000 --algo sb3-dqn

# Stable-Baselines3 PPO
python train.py --timesteps 50000 --algo sb3-ppo

# Disable enhancements (ablation study)
python train.py --timesteps 100000 --algo dqn --no-dueling --no-prioritized
```

### 7.3 Model Checkpointing

| File | Description |
|---|---|
| `checkpoints/best_model.pt` | Highest single-episode reward model |
| `checkpoints/final_model.pt` | Model from final training step |
| `checkpoints/top_ep*.pt` | Top-5 models by episode reward |
| `checkpoints/checkpoint_*.pt` | Periodic checkpoints every 10K steps |
| `checkpoints/training_log.json` | Full training history (per-episode metrics) |

### 7.4 Evaluation Metrics

| Metric | Symbol | Formula | Target |
|---|---|---|---|
| Detection Probability | P_d | total_hits / total_active_channels | → 1.0 |
| False Alarm Rate | P_fa | false_alarms / total_scans | → 0.0 |
| Intercept Rate | — | hits / total_hops | > 0.4 |
| Episode Reward | R | Σ shaped rewards | Maximize |

---

## 8. API Reference

### 8.1 REST Endpoints

#### `POST /api/scan/start`
Starts the scan simulation and inference loop.

**Response:**
```json
{
  "status": "started",
  "message": "Scan started successfully",
  "data": { "session_id": "uuid-string" }
}
```

#### `POST /api/scan/stop`
Stops the active scan.

**Response:**
```json
{
  "status": "stopped",
  "message": "Scan stopped",
  "data": { "session_id": "...", "total_hops": 1500, "final_pd": 0.73 }
}
```

#### `POST /api/scan/config`
Updates runtime scan configuration.

**Request Body:**
```json
{
  "num_channels": 12,
  "freq_min_ghz": 2.0,
  "freq_max_ghz": 18.0,
  "detection_threshold_dbm": -50.0,
  "mode": "synthetic",
  "num_emitters": 2
}
```

#### `GET /api/status`
Returns current system state snapshot.

**Response:**
```json
{
  "is_running": true,
  "mode": "synthetic",
  "total_hops": 4523,
  "total_hits": 1892,
  "pd": 0.7234,
  "pfa": 0.0012,
  "session_id": "uuid",
  "connected_clients": 2
}
```

#### `GET /api/analytics`
Returns analytics data including session history and metrics trends.

#### `GET /api/sessions`
Returns all historical scan sessions.

#### `GET /api/model/info`
Returns information about the loaded AI model.

**Response:**
```json
{
  "model_type": "Double DQN + GAT",
  "model_loaded": true,
  "gnn_architecture": "2-Layer GAT (4→128→32)",
  "rl_architecture": "DQN (256→128→N)",
  "config": {
    "channels": 12,
    "gnn_input_dim": 4,
    "gnn_output_dim": 32,
    "dqn_learning_rate": 0.001,
    "dqn_gamma": 0.99,
    "epsilon": 0.05
  }
}
```

#### `GET /api/health`
Health check endpoint.

### 8.2 WebSocket Stream

**Endpoint:** `ws://localhost:8000/ws/stream`

Broadcasts JSON frames at **30 FPS** with the following structure:

```json
{
  "timestamp": 1725782400.123,
  "channel_powers": [-82.3, -45.1, -88.7, ...],
  "channel_freqs_ghz": [2.0, 3.45, 4.91, ...],
  "active_target_ch": [3, 7],
  "tuned_ch": 3,
  "is_hit": true,
  "pd": 0.7234,
  "pfa": 0.0012,
  "total_hops": 4523,
  "total_hits": 1892,
  "reward": 10.0,
  "episode_reward": 245.3,
  "is_running": true
}
```

**Client Limit:** Maximum 10 concurrent WebSocket connections.

---

## 9. Configuration Reference

All configuration lives in `backend/app/config.py` and can be overridden via environment variables.

### Frequency Band

| Parameter | Default | Env Var | Description |
|---|---|---|---|
| `NUM_CHANNELS` | 12 | `EW_NUM_CHANNELS` | Number of frequency channels |
| `FREQ_MIN_GHZ` | 2.0 | `EW_FREQ_MIN_GHZ` | Lower band edge (GHz) |
| `FREQ_MAX_GHZ` | 18.0 | `EW_FREQ_MAX_GHZ` | Upper band edge (GHz) |
| `CHANNEL_BANDWIDTH_MHZ` | 500 | — | Per-channel bandwidth |

### Signal Parameters

| Parameter | Default | Env Var | Description |
|---|---|---|---|
| `NOISE_FLOOR_DBM` | -90.0 | `EW_NOISE_FLOOR` | Baseline noise level |
| `NOISE_VARIANCE_DB` | 5.0 | — | AWGN spread |
| `SIGNAL_POWER_MIN_DBM` | -30.0 | — | Weakest emitter signal |
| `SIGNAL_POWER_MAX_DBM` | -10.0 | — | Strongest emitter signal |
| `DETECTION_THRESHOLD_DBM` | -50.0 | `EW_DETECTION_THRESHOLD` | Detection threshold |

### API Settings

| Parameter | Default | Env Var | Description |
|---|---|---|---|
| `WS_BROADCAST_FPS` | 30 | `EW_WS_FPS` | WebSocket frame rate |
| `API_HOST` | 0.0.0.0 | `EW_API_HOST` | Server bind address |
| `API_PORT` | 8000 | `EW_API_PORT` | Server port |
| `MAX_WS_CLIENTS` | 10 | `EW_MAX_WS_CLIENTS` | Max concurrent WS clients |

### GNN Architecture

| Parameter | Default | Description |
|---|---|---|
| `GNN_INPUT_DIM` | 4 | Node feature dimension |
| `GNN_HIDDEN_DIM` | 32 | Hidden layer dimension (×4 heads = 128) |
| `GNN_HEADS` | 4 | Number of attention heads |
| `GNN_OUTPUT_DIM` | 32 | Output embedding dimension |
| `GNN_DROPOUT` | 0.3 | Dropout rate |

### RL Hyperparameters

| Parameter | Default | Description |
|---|---|---|
| `DQN_LEARNING_RATE` | 1e-3 | Adam optimizer learning rate |
| `DQN_BUFFER_SIZE` | 50,000 | Replay buffer capacity |
| `DQN_BATCH_SIZE` | 64 | Training batch size |
| `DQN_GAMMA` | 0.99 | Discount factor |
| `DQN_TAU` | 0.005 | Soft update coefficient |
| `DQN_EPSILON_START` | 1.0 | Initial exploration rate |
| `DQN_EPSILON_END` | 0.05 | Final exploration rate |
| `DQN_EPSILON_DECAY_STEPS` | 10,000 | Epsilon decay duration |

---

## 10. Deployment

### 10.1 Local Development

```bash
# Terminal 1: Backend
cd smart-scan-ew/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd smart-scan-ew/frontend
npm install
npm run dev

# Open http://localhost:5173
```

### 10.2 Docker Compose

```bash
cd smart-scan-ew
docker-compose up --build
```

This starts two containers:

| Service | Port | Description |
|---|---|---|
| `backend` | 8000 | FastAPI + AI Engine |
| `frontend` | 5173 | Vite dev server |

### 10.3 Demo Mode

```bash
cd smart-scan-ew
python demo.py
```

Runs a guided 5-stage demonstration:

| Stage | Duration | Description |
|---|---|---|
| 1. System Boot | ~5s | Initializes all components with narrated output |
| 2. Random Baseline | ~30s | Shows poor performance without AI |
| 3. AI Takeover | ~30s | RL heuristic agent dramatically improves interception |
| 4. Stress Test | ~30s | 3 simultaneous emitters test adaptation |
| 5. Results | — | Side-by-side comparison of all strategies |

---

## 11. Project Structure

```
smart-scan-ew/
│
├── backend/                          # Python backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI entrypoint (REST + WebSocket)
│   │   ├── config.py                 # Central configuration (Pydantic)
│   │   ├── state_manager.py          # Thread-safe shared state
│   │   ├── logger.py                 # Structured logging
│   │   └── exceptions.py            # Custom exceptions
│   ├── dsp/
│   │   ├── rf_simulator.py           # FHSS emitter simulation (Markov)
│   │   └── sdr_interface.py          # SDR abstraction (Sim + Hardware stub)
│   └── requirements.txt
│
├── ai_engine/                        # AI/ML components
│   ├── __init__.py
│   ├── env/
│   │   ├── __init__.py
│   │   └── spectrum_env.py           # Custom Gymnasium environment
│   ├── models/
│   │   ├── __init__.py
│   │   ├── gnn_embedder.py           # 2-layer GAT (PyTorch Geometric)
│   │   └── rl_policy.py              # Dueling DQN + PER + NoisyNet
│   ├── train.py                      # Training pipeline (DQN / SB3)
│   └── inference.py                  # Live inference runner
│
├── frontend/                         # React SPA
│   ├── src/
│   │   ├── main.jsx                  # React entry point
│   │   ├── App.jsx                   # Root component + router
│   │   ├── index.css                 # Global styles (Tailwind)
│   │   ├── components/
│   │   │   ├── WaterfallPlot.jsx     # Canvas-based 2D spectrogram
│   │   │   ├── MetricsPanel.jsx      # Pd, Pfa, intercepts, efficiency
│   │   │   ├── ControlPanel.jsx      # Start/Stop, mode, config controls
│   │   │   ├── GNNVisualizer.jsx     # GNN graph visualization
│   │   │   └── Navbar.jsx            # Navigation bar
│   │   ├── hooks/
│   │   │   └── useWebSocket.js       # Auto-reconnect WS consumer
│   │   └── pages/
│   │       ├── LandingPage.jsx       # Hero / entry page
│   │       ├── DashboardPage.jsx     # Main operational dashboard
│   │       ├── AnalyticsPage.jsx     # Historical analytics
│   │       └── SettingsPage.jsx      # System configuration
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── demo.py                           # One-click guided demo
├── docker-compose.yml                # Multi-container orchestration
├── Dockerfile.backend                # Backend container
├── Dockerfile.frontend               # Frontend container
└── README.md                         # Quick-start guide
```

---

## 📜 License

Team HORIZON — Smart Innovation Hackathon 2026 (SIH26055)
