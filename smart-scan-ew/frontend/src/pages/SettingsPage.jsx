/**
 * Smart Scan EW — Settings Page (Arctic Teal)
 * ===============================================
 * System configuration, model selection, and health monitoring.
 * Teal / Lime / Coral / Sage palette.
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
          <p className="text-sm text-sage-400">Configure scan parameters, model settings, and view system health</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Scan Configuration ── */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
              <span className="text-teal-400">◆</span>
              Scan Configuration
            </h3>

            <div className="space-y-5">
              {/* Mode */}
              <div>
                <label className="stat-label block mb-2">Scan Mode</label>
                <div className="flex rounded-xl overflow-hidden border border-base-600/30">
                  <button
                    onClick={() => setMode('synthetic')}
                    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200
                      ${mode === 'synthetic'
                        ? 'bg-teal-800/20 text-teal-400 border-r border-teal-500/30'
                        : 'bg-base-700/30 text-sage-500 hover:bg-base-600/30 border-r border-base-600/30'
                      }`}
                  >
                    📡 Synthetic
                  </button>
                  <button
                    onClick={() => setMode('hardware')}
                    className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200
                      ${mode === 'hardware'
                        ? 'bg-coral-800/20 text-coral-400'
                        : 'bg-base-700/30 text-sage-500 hover:bg-base-600/30'
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
                  className="select-field"
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
                      background: `linear-gradient(to right, #2dd4a8 0%, #2dd4a8 ${(emitterCount - 1) / 4 * 100}%, rgba(26,60,60,0.8) ${(emitterCount - 1) / 4 * 100}%, rgba(26,60,60,0.8) 100%)`,
                    }}
                  />
                  <span className="text-sm font-mono text-teal-400 w-6 text-right">{emitterCount}</span>
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
                      background: `linear-gradient(to right, #84cc16 0%, #84cc16 ${(threshold + 80) / 60 * 100}%, rgba(26,60,60,0.8) ${(threshold + 80) / 60 * 100}%, rgba(26,60,60,0.8) 100%)`,
                    }}
                  />
                  <span className="text-sm font-mono text-lime-400 w-16 text-right">{threshold} dBm</span>
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
                <span className="text-lime-400">◆</span>
                System Health
              </h3>

              <div className="space-y-4">
                {/* Backend Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-700/30 border border-base-600/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-teal-400' : 'bg-coral-400'}`}
                      style={{ boxShadow: isConnected ? '0 0 8px rgba(45,212,168,0.5)' : '0 0 8px rgba(232,97,77,0.5)' }} />
                    <span className="text-sm text-sage-300">Backend Server</span>
                  </div>
                  <span className={`text-xs font-mono ${isConnected ? 'text-teal-400' : 'text-coral-400'}`}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* WebSocket */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-700/30 border border-base-600/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-teal-400' : 'bg-sage-600'}`}
                      style={{ boxShadow: isConnected ? '0 0 8px rgba(45,212,168,0.5)' : 'none' }} />
                    <span className="text-sm text-sage-300">WebSocket Stream</span>
                  </div>
                  <span className={`text-xs font-mono ${isConnected ? 'text-teal-400' : 'text-sage-500'}`}>
                    {isConnected ? '~2 FPS (Display)' : 'DISCONNECTED'}
                  </span>
                </div>

                {/* Scan Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-700/30 border border-base-600/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-teal-400 animate-pulse' : 'bg-sage-600'}`} />
                    <span className="text-sm text-sage-300">Scan Engine</span>
                  </div>
                  <span className={`text-xs font-mono ${isRunning ? 'text-teal-400' : 'text-sage-500'}`}>
                    {isRunning ? 'ACTIVE' : 'IDLE'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Model Info ── */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="text-coral-400">◆</span>
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
                    <span className="text-sage-500">{item.label}</span>
                    <span className="text-sage-200 font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Band Info ── */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="text-sage-400">◆</span>
                Frequency Band
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Band', value: '2.0 – 18.0 GHz' },
                  { label: 'Bandwidth', value: '500 MHz / channel' },
                  { label: 'Noise Floor', value: '-90 dBm' },
                  { label: 'Signal Range', value: '-30 to -10 dBm' },
                  { label: 'Display Rate', value: '~2 FPS (Slow Scan)' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-xs py-1">
                    <span className="text-sage-500">{item.label}</span>
                    <span className="text-sage-200 font-mono">{item.value}</span>
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
