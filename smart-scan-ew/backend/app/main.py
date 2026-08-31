"""
Smart Scan EW — FastAPI Backend
================================
Main entrypoint for the backend server.
Serves REST API endpoints, WebSocket streaming, and manages
the simulation/inference loop in background tasks.
"""

import asyncio
import json
import time
import os
import sys
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Add parent path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import ScanConfig, NUM_CHANNELS, WS_BROADCAST_FPS, CHANNEL_FREQS_GHZ
from app.state_manager import SystemState
from dsp.sdr_interface import SimulatedSDR

# Add ai_engine to path
ai_engine_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'ai_engine')
sys.path.insert(0, ai_engine_path)


# ──────────────────────────────────────────────
# Global State
# ──────────────────────────────────────────────
system_state = SystemState()
sdr: Optional[SimulatedSDR] = None
inference_runner = None
scan_task: Optional[asyncio.Task] = None
connected_clients: list = []


# ──────────────────────────────────────────────
# Lifespan
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    print("\n" + "=" * 60)
    print("  🛡️  Smart Scan EW — Electronic Warfare Support System")
    print("  📡 Backend server starting...")
    print("=" * 60)
    yield
    # Shutdown
    if scan_task and not scan_task.done():
        scan_task.cancel()
    print("  Server shutting down.")


# ──────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────
app = FastAPI(
    title="Smart Scan EW",
    description="Electronic Warfare Support System — Smart Scan Strategy (SIH26055)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Simulation Loop (runs as asyncio task)
# ──────────────────────────────────────────────
async def simulation_loop():
    """
    Main simulation + inference loop.
    Runs at ~30 FPS, advancing the RF simulator and making
    tuning decisions via the inference runner.
    """
    global sdr, inference_runner, system_state

    interval = 1.0 / WS_BROADCAST_FPS

    print(f"  🚀 Simulation loop started ({WS_BROADCAST_FPS} FPS)")

    try:
        while True:
            start = time.time()

            if inference_runner is not None:
                inference_runner.step()
            elif sdr is not None:
                # Fallback: random scanning if no inference runner
                import random
                channel_powers, active_channels = sdr.step()
                tuned = random.randint(0, system_state.num_channels - 1)
                is_hit = tuned in active_channels
                system_state.update(
                    channel_powers=channel_powers,
                    active_target_channels=list(active_channels),
                    tuned_channel=tuned,
                    is_hit=is_hit,
                )

            elapsed = time.time() - start
            sleep_time = max(0, interval - elapsed)
            await asyncio.sleep(sleep_time)

    except asyncio.CancelledError:
        print("  ⏹ Simulation loop cancelled")
        raise


# ──────────────────────────────────────────────
# REST API Endpoints
# ──────────────────────────────────────────────

class StartResponse(BaseModel):
    status: str
    message: str

class StatusResponse(BaseModel):
    is_running: bool
    mode: str
    total_hops: int
    total_hits: int
    pd: float
    pfa: float


@app.post("/api/scan/start", response_model=StartResponse)
async def start_scan():
    """Start the scan simulation and inference loop."""
    global scan_task, sdr, inference_runner, system_state

    if scan_task and not scan_task.done():
        return StartResponse(status="already_running", message="Scan is already running")

    # Reset state
    system_state.reset_all()

    # Initialize SDR simulator
    sdr = SimulatedSDR(num_channels=system_state.num_channels, num_emitters=2)

    # Initialize inference runner
    try:
        from inference import InferenceRunner
        model_path = os.path.join(ai_engine_path, "checkpoints", "best_model.pt")
        inference_runner = InferenceRunner(
            state=system_state,
            sdr=sdr,
            model_path=model_path,
            num_channels=system_state.num_channels,
        )
    except Exception as e:
        print(f"  ⚠ Inference runner init failed: {e}")
        print(f"  → Using random scan fallback")
        inference_runner = None

    # Start simulation loop
    scan_task = asyncio.create_task(simulation_loop())
    system_state.is_running = True

    return StartResponse(status="started", message="Scan started successfully")


@app.post("/api/scan/stop", response_model=StartResponse)
async def stop_scan():
    """Stop the scan simulation."""
    global scan_task, inference_runner

    if scan_task and not scan_task.done():
        scan_task.cancel()
        try:
            await scan_task
        except asyncio.CancelledError:
            pass

    scan_task = None
    if inference_runner:
        inference_runner.stop()
        inference_runner = None
    system_state.is_running = False

    return StartResponse(status="stopped", message="Scan stopped")


@app.post("/api/scan/config", response_model=StartResponse)
async def update_config(config: ScanConfig):
    """Update scan configuration at runtime."""
    global system_state, sdr

    # Update channel count if changed
    if config.num_channels != system_state.num_channels:
        was_running = system_state.is_running
        if was_running:
            await stop_scan()

        system_state = SystemState(num_channels=config.num_channels)
        system_state.mode = config.mode

        if was_running:
            await start_scan()

    system_state.mode = config.mode

    return StartResponse(
        status="configured",
        message=f"Config updated: {config.num_channels}ch, mode={config.mode}"
    )


@app.get("/api/status")
async def get_status():
    """Get current system state snapshot."""
    snapshot = system_state.snapshot()
    snapshot["is_running"] = system_state.is_running
    return snapshot


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "smart-scan-ew"}


# ──────────────────────────────────────────────
# WebSocket Streaming
# ──────────────────────────────────────────────

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Real-time WebSocket stream broadcasting scan telemetry at 30 FPS.
    Sends JSON payloads with channel powers, tuner position, hits, and metrics.
    """
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"  📡 WebSocket client connected (total: {len(connected_clients)})")

    interval = 1.0 / WS_BROADCAST_FPS

    try:
        while True:
            start = time.time()

            # Get current state snapshot
            snapshot = system_state.snapshot()
            snapshot["is_running"] = system_state.is_running

            # Send JSON payload
            await websocket.send_json(snapshot)

            elapsed = time.time() - start
            sleep_time = max(0, interval - elapsed)
            await asyncio.sleep(sleep_time)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"  ⚠ WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        print(f"  📡 WebSocket client disconnected (remaining: {len(connected_clients)})")


# ──────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
