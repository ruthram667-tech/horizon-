# ⚡ Smart Scan Strategy for Electronic Warfare

**Team HORIZON — SIH26055**

AI-powered Electronic Warfare Support (ES) system that intercepts fast-hopping FHSS radio signals without prior intelligence, using Graph Neural Networks and Reinforcement Learning.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  RF Simulator│────▶│  GNN Embedder   │────▶│   RL Agent (DQN) │
│  (FHSS/AWGN)│     │  (2-layer GAT)  │     │   Tuning Policy  │
└─────────────┘     └─────────────────┘     └────────┬─────────┘
       │                                              │
       ▼                                              ▼
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ State Manager│◀───│  Inference Loop  │◀───│  Gymnasium Env   │
│ (Thread-safe)│     │  (30 FPS)       │     │  (SpectrumScan)  │
└──────┬──────┘     └─────────────────┘     └──────────────────┘
       │
       ▼
┌──────────────┐    ┌──────────────────────────────────────────┐
│ FastAPI + WS  │───▶│  React Dashboard (Waterfall + Metrics)   │
│ (REST + 30fps)│    │  Canvas + Tailwind + Glassmorphism       │
└──────────────┘    └──────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip

### 1. Install Backend Dependencies
```bash
cd smart-scan-ew/backend
pip install -r requirements.txt
```

### 2. Start the Backend Server
```bash
cd smart-scan-ew/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Install & Start the Frontend
```bash
cd smart-scan-ew/frontend
npm install
npm run dev
```

### 4. Open the Dashboard
Navigate to **http://localhost:5173** and click **START SCAN**.

---

## 🎬 Demo Session (Recommended for Presentations)

Run the guided demo that showcases all system capabilities:

```bash
cd smart-scan-ew
python demo.py
```

The demo runs through 5 stages:
1. **System Boot** — Initializes all components with narrated output
2. **Random Baseline** — Shows poor performance without AI
3. **AI Takeover** — RL heuristic agent dramatically improves interception
4. **Stress Test** — 3 simultaneous emitters test adaptation
5. **Results** — Side-by-side comparison of all strategies

Options:
```bash
python demo.py --headless          # No browser auto-open
python demo.py --stage 3           # Jump to specific stage
python demo.py --duration 120      # Custom duration
```

---

## 🧠 Training the RL Agent

```bash
cd smart-scan-ew/ai_engine

# Native PyTorch DQN (recommended for quick training)
python train.py --timesteps 100000 --algo dqn

# Stable-Baselines3 DQN
python train.py --timesteps 50000 --algo sb3-dqn

# Stable-Baselines3 PPO
python train.py --timesteps 50000 --algo sb3-ppo
```

Trained models are saved to `ai_engine/checkpoints/`.

---

## 📁 Project Structure

```
smart-scan-ew/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint, CORS, REST & WebSocket
│   │   ├── config.py            # System constants, Pydantic models
│   │   └── state_manager.py     # Thread-safe shared state container
│   ├── dsp/
│   │   ├── rf_simulator.py      # Synthetic FHSS emitter (Markov hopping)
│   │   └── sdr_interface.py     # Abstract SDR (Simulated / SoapySDR stub)
│   └── requirements.txt
├── ai_engine/
│   ├── env/
│   │   └── spectrum_env.py      # Custom Gymnasium RF scanning environment
│   ├── models/
│   │   ├── gnn_embedder.py      # 2-layer GAT (PyTorch Geometric)
│   │   └── rl_policy.py         # DQN policy + SB3 feature extractor
│   ├── train.py                 # Training pipeline (DQN / PPO)
│   └── inference.py             # Live inference runner
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main dashboard + spectrum analyzer
│   │   ├── components/
│   │   │   ├── WaterfallPlot.jsx  # Canvas-based 2D spectrogram
│   │   │   ├── MetricsPanel.jsx   # Pd, Pfa, intercepts, efficiency
│   │   │   └── ControlPanel.jsx   # Start/Stop, mode, channel config
│   │   └── hooks/
│   │       └── useWebSocket.js    # Auto-reconnect WS consumer
│   ├── package.json
│   └── tailwind.config.js
└── demo.py                      # One-click guided demo session
```

---

## 🔑 Key Technical Details

| Component | Technology | Details |
|-----------|-----------|---------|
| RF Simulation | NumPy | Markov FHSS with evolving transition matrices |
| Graph Neural Network | PyTorch Geometric | 2-layer GAT: 4→128→32 node embeddings |
| RL Agent | PyTorch + SB3 | Double DQN with replay buffer, ε-greedy |
| Gymnasium Env | Gymnasium | Custom env: GNN obs + multi-component reward |
| Backend API | FastAPI | REST + WebSocket at 30 FPS |
| Frontend | React + Vite | Canvas waterfall + Tailwind glassmorphism |

### Reward Function
- **+10.0** — Intercept hit (tuned to active emitter)
- **−1.0** — Empty/noise scan
- **−5.0** — Per missed active channel
- **−0.3·|Δf|** — Switching penalty (tuning delay cost)

---

## 📜 License
Team HORIZON — Smart Innovation Hackathon 2026 (SIH26055)
