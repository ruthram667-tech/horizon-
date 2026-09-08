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
    <div className="glass-card px-4 py-2.5 flex items-center justify-between gap-4">
      {/* Left: Start/Stop + Mode */}
      <div className="flex items-center gap-3">
        {/* Start / Stop Button */}
        <button
          id="btn-start-stop"
          onClick={handleStartStop}
          disabled={loading}
          className={`${running ? 'btn-stop' : 'btn-start'} px-5 py-2 text-xs ${loading ? 'opacity-50 cursor-wait' : ''}`}
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
              STOP SCAN
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="w-0 h-0 border-l-[8px] border-l-base-900 border-y-[5px] border-y-transparent" />
              START SCAN
            </span>
          )}
        </button>

        {/* Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-base-600/30">
          <button
            id="btn-mode-synthetic"
            onClick={() => handleModeChange('synthetic')}
            className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200
              ${mode === 'synthetic'
                ? 'bg-teal-800/30 text-teal-400 border-r border-teal-500/30'
                : 'bg-base-700/30 text-sage-500 hover:bg-base-600/30 border-r border-base-600/30'
              }`}
          >
            📡 Synthetic
          </button>
          <button
            id="btn-mode-hardware"
            onClick={() => handleModeChange('hardware')}
            className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200
              ${mode === 'hardware'
                ? 'bg-coral-800/30 text-coral-400'
                : 'bg-base-700/30 text-sage-500 hover:bg-base-600/30'
              }`}
          >
            🔌 Hardware
          </button>
        </div>

        {/* Channel Count */}
        <select
          id="select-channels"
          value={channelCount}
          onChange={(e) => handleChannelChange(e.target.value)}
          className="bg-base-700/50 border border-base-600/30 rounded-lg px-2.5 py-1.5
                     text-xs text-sage-200 font-mono
                     focus:outline-none focus:ring-1 focus:ring-teal-500/30
                     appearance-none cursor-pointer transition-all duration-200"
        >
          <option value={8}>8 CH</option>
          <option value={10}>10 CH</option>
          <option value={12}>12 CH</option>
          <option value={16}>16 CH</option>
        </select>
      </div>

      {/* Right: System Info */}
      <div className="flex items-center gap-4 text-[10px] text-sage-500 font-mono">
        <span>Band: 2.0–18.0 GHz</span>
        <span className="text-teal-400">DQN + GAT</span>
        <span>~2 FPS</span>
        <div className="flex items-center gap-1.5">
          <div className={isConnected ? 'connection-dot-connected' : 'connection-dot-disconnected'} style={{ width: 6, height: 6 }} />
          <span className={isConnected ? 'text-teal-400' : 'text-coral-400'}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}
