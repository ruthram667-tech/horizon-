"""
Smart Scan EW — FastAPI Backend (Enhanced)
============================================
Main entrypoint for the backend server.
Serves REST API endpoints, WebSocket streaming, and manages
the simulation/inference loop in background tasks.

Enhanced with:
- Structured logging
- Proper error handling
- Session management
- Analytics endpoints
- WebSocket client tracking
"""

import asyncio
import json
import time
import os
import sys
import threading
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add parent path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import (
    ScanConfig, NUM_CHANNELS, WS_BROADCAST_FPS,
    CHANNEL_FREQS_GHZ, MAX_WS_CLIENTS, API_HOST, API_PORT,
)
from app.state_manager import SystemState
from app.logger import setup_logging, get_logger
from app.exceptions import ScanAlreadyRunning, ScanNotRunning, WebSocketLimitExceeded
from dsp.sdr_interface import SimulatedSDR

# Add ai_engine to path
ai_engine_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'ai_engine')
sys.path.insert(0, ai_engine_path)

# Setup logging
root_logger = setup_logging("INFO")
log = get_logger("api")


# ──────────────────────────────────────────────
# Global State
# ──────────────────────────────────────────────
system_state = SystemState()
sdr: Optional[SimulatedSDR] = None
inference_runner = None
scan_task: Optional[asyncio.Task] = None
connected_clients: List[WebSocket] = []
client_ids: Dict[str, WebSocket] = {}


# ──────────────────────────────────────────────
# Lifespan
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    log.info("=" * 55)
    log.info("  Smart Scan EW — Electronic Warfare Support System")
    log.info(f"  Backend server starting on {API_HOST}:{API_PORT}")
    log.info(f"  WebSocket FPS: {WS_BROADCAST_FPS} | Max clients: {MAX_WS_CLIENTS}")
    log.info("=" * 55)
    yield
    # Shutdown
    if scan_task and not scan_task.done():
        scan_task.cancel()
        log.info("Scan task cancelled during shutdown")
    log.info("Server shutting down")


# ──────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────
app = FastAPI(
    title="Smart Scan EW",
    description="Electronic Warfare Support System — Smart Scan Strategy (SIH26055)",
    version="2.0.0",
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
# Global Exception Handler
# ──────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return structured error response."""
    log.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error",
            "detail": str(exc),
        },
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
    sim_log = get_logger("simulation")
    sim_log.info(f"Simulation loop started ({WS_BROADCAST_FPS} FPS)")

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
        sim_log.info("Simulation loop cancelled")
        raise


# ──────────────────────────────────────────────
# Response Models
# ──────────────────────────────────────────────

class ApiResponse(BaseModel):
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None

class StatusResponse(BaseModel):
    is_running: bool
    mode: str
    total_hops: int
    total_hits: int
    pd: float
    pfa: float
    session_id: Optional[str] = None
    connected_clients: int = 0


# ──────────────────────────────────────────────
# REST API Endpoints
# ──────────────────────────────────────────────

@app.post("/api/scan/start", response_model=ApiResponse)
async def start_scan():
    """Start the scan simulation and inference loop."""
    global scan_task, sdr, inference_runner, system_state

    if scan_task and not scan_task.done():
        log.warning("Start scan requested but scan is already running")
        return ApiResponse(status="already_running", message="Scan is already running")

    # Reset state
    system_state.reset_all()

    # Start session
    session_id = system_state.start_session(mode=system_state.mode)

    # Initialize SDR simulator
    sdr = SimulatedSDR(num_channels=system_state.num_channels, num_emitters=2)
    log.info(f"SDR simulator initialized ({system_state.num_channels} channels, 2 emitters)")

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
        log.info(f"Inference runner initialized (model: {model_path})")
    except Exception as e:
        log.warning(f"Inference runner init failed: {e}")
        log.info("Using random scan fallback")
        inference_runner = None

    # Start simulation loop
    scan_task = asyncio.create_task(simulation_loop())
    system_state.is_running = True

    return ApiResponse(
        status="started",
        message="Scan started successfully",
        data={"session_id": session_id},
    )


@app.post("/api/scan/stop", response_model=ApiResponse)
async def stop_scan():
    """Stop the scan simulation."""
    global scan_task, inference_runner

    if not scan_task or scan_task.done():
        log.warning("Stop scan requested but no scan is running")
        return ApiResponse(status="not_running", message="No scan is currently running")

    # Cancel task
    scan_task.cancel()
    try:
        await scan_task
    except asyncio.CancelledError:
        pass

    scan_task = None
    if inference_runner:
        inference_runner.stop()
        inference_runner = None

    # End session
    session = system_state.end_session()
    system_state.is_running = False

    return ApiResponse(
        status="stopped",
        message="Scan stopped",
        data=session.model_dump() if session else None,
    )


@app.post("/api/scan/config", response_model=ApiResponse)
async def update_config(config: ScanConfig):
    """Update scan configuration at runtime."""
    global system_state, sdr

    log.info(f"Config update: channels={config.num_channels}, mode={config.mode}")

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

    return ApiResponse(
        status="configured",
        message=f"Config updated: {config.num_channels}ch, mode={config.mode}",
        data={"num_channels": config.num_channels, "mode": config.mode},
    )


@app.get("/api/status", response_model=StatusResponse)
async def get_status():
    """Get current system state snapshot."""
    return StatusResponse(
        is_running=system_state.is_running,
        mode=system_state.mode,
        total_hops=system_state.total_hops,
        total_hits=system_state.total_hits,
        pd=round(system_state.pd, 4),
        pfa=round(system_state.pfa, 4),
        session_id=system_state._current_session_id,
        connected_clients=len(connected_clients),
    )


@app.get("/api/analytics")
async def get_analytics():
    """Get analytics data including session history and metrics trends."""
    return system_state.get_analytics()


@app.get("/api/sessions")
async def get_sessions():
    """Get all historical scan sessions."""
    return {"sessions": system_state.get_session_history()}


@app.get("/api/model/info")
async def get_model_info():
    """Get information about the loaded AI model."""
    model_path = os.path.join(ai_engine_path, "checkpoints", "best_model.pt")
    model_exists = os.path.exists(model_path)

    return {
        "model_type": "Double DQN + GAT" if model_exists else "Heuristic Fallback",
        "model_path": model_path if model_exists else None,
        "model_loaded": inference_runner is not None,
        "gnn_architecture": "2-Layer GAT (4→128→32)",
        "rl_architecture": "DQN (256→128→N)",
        "config": {
            "channels": system_state.num_channels,
            "gnn_input_dim": 4,
            "gnn_output_dim": 32,
            "dqn_learning_rate": 1e-3,
            "dqn_gamma": 0.99,
            "epsilon": 0.05,
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "smart-scan-ew",
        "version": "2.0.0",
        "uptime_scan": system_state.is_running,
        "connected_clients": len(connected_clients),
    }


# ──────────────────────────────────────────────
# WebSocket Streaming
# ──────────────────────────────────────────────

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Real-time WebSocket stream broadcasting scan telemetry at 30 FPS.
    Sends JSON payloads with channel powers, tuner position, hits, and metrics.
    """
    # Check client limit
    if len(connected_clients) >= MAX_WS_CLIENTS:
        log.warning(f"WebSocket connection rejected (max {MAX_WS_CLIENTS} clients)")
        await websocket.close(code=1013, reason="Max clients exceeded")
        return

    await websocket.accept()
    connected_clients.append(websocket)
    ws_log = get_logger("websocket")
    ws_log.info(f"Client connected (total: {len(connected_clients)})")

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
        ws_log.error(f"WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        ws_log.info(f"Client disconnected (remaining: {len(connected_clients)})")


# ──────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level="info",
    )
