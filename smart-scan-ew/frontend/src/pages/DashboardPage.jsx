/**
 * Smart Scan EW — Dashboard Page (Simplified Arctic Teal)
 * =========================================================
 * Clean tactical dashboard with:
 * - Top control bar (Start/Stop, mode, connection status)
 * - Center waterfall spectrogram (full width, main visual)
 * - Bottom compact metrics strip (Pd, Pfa, Intercepts, Efficiency)
 *
 * GNN Visualizer and Spectrum Analyzer removed for clarity.
 * Team HORIZON — SIH26055
 */

import React from 'react';
import WaterfallPlot from '../components/WaterfallPlot';
import MetricsPanel from '../components/MetricsPanel';
import ControlPanel from '../components/ControlPanel';

export default function DashboardPage({ data, isConnected, isRunning }) {
  return (
    <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden animate-fade-in">
      {/* ── Top: Compact Control Bar ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <ControlPanel isConnected={isConnected} isRunning={isRunning} />
      </div>

      {/* ── Center: Full-Width Waterfall Spectrogram ── */}
      <div className="flex-1 px-4 min-h-0">
        <WaterfallPlot data={data} />
      </div>

      {/* ── Bottom: Compact Metrics Strip ── */}
      <div className="flex-shrink-0 px-4 pb-3 pt-2">
        <MetricsPanel data={data} />
      </div>
    </div>
  );
}
