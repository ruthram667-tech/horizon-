/**
 * Smart Scan EW — Waterfall Spectrogram (Night-Vision Teal)
 * ===========================================================
 * Real-time 2D waterfall using HTML5 Canvas.
 * Colormap: Deep green → Teal → Mint → White (night-vision feel)
 * Sweep line in mint, markers in lime/coral.
 *
 * Team HORIZON — SIH26055
 */

import React, { useRef, useEffect, useCallback } from 'react';

// Night-vision teal colormap: dark → deep green → teal → mint → white
const COLORMAP = [];
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  let r, g, b;
  if (t < 0.15) {
    // Near black → very dark green
    const s = t / 0.15;
    r = Math.floor(s * 6);
    g = Math.floor(s * 18);
    b = Math.floor(s * 14);
  } else if (t < 0.35) {
    // Dark green → deep teal
    const s = (t - 0.15) / 0.2;
    r = Math.floor(6 + s * 7);
    g = Math.floor(18 + s * 52);
    b = Math.floor(14 + s * 45);
  } else if (t < 0.55) {
    // Deep teal → bright teal
    const s = (t - 0.35) / 0.2;
    r = Math.floor(13 + s * 32);
    g = Math.floor(70 + s * 142);
    b = Math.floor(59 + s * 109);
  } else if (t < 0.75) {
    // Bright teal → mint
    const s = (t - 0.55) / 0.2;
    r = Math.floor(45 + s * 36);
    g = Math.floor(212 + s * 35);
    b = Math.floor(168 + s * 62);
  } else if (t < 0.9) {
    // Mint → bright mint-white
    const s = (t - 0.75) / 0.15;
    r = Math.floor(81 + s * 120);
    g = Math.floor(247 + s * 8);
    b = Math.floor(230 + s * 20);
  } else {
    // Bright mint → white
    const s = (t - 0.9) / 0.1;
    r = Math.floor(201 + s * 54);
    g = 255;
    b = Math.floor(250 + s * 5);
  }
  COLORMAP.push([r, g, b]);
}

const MAX_ROWS = 200;

export default function WaterfallPlot({ data }) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const historyRef = useRef([]);
  const animFrameRef = useRef(null);
  const sweepRef = useRef(0);

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
      ctx.fillStyle = '#0A1A1A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#577b6e';
      ctx.font = '14px Space Grotesk, sans-serif';
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
    ctx.fillStyle = '#0A1A1A';
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < numRows; row++) {
      const rowData = history[row];
      const y = h - (numRows - row) * cellHeight;

      for (let ch = 0; ch < numChannels; ch++) {
        const power = rowData.powers[ch];
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

    // ── Sweep scan line ──
    sweepRef.current += 0.003;
    if (sweepRef.current > 1) sweepRef.current = 0;
    const sweepY = h * sweepRef.current;

    ctx.beginPath();
    ctx.moveTo(0, sweepY);
    ctx.lineTo(w, sweepY);
    ctx.strokeStyle = 'rgba(45, 212, 168, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sweep glow
    const sweepGrad = ctx.createLinearGradient(0, sweepY - 15, 0, sweepY + 15);
    sweepGrad.addColorStop(0, 'transparent');
    sweepGrad.addColorStop(0.5, 'rgba(45, 212, 168, 0.1)');
    sweepGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(0, sweepY - 15, w, 30);

    // ── Draw overlay markers on latest row ──
    octx.clearRect(0, 0, w, h);
    if (numRows > 0) {
      const latest = history[numRows - 1];
      const latestY = h - cellHeight;

      // Active target channels (coral glow for missed)
      for (const ch of latest.active_target_ch) {
        if (ch !== latest.tuned_ch) {
          const x = ch * cellWidth + cellWidth / 2;
          octx.beginPath();
          octx.arc(x, latestY + cellHeight / 2, cellWidth / 3, 0, Math.PI * 2);
          octx.strokeStyle = 'rgba(232, 97, 77, 0.9)';
          octx.lineWidth = 2;
          octx.stroke();

          // Pulse
          octx.beginPath();
          octx.arc(x, latestY + cellHeight / 2, cellWidth / 2, 0, Math.PI * 2);
          octx.strokeStyle = 'rgba(232, 97, 77, 0.3)';
          octx.lineWidth = 1;
          octx.stroke();
        }
      }

      // Tuned channel marker
      const tunedX = latest.tuned_ch * cellWidth;
      if (latest.is_hit) {
        // Hit: lime flash
        octx.fillStyle = 'rgba(132, 204, 22, 0.25)';
        octx.fillRect(tunedX, 0, cellWidth, h);
        octx.strokeStyle = 'rgba(132, 204, 22, 0.9)';
        octx.lineWidth = 2;
        octx.strokeRect(tunedX, latestY, cellWidth, cellHeight);
      } else {
        // Tuned but no hit: teal indicator
        octx.fillStyle = 'rgba(45, 212, 168, 0.12)';
        octx.fillRect(tunedX, 0, cellWidth, h);
        octx.strokeStyle = 'rgba(45, 212, 168, 0.6)';
        octx.lineWidth = 1.5;
        octx.strokeRect(tunedX, latestY, cellWidth, cellHeight);
      }

      // Channel labels at top
      octx.font = '10px IBM Plex Mono, monospace';
      octx.textAlign = 'center';
      octx.fillStyle = 'rgba(232, 240, 236, 0.4)';
      for (let ch = 0; ch < numChannels; ch++) {
        octx.fillText(
          `${ch}`,
          ch * cellWidth + cellWidth / 2,
          12
        );
      }

      // Y-axis time label
      octx.save();
      octx.font = '9px Space Grotesk, sans-serif';
      octx.fillStyle = 'rgba(232, 240, 236, 0.3)';
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-sage-300">
          <span className="text-teal-400 mr-2">◆</span>
          Waterfall Spectrogram
        </h2>
        <span className="text-xs text-sage-500 font-mono">
          {data ? `${data.channel_powers?.length || 0} CH` : '—'}
        </span>
      </div>
      <div className="waterfall-container flex-1 relative rounded-xl overflow-hidden border border-base-600/20">
        <canvas ref={canvasRef} className="absolute inset-0" />
        <canvas ref={overlayCanvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
