/**
 * Smart Scan EW — Control Panel (Arctic Teal — Compact Inline)
 * ==============================================================
 * Compact single-row control bar with Start/Stop, mode toggle,
 * channel count, and connection status. Fits in dashboard top bar.
 * Teal / Coral palette.
 */

import React, { useState, useCallback } from 'react';

const API_BASE = `http://${window.location.hostname}:8000`;

export default function ControlPanel({ isConnected, isRunning }) {
  const [scanActive, setScanActive] = useState(false);
  const [mode, setMode] = useState('synthetic');
  const [channelCount, setChannelCount] = useState(12);
  const [loading, setLoading] = useState(false);

  const running = isRunning || scanActive;

  const handleStartStop = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = running ? '/api/scan/stop' : '/api/scan/start';
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST' });
      const data = await res.json();
      console.log('[API]', data);
      setScanActive(!running);
    } catch (e) {
      console.error('[API] Error:', e);
    }
    setLoading(false);
  }, [running]);

  const handleModeChange = useCallback(async (newMode) => {
    setMode(newMode);
    try {
      await fetch(`${API_BASE}/api/scan/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode, num_channels: channelCount }),
      });
    } catch (e) {
      console.error('[API] Config error:', e);
    }
  }, [channelCount]);

  const handleChannelChange = useCallback(async (count) => {
    const num = parseInt(count);
    setChannelCount(num);
    try {
      await fetch(`${API_BASE}/api/scan/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, num_channels: num }),
      });
    } catch (e) {
      console.error('[API] Config error:', e);
    }
  }, [mode]);

  return (
    <div className="glass-card px-4 py-2.5 flex items-center justify-between gap-4 border border-base-600/30">
      {/* Left: Start/Stop + Mode */}
      <div className="flex items-center gap-3">
        {/* Start / Stop Button */}
        <button
          id="btn-start-stop"
          onClick={handleStartStop}
          disabled={loading}
          className={`${running ? 'btn-stop' : 'btn-start'} px-5 py-2 text-xs font-bold uppercase tracking-wider ${loading ? 'opacity-50 cursor-wait' : ''}`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : running ? (
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-white rounded-sm" />
              STOP INTERCEPT
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="w-0 h-0 border-l-[7px] border-l-base-950 border-y-[4.5px] border-y-transparent" />
              START INTERCEPT
            </span>
          )}
        </button>

        {/* Mode Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-base-600/30 bg-base-900/60 p-0.5">
          <button
            id="btn-mode-synthetic"
            onClick={() => handleModeChange('synthetic')}
            className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all duration-200
              ${mode === 'synthetic'
                ? 'bg-teal-400/15 text-teal-300 shadow-sm border border-teal-400/30'
                : 'text-sage-400 hover:text-white'
              }`}
          >
            Synthetic RF
          </button>
          <button
            id="btn-mode-hardware"
            onClick={() => handleModeChange('hardware')}
            className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all duration-200
              ${mode === 'hardware'
                ? 'bg-coral-400/15 text-coral-300 shadow-sm border border-coral-400/30'
                : 'text-sage-400 hover:text-white'
              }`}
          >
            Hardware SDR
          </button>
        </div>

        {/* Channel Count */}
        <select
          id="select-channels"
          value={channelCount}
          onChange={(e) => handleChannelChange(e.target.value)}
          className="bg-base-800/60 border border-base-600/40 rounded-xl px-3 py-1.5
                     text-xs text-sage-200 font-mono font-medium
                     focus:outline-none focus:ring-1 focus:ring-teal-500/30
                     appearance-none cursor-pointer transition-all duration-200"
        >
          <option value={8}>8 Channels</option>
          <option value={10}>10 Channels</option>
          <option value={12}>12 Channels</option>
          <option value={16}>16 Channels</option>
        </select>
      </div>

      {/* Right: System Telemetry */}
      <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums text-sage-400">
        <span className="hidden lg:inline"><span className="text-sage-500">Band:</span> 2.0–18.0 GHz</span>
        <span className="text-teal-400/90 font-medium">Double DQN + GAT</span>
        <span className="hidden sm:inline text-sage-500">2 FPS Stream</span>
        <div className="flex items-center gap-1.5 bg-base-900/60 px-2.5 py-1 rounded-full border border-base-600/30">
          <div className={isConnected ? 'connection-dot-connected' : 'connection-dot-disconnected'} style={{ width: 6, height: 6 }} />
          <span className={`text-[10px] font-bold tracking-wider ${isConnected ? 'text-teal-400' : 'text-coral-400'}`}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}
