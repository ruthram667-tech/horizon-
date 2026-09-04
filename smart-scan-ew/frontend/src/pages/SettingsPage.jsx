/**
 * Smart Scan EW — Settings Page
 * ===============================
 * System configuration, model selection, and health monitoring.
 */

import React, { useState, useCallback } from 'react';

const API_BASE = `http://${window.location.hostname}:8000`;

export default function SettingsPage({ isConnected, isRunning }) {
  const [mode, setMode] = useState('synthetic');
  const [channelCount, setChannelCount] = useState(12);
  const [emitterCount, setEmitterCount] = useState(2);
  const [threshold, setThreshold] = useState(-50);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      const res = await fetch(`${API_BASE}/api/scan/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          num_channels: channelCount,
          num_emitters: emitterCount,
          detection_threshold_dbm: threshold,
        }),
      });
      const data = await res.json();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      console.error('[Settings] Save error:', e);
      setSaveStatus('error');
    }
    setSaving(false);
  }, [mode, channelCount, emitterCount, threshold]);

  return (
    <div className="min-h-[calc(100vh-57px)] p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
          <p className="text-sm text-gray-400">Configure scan parameters, model settings, and view system health</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Scan Configuration ── */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
              <span className="text-tactical-400">◆</span>
              Scan Configuration
            </h3>

            <div className="space-y-5">
              {/* Mode */}
              <div>
                <label className="stat-label block mb-2">Scan Mode</label>
                <div className="flex rounded-xl overflow-hidden border border-surface-600/30">
                  <button
                    onClick={() => setMode('synthetic')}
                    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200
                      ${mode === 'synthetic'
                        ? 'bg-tactical-600/20 text-tactical-400 border-r border-tactical-500/30'
                        : 'bg-surface-700/30 text-gray-500 hover:bg-surface-600/30 border-r border-surface-600/30'
                      }`}
                  >
                    📡 Synthetic
                  </button>
                  <button
                    onClick={() => setMode('hardware')}
                    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200
                      ${mode === 'hardware'
                        ? 'bg-radar-600/20 text-radar-400'
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
                  value={channelCount}
                  onChange={(e) => setChannelCount(parseInt(e.target.value))}
                  className="w-full bg-surface-700/50 border border-surface-600/30 rounded-xl px-4 py-3
                             text-sm text-gray-200 font-mono
                             focus:outline-none focus:ring-2 focus:ring-tactical-500/30 focus:border-tactical-500/30
                             appearance-none cursor-pointer transition-all duration-200"
                >
                  <option value={8}>8 Channels (2–18 GHz)</option>
                  <option value={10}>10 Channels (2–18 GHz)</option>
                  <option value={12}>12 Channels (2–18 GHz)</option>
                  <option value={16}>16 Channels (2–18 GHz)</option>
                  <option value={20}>20 Channels (2–18 GHz)</option>
                </select>
              </div>

              {/* Emitter Count */}
              <div>
                <label className="stat-label block mb-2">Number of Emitters</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={emitterCount}
                    onChange={(e) => setEmitterCount(parseInt(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #00e693 0%, #00e693 ${(emitterCount - 1) / 4 * 100}%, rgba(33,46,69,0.8) ${(emitterCount - 1) / 4 * 100}%, rgba(33,46,69,0.8) 100%)`,
                    }}
                  />
                  <span className="text-sm font-mono text-tactical-400 w-6 text-right">{emitterCount}</span>
                </div>
              </div>

              {/* Detection Threshold */}
              <div>
                <label className="stat-label block mb-2">Detection Threshold (dBm)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={-80}
                    max={-20}
                    step={5}
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(threshold + 80) / 60 * 100}%, rgba(33,46,69,0.8) ${(threshold + 80) / 60 * 100}%, rgba(33,46,69,0.8) 100%)`,
                    }}
                  />
                  <span className="text-sm font-mono text-amber-400 w-16 text-right">{threshold} dBm</span>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full btn-primary mt-2 flex items-center justify-center gap-2 ${saving ? 'opacity-50' : ''}`}
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>✓ Saved</>
                ) : saveStatus === 'error' ? (
                  <>✕ Error — Try Again</>
                ) : (
                  <>Apply Configuration</>
                )}
              </button>
            </div>
          </div>

          {/* ── System Health ── */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="text-radar-400">◆</span>
                System Health
              </h3>

              <div className="space-y-4">
                {/* Backend Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-700/30 border border-surface-600/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-tactical-400' : 'bg-red-500'}`}
                      style={{ boxShadow: isConnected ? '0 0 8px rgba(0,230,147,0.5)' : '0 0 8px rgba(239,68,68,0.5)' }} />
                    <span className="text-sm text-gray-300">Backend Server</span>
                  </div>
                  <span className={`text-xs font-mono ${isConnected ? 'text-tactical-400' : 'text-red-400'}`}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* WebSocket */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-700/30 border border-surface-600/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-tactical-400' : 'bg-gray-600'}`}
                      style={{ boxShadow: isConnected ? '0 0 8px rgba(0,230,147,0.5)' : 'none' }} />
                    <span className="text-sm text-gray-300">WebSocket Stream</span>
                  </div>
                  <span className={`text-xs font-mono ${isConnected ? 'text-tactical-400' : 'text-gray-500'}`}>
                    {isConnected ? '30 FPS' : 'DISCONNECTED'}
                  </span>
                </div>

                {/* Scan Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-700/30 border border-surface-600/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-tactical-400 animate-pulse' : 'bg-gray-600'}`} />
                    <span className="text-sm text-gray-300">Scan Engine</span>
                  </div>
                  <span className={`text-xs font-mono ${isRunning ? 'text-tactical-400' : 'text-gray-500'}`}>
                    {isRunning ? 'ACTIVE' : 'IDLE'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Model Info ── */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="text-purple-400">◆</span>
                AI Model Info
              </h3>

              <div className="space-y-3">
                {[
                  { label: 'Algorithm', value: 'Double DQN + GAT' },
                  { label: 'GNN Architecture', value: '2-Layer GAT (4→128→32)' },
                  { label: 'RL Network', value: '256→128→N Q-values' },
                  { label: 'Exploration', value: 'ε-greedy → 0.05' },
                  { label: 'Replay Buffer', value: '50,000 transitions' },
                  { label: 'Learning Rate', value: '1e-3' },
                  { label: 'Gamma (γ)', value: '0.99' },
                  { label: 'Target Update', value: 'Soft τ=0.005' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-xs py-1">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="text-gray-300 font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Band Info ── */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="text-amber-400">◆</span>
                Frequency Band
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Band', value: '2.0 – 18.0 GHz' },
                  { label: 'Bandwidth', value: '500 MHz / channel' },
                  { label: 'Noise Floor', value: '-90 dBm' },
                  { label: 'Signal Range', value: '-30 to -10 dBm' },
                  { label: 'Update Rate', value: '30 FPS' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-xs py-1">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="text-gray-300 font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
