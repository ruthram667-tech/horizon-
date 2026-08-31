/**
 * Smart Scan EW — Control Panel
 * ===============================
 * Scan controls: Start/Stop, mode toggle, channel count selector,
 * and WebSocket connection status indicator.
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
    <div className="glass-card p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          <span className="text-amber-400 mr-2">◆</span>
          Scan Controls
        </h2>
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={isConnected ? 'connection-dot-connected' : 'connection-dot-disconnected'} />
          <span className="text-xs text-gray-400 font-mono">
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Start / Stop Button */}
        <button
          id="btn-start-stop"
          onClick={handleStartStop}
          disabled={loading}
          className={`w-full ${running ? 'btn-stop' : 'btn-start'} ${loading ? 'opacity-50 cursor-wait' : ''}`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : running ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 bg-white rounded-sm" />
              STOP SCAN
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent" />
              START SCAN
            </span>
          )}
        </button>

        {/* Mode Toggle */}
        <div>
          <label className="stat-label block mb-2">Scan Mode</label>
          <div className="flex rounded-lg overflow-hidden border border-surface-600/30">
            <button
              id="btn-mode-synthetic"
              onClick={() => handleModeChange('synthetic')}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200
                ${mode === 'synthetic'
                  ? 'bg-tactical-600/30 text-tactical-400 border-r border-tactical-500/30'
                  : 'bg-surface-700/30 text-gray-500 hover:bg-surface-600/30 border-r border-surface-600/30'
                }`}
            >
              📡 Synthetic
            </button>
            <button
              id="btn-mode-hardware"
              onClick={() => handleModeChange('hardware')}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200
                ${mode === 'hardware'
                  ? 'bg-radar-600/30 text-radar-400'
                  : 'bg-surface-700/30 text-gray-500 hover:bg-surface-600/30'
                }`}
            >
              🔌 Hardware
            </button>
          </div>
        </div>

        {/* Channel Count */}
        <div>
          <label className="stat-label block mb-2">Channel Count</label>
          <select
            id="select-channels"
            value={channelCount}
            onChange={(e) => handleChannelChange(e.target.value)}
            className="w-full bg-surface-700/50 border border-surface-600/30 rounded-lg px-3 py-2
                       text-sm text-gray-200 font-mono
                       focus:outline-none focus:ring-1 focus:ring-tactical-500/50
                       appearance-none cursor-pointer"
          >
            <option value={8}>8 Channels (2–18 GHz)</option>
            <option value={10}>10 Channels (2–18 GHz)</option>
            <option value={12}>12 Channels (2–18 GHz)</option>
            <option value={16}>16 Channels (2–18 GHz)</option>
          </select>
        </div>

        {/* System Info */}
        <div className="pt-3 border-t border-surface-600/20">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Band</span>
              <span className="text-gray-300 font-mono">2.0 – 18.0 GHz</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Algorithm</span>
              <span className="text-gray-300 font-mono">DQN + GAT</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Update Rate</span>
              <span className="text-gray-300 font-mono">30 FPS</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Mode</span>
              <span className={`font-mono ${mode === 'synthetic' ? 'text-tactical-400' : 'text-radar-400'}`}>
                {mode.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
