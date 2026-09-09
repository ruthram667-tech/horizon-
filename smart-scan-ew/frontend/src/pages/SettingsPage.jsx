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
    <div className="min-h-[calc(100vh-57px)] p-6 md:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white mb-1.5 tracking-tight">System Configuration</h1>
          <p className="text-xs text-sage-300 font-medium">Configure scanning parameters, algorithmic hyperparameters, and examine live node health</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Scan Configuration ── */}
          <div className="glass-card p-6 border border-base-600/30">
            <h3 className="text-xs font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-teal-400" />
              Scan Parameters
            </h3>

            <div className="space-y-5">
              {/* Mode */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-sage-300 block mb-1.5">RF Ingestion Mode</label>
                <div className="flex rounded-xl overflow-hidden border border-base-600/30 bg-base-900/60 p-0.5">
                  <button
                    onClick={() => setMode('synthetic')}
                    className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200
                      ${mode === 'synthetic'
                        ? 'bg-teal-400/15 text-teal-300 shadow-sm border border-teal-400/30'
                        : 'text-sage-400 hover:text-white'
                      }`}
                  >
                    Synthetic RF
                  </button>
                  <button
                    onClick={() => setMode('hardware')}
                    className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200
                      ${mode === 'hardware'
                        ? 'bg-coral-400/15 text-coral-300 shadow-sm border border-coral-400/30'
                        : 'text-sage-400 hover:text-white'
                      }`}
                  >
                    Hardware SDR
                  </button>
                </div>
              </div>

              {/* Channel Count */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-sage-300 block mb-1.5">Monitored Channel Grid</label>
                <select
                  value={channelCount}
                  onChange={(e) => setChannelCount(parseInt(e.target.value))}
                  className="select-field text-xs"
                >
                  <option value={8}>8 Channels (2.0 – 18.0 GHz)</option>
                  <option value={10}>10 Channels (2.0 – 18.0 GHz)</option>
                  <option value={12}>12 Channels (2.0 – 18.0 GHz)</option>
                  <option value={16}>16 Channels (2.0 – 18.0 GHz)</option>
                  <option value={20}>20 Channels (2.0 – 18.0 GHz)</option>
                </select>
              </div>

              {/* Emitter Count */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-sage-300 block mb-1.5">Active FHSS Emitters</label>
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
                  <span className="text-sm font-mono font-bold text-teal-400 w-6 text-right tabular-nums">{emitterCount}</span>
                </div>
              </div>

              {/* Detection Threshold */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-sage-300 block mb-1.5">Energy Detection Threshold</label>
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
                  <span className="text-sm font-mono font-bold text-lime-400 w-16 text-right tabular-nums">{threshold} dBm</span>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={`w-full btn-primary mt-2 flex items-center justify-center gap-2 py-3 ${saving ? 'opacity-50' : ''}`}
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Applying...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>✓ Parameters Applied</>
                ) : saveStatus === 'error' ? (
                  <>✕ Error Applying Config</>
                ) : (
                  <>Apply Configuration</>
                )}
              </button>
            </div>
          </div>

          {/* ── System Health ── */}
          <div className="space-y-6">
            <div className="glass-card p-6 border border-base-600/30">
              <h3 className="text-xs font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-lime-400" />
                Service Health
              </h3>

              <div className="space-y-3">
                {/* Backend Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-800/40 border border-base-600/25">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-teal-400' : 'bg-coral-400'}`}
                      style={{ boxShadow: isConnected ? '0 0 8px rgba(45,212,168,0.5)' : '0 0 8px rgba(232,97,77,0.5)' }} />
                    <span className="text-xs text-sage-200 font-medium">FastAPI Engine</span>
                  </div>
                  <span className={`text-[11px] font-mono font-bold ${isConnected ? 'text-teal-400' : 'text-coral-400'}`}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* WebSocket */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-800/40 border border-base-600/25">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-teal-400' : 'bg-sage-600'}`}
                      style={{ boxShadow: isConnected ? '0 0 8px rgba(45,212,168,0.5)' : 'none' }} />
                    <span className="text-xs text-sage-200 font-medium">WebSocket Telemetry</span>
                  </div>
                  <span className={`text-[11px] font-mono font-medium ${isConnected ? 'text-teal-400' : 'text-sage-500'}`}>
                    {isConnected ? '2 FPS Realtime' : 'DISCONNECTED'}
                  </span>
                </div>

                {/* Scan Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-base-800/40 border border-base-600/25">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-teal-400 animate-pulse' : 'bg-sage-600'}`} />
                    <span className="text-xs text-sage-200 font-medium">Scanning Node</span>
                  </div>
                  <span className={`text-[11px] font-mono font-bold ${isRunning ? 'text-teal-400' : 'text-sage-400'}`}>
                    {isRunning ? 'ACTIVE SCANNING' : 'STANDBY'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Model Info ── */}
            <div className="glass-card p-6 border border-base-600/30">
              <h3 className="text-xs font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-coral-400" />
                AI Model Specification
              </h3>

              <div className="space-y-2.5">
                {[
                  { label: 'Policy Architecture', value: 'Double DQN + Graph Attention Network' },
                  { label: 'Graph Topology', value: '2-Layer GAT (4 → 128 → 32 Dim)' },
                  { label: 'Q-Network Head', value: '256 → 128 → N Linear Layers' },
                  { label: 'Experience Buffer', value: '50,000 Step Cyclic Buffer' },
                  { label: 'Discount Factor (γ)', value: '0.99' },
                  { label: 'Soft Target Tau (τ)', value: '0.005' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-xs py-1 border-b border-white/[0.03] last:border-0">
                    <span className="text-sage-400 font-medium">{item.label}</span>
                    <span className="text-teal-200 font-mono text-[11px]">{item.value}</span>
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
