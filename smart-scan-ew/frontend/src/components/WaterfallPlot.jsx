/**
 * Smart Scan EW — Waterfall Spectrogram
 * =======================================
 * High-performance real-time 2D waterfall display using HTML5 Canvas.
 * Renders frequency channels (X-axis) vs time (Y-axis, scrolling down)
 * with color-coded power levels and overlay markers.
 */

import React, { useRef, useEffect, useCallback } from 'react';

// Inferno-inspired color palette for PSD visualization
const COLORMAP = [];
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  let r, g, b;
  if (t < 0.25) {
    const s = t / 0.25;
    r = Math.floor(10 + s * 50);
    g = Math.floor(2 + s * 10);
    b = Math.floor(30 + s * 100);
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    r = Math.floor(60 + s * 150);
    g = Math.floor(12 + s * 30);
    b = Math.floor(130 - s * 50);
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    r = Math.floor(210 + s * 40);
    g = Math.floor(42 + s * 150);
    b = Math.floor(80 - s * 70);
  } else {
    const s = (t - 0.75) / 0.25;
    r = Math.floor(250 - s * 10);
    g = Math.floor(192 + s * 63);
    b = Math.floor(10 + s * 100);
  }
  COLORMAP.push([r, g, b]);
}

const MAX_ROWS = 200;

export default function WaterfallPlot({ data }) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const historyRef = useRef([]);
  const animFrameRef = useRef(null);

  // Add new data row to history
  useEffect(() => {
    if (!data || !data.channel_powers) return;

    const powers = data.channel_powers;
    const row = {
      powers,
      tuned_ch: data.tuned_ch,
      active_target_ch: data.active_target_ch || [],
      is_hit: data.is_hit,
    };

    historyRef.current.push(row);
    if (historyRef.current.length > MAX_ROWS) {
      historyRef.current.shift();
    }
  }, [data]);

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;

    const ctx = canvas.getContext('2d');
    const octx = overlay.getContext('2d');
    const history = historyRef.current;

    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      overlay.width = w;
      overlay.height = h;
    }

    if (history.length === 0) {
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4a5568';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for scan data...', w / 2, h / 2);
      animFrameRef.current = requestAnimationFrame(render);
      return;
    }

    const numChannels = history[0].powers.length;
    const numRows = history.length;
    const cellWidth = w / numChannels;
    const cellHeight = h / MAX_ROWS;

    // ── Draw waterfall heatmap ──
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < numRows; row++) {
      const rowData = history[row];
      const y = h - (numRows - row) * cellHeight;

      for (let ch = 0; ch < numChannels; ch++) {
        const power = rowData.powers[ch];
        // Normalize: -90 dBm → 0, -10 dBm → 1
        const norm = Math.max(0, Math.min(1, (power - (-90)) / 80));
        const colorIdx = Math.floor(norm * 255);
        const [r, g, b] = COLORMAP[colorIdx];

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(
          Math.floor(ch * cellWidth),
          Math.floor(y),
          Math.ceil(cellWidth) + 1,
          Math.ceil(cellHeight) + 1
        );
      }
    }

    // ── Draw overlay markers on latest row ──
    octx.clearRect(0, 0, w, h);
    if (numRows > 0) {
      const latest = history[numRows - 1];
      const latestY = h - cellHeight;

      // Active target channels (red glow for missed)
      for (const ch of latest.active_target_ch) {
        if (ch !== latest.tuned_ch) {
          const x = ch * cellWidth + cellWidth / 2;
          octx.beginPath();
          octx.arc(x, latestY + cellHeight / 2, cellWidth / 3, 0, Math.PI * 2);
          octx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
          octx.lineWidth = 2;
          octx.stroke();

          // Pulse effect
          octx.beginPath();
          octx.arc(x, latestY + cellHeight / 2, cellWidth / 2, 0, Math.PI * 2);
          octx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
          octx.lineWidth = 1;
          octx.stroke();
        }
      }

      // Tuned channel marker
      const tunedX = latest.tuned_ch * cellWidth;
      if (latest.is_hit) {
        // Hit: green flash
        octx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        octx.fillRect(tunedX, 0, cellWidth, h);
        octx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
        octx.lineWidth = 2;
        octx.strokeRect(tunedX, latestY, cellWidth, cellHeight);
      } else {
        // Tuned but no hit: blue/orange indicator
        octx.fillStyle = 'rgba(0, 115, 230, 0.15)';
        octx.fillRect(tunedX, 0, cellWidth, h);
        octx.strokeStyle = 'rgba(0, 115, 230, 0.7)';
        octx.lineWidth = 1.5;
        octx.strokeRect(tunedX, latestY, cellWidth, cellHeight);
      }

      // Channel labels at top
      octx.font = '10px JetBrains Mono, monospace';
      octx.textAlign = 'center';
      octx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let ch = 0; ch < numChannels; ch++) {
        octx.fillText(
          `${ch}`,
          ch * cellWidth + cellWidth / 2,
          12
        );
      }

      // Y-axis time label
      octx.save();
      octx.font = '9px Inter, sans-serif';
      octx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      octx.textAlign = 'left';
      octx.fillText('← TIME', 4, h - 4);
      octx.fillText('NOW →', 4, latestY - 2);
      octx.restore();
    }

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          <span className="text-tactical-400 mr-2">◆</span>
          Waterfall Spectrogram
        </h2>
        <span className="text-xs text-gray-500 font-mono">
          {data ? `${data.channel_powers?.length || 0} CH` : '—'}
        </span>
      </div>
      <div className="waterfall-container flex-1 relative rounded-lg overflow-hidden border border-surface-600/20">
        <canvas ref={canvasRef} className="absolute inset-0" />
        <canvas ref={overlayCanvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
