/**
 * Smart Scan EW — Dashboard Page (Restructured)
 * ================================================
 * Full tactical dashboard with GNN Visualizer, waterfall spectrogram,
 * metrics panel, control panel, and spectrum analyzer.
 * Layout restructured to showcase GNN processing alongside scanning.
 *
 * Team HORIZON — SIH26055
 */

import React, { useRef, useEffect, useCallback } from 'react';
import WaterfallPlot from '../components/WaterfallPlot';
import MetricsPanel from '../components/MetricsPanel';
import ControlPanel from '../components/ControlPanel';
import GNNVisualizer from '../components/GNNVisualizer';

// ─────────────────────────────────────────────
// Spectrum Analyzer Bar Chart (Canvas-based)
// ─────────────────────────────────────────────
function SpectrumAnalyzer({ data }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const smoothedRef = useRef(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    if (!data || !data.channel_powers) {
      ctx.fillStyle = '#4a5568';
      ctx.font = '13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Spectrum Analyzer — Start scan to see data', w / 2, h / 2);
      animRef.current = requestAnimationFrame(render);
      return;
    }

    const powers = data.channel_powers;
    const numCh = powers.length;
    const tunedCh = data.tuned_ch;
    const activeChs = new Set(data.active_target_ch || []);
    const isHit = data.is_hit;
    const freqs = data.channel_freqs_ghz || [];

    // Smooth transitions
    if (!smoothedRef.current || smoothedRef.current.length !== numCh) {
      smoothedRef.current = [...powers];
    }
    for (let i = 0; i < numCh; i++) {
      smoothedRef.current[i] += (powers[i] - smoothedRef.current[i]) * 0.15; // Slower smoothing
    }
    const smoothed = smoothedRef.current;

    const padding = { left: 50, right: 20, top: 20, bottom: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;
    const barWidth = plotW / numCh * 0.7;
    const barGap = plotW / numCh * 0.3;

    // Power range
    const minPower = -95;
    const maxPower = -5;
    const range = maxPower - minPower;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.textAlign = 'right';

    for (let db = -90; db <= -10; db += 20) {
      const y = padding.top + plotH - ((db - minPower) / range) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${db}`, padding.left - 5, y + 3);
    }

    // Detection threshold line
    const threshY = padding.top + plotH - ((-50 - minPower) / range) * plotH;
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, threshY);
    ctx.lineTo(w - padding.right, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 184, 0, 0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('Threshold', w - padding.right - 55, threshY - 4);

    // Draw bars
    for (let i = 0; i < numCh; i++) {
      const power = smoothed[i];
      const barH = Math.max(2, ((power - minPower) / range) * plotH);
      const x = padding.left + i * (plotW / numCh) + barGap / 2;
      const y = padding.top + plotH - barH;

      // Bar color based on state — warm palette
      let color, glowColor;
      if (i === tunedCh && isHit) {
        color = 'rgba(34, 197, 94, 0.9)';      // Green for hit
        glowColor = 'rgba(34, 197, 94, 0.3)';
      } else if (i === tunedCh) {
        color = 'rgba(255, 184, 0, 0.9)';       // Gold for tuned
        glowColor = 'rgba(255, 184, 0, 0.3)';
      } else if (activeChs.has(i)) {
        color = 'rgba(220, 38, 38, 0.9)';       // Crimson for active target
        glowColor = 'rgba(220, 38, 38, 0.3)';
      } else {
        color = 'rgba(120, 110, 100, 0.45)';    // Warm gray for idle
        glowColor = null;
      }

      // Glow effect
      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
      }

      // Gradient bar with rounded top
      const gradient = ctx.createLinearGradient(x, y, x, padding.top + plotH);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color.replace(/[\d.]+\)$/, '0.15)'));
      ctx.fillStyle = gradient;

      // Rounded top rect
      const bRadius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x + bRadius, y);
      ctx.lineTo(x + barWidth - bRadius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + bRadius);
      ctx.lineTo(x + barWidth, padding.top + plotH);
      ctx.lineTo(x, padding.top + plotH);
      ctx.lineTo(x, y + bRadius);
      ctx.quadraticCurveTo(x, y, x + bRadius, y);
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Bar cap
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '1)');
      ctx.fillRect(x, y, barWidth, 2);

      // Channel label
      ctx.fillStyle = i === tunedCh ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
      ctx.font = `${i === tunedCh ? '600 ' : ''}9px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      const freq = freqs[i] ? freqs[i].toFixed(1) : i;
      ctx.fillText(`${freq}`, x + barWidth / 2, padding.top + plotH + 12);
      ctx.fillText(`GHz`, x + barWidth / 2, padding.top + plotH + 22);

      // Power value on top
      if (power > -60 || i === tunedCh) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px JetBrains Mono';
        ctx.fillText(`${power.toFixed(0)}`, x + barWidth / 2, y - 4);
      }
    }

    // Y-axis label
    ctx.save();
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.translate(12, padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Power (dBm)', 0, 0);
    ctx.restore();

    // Legend — warm palette
    const legendX = padding.left + 10;
    const legendY = padding.top + 8;
    const items = [
      { color: 'rgba(34, 197, 94, 0.9)', label: 'Intercepted' },
      { color: 'rgba(255, 184, 0, 0.9)', label: 'Tuned' },
      { color: 'rgba(220, 38, 38, 0.9)', label: 'Missed' },
    ];
    ctx.font = '9px Outfit, sans-serif';
    items.forEach((item, idx) => {
      const lx = legendX + idx * 90;
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(lx, legendY, 8, 8, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, lx + 12, legendY + 7);
    });

    animRef.current = requestAnimationFrame(render);
  }, [data]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [render]);

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          <span className="text-gold-400 mr-2">◆</span>
          Spectrum Analyzer
        </h2>
        <span className="text-xs text-gray-500 font-mono">
          {data?.channel_powers ? `${data.channel_powers.length} CH | 2.0–18.0 GHz` : '—'}
        </span>
      </div>
      <div className="flex-1 relative rounded-lg overflow-hidden border border-surface-600/20">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// Dashboard Page — Restructured Layout with GNN
// ─────────────────────────────────────────────
export default function DashboardPage({ data, isConnected, isRunning }) {
  return (
    <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden animate-fade-in">
      {/* ── Main Grid ── */}
      <div className="flex-1 grid grid-cols-12 gap-3 p-3 min-h-0">
        {/* Left: GNN Visualizer (5 cols) */}
        <div className="col-span-5 flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <GNNVisualizer data={data} />
          </div>
          <div className="flex-shrink-0">
            <ControlPanel isConnected={isConnected} isRunning={isRunning} />
          </div>
        </div>

        {/* Center: Waterfall (4 cols) */}
        <div className="col-span-4 min-h-0">
          <WaterfallPlot data={data} />
        </div>

        {/* Right: Metrics (3 cols) */}
        <div className="col-span-3 min-h-0">
          <MetricsPanel data={data} />
        </div>
      </div>

      {/* ── Bottom: Spectrum Analyzer ── */}
      <div className="h-[200px] px-3 pb-3 flex-shrink-0">
        <SpectrumAnalyzer data={data} />
      </div>
    </div>
  );
}
