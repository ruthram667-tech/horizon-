/**
 * Smart Scan EW — GNN Visualizer (Arctic Teal)
 * ================================================
 * Live canvas-based visualization of the Graph Neural Network.
 * Shows channel nodes, spectral edges, attention weights,
 * and animated data flow through GAT layers.
 * Teal / Lime / Coral palette.
 *
 * Team HORIZON — SIH26055
 */

import React, { useRef, useEffect, useCallback } from 'react';

const TWO_PI = Math.PI * 2;

function attentionColor(weight, alpha = 1) {
  // Teal → Lime based on attention weight
  const r = Math.floor(45 - weight * 32 + weight * 132);
  const g = Math.floor(212 - weight * 8);
  const b = Math.floor(168 - weight * 146);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function GNNVisualizer({ data }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const particlesRef = useRef([]);
  const prevDataRef = useRef(null);

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
    timeRef.current += 0.016;
    const time = timeRef.current;

    const numChannels = data?.channel_powers?.length || 12;
    const powers = data?.channel_powers || new Array(numChannels).fill(-90);
    const tunedCh = data?.tuned_ch ?? -1;
    const activeChs = new Set(data?.active_target_ch || []);
    const isHit = data?.is_hit || false;

    const centerX = w * 0.42;
    const centerY = h * 0.48;
    const radius = Math.min(w, h) * 0.3;
    const nodeRadius = Math.min(w, h) * 0.028;

    const nodes = [];
    for (let i = 0; i < numChannels; i++) {
      const angle = (i / numChannels) * TWO_PI - Math.PI / 2;
      nodes.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        angle,
        channel: i,
        power: powers[i],
      });
    }

    // Background glow
    const bgGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.5);
    bgGlow.addColorStop(0, 'rgba(45, 212, 168, 0.015)');
    bgGlow.addColorStop(0.5, 'rgba(13, 158, 128, 0.008)');
    bgGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, w, h);

    // Spectral adjacency edges
    ctx.lineWidth = 1;
    for (let i = 0; i < numChannels; i++) {
      for (let offset of [1, 2]) {
        const j = i + offset;
        if (j < numChannels) {
          const ni = nodes[i];
          const nj = nodes[j];
          const avgPower = ((powers[i] + powers[j]) / 2 + 90) / 80;
          const edgeAlpha = 0.05 + avgPower * 0.15;

          ctx.beginPath();
          ctx.strokeStyle = `rgba(45, 212, 168, ${edgeAlpha})`;
          const midX = (ni.x + nj.x) / 2 + (centerX - (ni.x + nj.x) / 2) * 0.3;
          const midY = (ni.y + nj.y) / 2 + (centerY - (ni.y + nj.y) / 2) * 0.3;
          ctx.moveTo(ni.x, ni.y);
          ctx.quadraticCurveTo(midX, midY, nj.x, nj.y);
          ctx.stroke();
        }
      }
    }

    // Attention beams from tuned channel
    if (tunedCh >= 0 && tunedCh < numChannels) {
      const tunedNode = nodes[tunedCh];
      for (let head = 0; head < 4; head++) {
        for (let i = 0; i < numChannels; i++) {
          if (i === tunedCh) continue;
          const dist = Math.abs(i - tunedCh);
          const isActive = activeChs.has(i);
          const powerNorm = (powers[i] + 90) / 80;

          let attWeight = 0;
          if (dist <= 2) attWeight += 0.3 / dist;
          if (isActive) attWeight += 0.4;
          attWeight += powerNorm * 0.2;
          attWeight = Math.min(attWeight, 1.0);
          if (attWeight < 0.08) continue;

          const ni = nodes[i];
          const headOffset = (head - 1.5) * 2;

          ctx.beginPath();
          ctx.strokeStyle = attentionColor(attWeight, attWeight * 0.4);
          ctx.lineWidth = attWeight * 3;
          const cpX = (tunedNode.x + ni.x) / 2 + headOffset * 3;
          const cpY = (tunedNode.y + ni.y) / 2 + headOffset * 3;
          ctx.moveTo(tunedNode.x, tunedNode.y);
          ctx.quadraticCurveTo(cpX, cpY, ni.x, ni.y);
          ctx.stroke();
        }
      }
    }

    // Particles
    if (data && prevDataRef.current && data.tuned_ch !== prevDataRef.current.tuned_ch) {
      const from = prevDataRef.current.tuned_ch;
      const to = data.tuned_ch;
      if (from >= 0 && from < numChannels && to >= 0 && to < numChannels) {
        for (let p = 0; p < 6; p++) {
          particlesRef.current.push({
            fromIdx: from, toIdx: to, progress: 0,
            speed: 0.008 + Math.random() * 0.012,
            size: 2 + Math.random() * 2, born: time,
          });
        }
      }
    }
    prevDataRef.current = data;

    const aliveParticles = [];
    for (const p of particlesRef.current) {
      p.progress += p.speed;
      if (p.progress >= 1) continue;
      aliveParticles.push(p);

      const from = nodes[p.fromIdx];
      const to = nodes[p.toIdx];
      if (!from || !to) continue;

      const t = p.progress;
      const midX = (from.x + to.x) / 2 + (centerX - (from.x + to.x) / 2) * 0.4;
      const midY = (from.y + to.y) / 2 + (centerY - (from.y + to.y) / 2) * 0.4;
      const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
      const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, TWO_PI);
      ctx.fillStyle = `rgba(45, 212, 168, ${alpha * 0.9})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, p.size * 2.5, 0, TWO_PI);
      ctx.fillStyle = `rgba(45, 212, 168, ${alpha * 0.15})`;
      ctx.fill();
    }
    particlesRef.current = aliveParticles;

    // Nodes
    for (let i = 0; i < numChannels; i++) {
      const node = nodes[i];
      const powerNorm = (node.power + 90) / 80;
      const isActive = activeChs.has(i);
      const isTuned = i === tunedCh;
      const isHitNode = isTuned && isHit;

      const sizeMultiplier = 1 + powerNorm * 0.4;
      const pulseOffset = isTuned ? Math.sin(time * 4) * 0.15 : 0;
      const r = nodeRadius * (sizeMultiplier + pulseOffset);

      if (isActive || isTuned) {
        const glowR = r * 3;
        const glow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, glowR);
        if (isHitNode) {
          glow.addColorStop(0, 'rgba(132, 204, 22, 0.3)');
          glow.addColorStop(1, 'transparent');
        } else if (isTuned) {
          glow.addColorStop(0, 'rgba(45, 212, 168, 0.25)');
          glow.addColorStop(1, 'transparent');
        } else if (isActive) {
          glow.addColorStop(0, 'rgba(232, 97, 77, 0.2)');
          glow.addColorStop(1, 'transparent');
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, TWO_PI);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, TWO_PI);

      if (isHitNode) {
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        grad.addColorStop(0, 'rgba(163, 230, 53, 0.95)');
        grad.addColorStop(1, 'rgba(132, 204, 22, 0.7)');
        ctx.fillStyle = grad;
      } else if (isTuned) {
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        grad.addColorStop(0, 'rgba(81, 247, 218, 0.95)');
        grad.addColorStop(1, 'rgba(45, 212, 168, 0.7)');
        ctx.fillStyle = grad;
      } else if (isActive) {
        const pulseAlpha = 0.6 + Math.sin(time * 3 + i) * 0.2;
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        grad.addColorStop(0, `rgba(251, 171, 162, ${pulseAlpha})`);
        grad.addColorStop(1, `rgba(232, 97, 77, ${pulseAlpha * 0.7})`);
        ctx.fillStyle = grad;
      } else {
        const brightness = 30 + powerNorm * 50;
        ctx.fillStyle = `rgba(${brightness}, ${brightness + 15}, ${brightness + 10}, 0.6)`;
      }
      ctx.fill();

      ctx.strokeStyle = isHitNode ? 'rgba(132, 204, 22, 0.8)'
        : isTuned ? 'rgba(45, 212, 168, 0.7)'
        : isActive ? 'rgba(232, 97, 77, 0.5)'
        : 'rgba(45, 212, 168, 0.08)';
      ctx.lineWidth = isTuned || isActive ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = isTuned ? 'rgba(232, 240, 236, 0.95)' : 'rgba(232, 240, 236, 0.45)';
      ctx.font = `${isTuned ? '600' : '500'} ${Math.max(8, nodeRadius * 0.8)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i}`, node.x, node.y);
    }

    // Layer Diagram
    const diagramX = w * 0.78;
    const diagramY = h * 0.15;
    const diagramH = h * 0.7;
    const layerGap = diagramH / 3;

    const layers = [
      { label: 'Input State', sub: '[N×4 Tensor]', y: diagramY },
      { label: 'GAT Layer 1', sub: '4-Head → 128D', y: diagramY + layerGap },
      { label: 'GAT Layer 2', sub: '1-Head → 32D', y: diagramY + layerGap * 2 },
      { label: 'Latent Vector', sub: 'Channel Embed', y: diagramY + layerGap * 3 },
    ];

    for (let i = 0; i < layers.length - 1; i++) {
      const from = layers[i];
      const to = layers[i + 1];
      const flowProgress = (time * 0.3 + i * 0.3) % 1;
      const flowY = from.y + (to.y - from.y) * flowProgress;

      ctx.beginPath();
      ctx.moveTo(diagramX, from.y + 14);
      ctx.lineTo(diagramX, to.y - 14);
      ctx.strokeStyle = 'rgba(45, 212, 168, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (data?.is_running !== false) {
        ctx.beginPath();
        ctx.arc(diagramX, flowY, 3, 0, TWO_PI);
        ctx.fillStyle = 'rgba(45, 212, 168, 0.7)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(diagramX, flowY, 6, 0, TWO_PI);
        ctx.fillStyle = 'rgba(45, 212, 168, 0.15)';
        ctx.fill();
      }
    }

    for (const layer of layers) {
      const boxW = w * 0.16;
      const boxH = 28;
      const bx = diagramX - boxW / 2;
      const by = layer.y - boxH / 2;

      ctx.fillStyle = 'rgba(10, 26, 26, 0.85)';
      ctx.strokeStyle = 'rgba(45, 212, 168, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(232, 240, 236, 0.9)';
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.label, diagramX, layer.y - 4);

      ctx.fillStyle = 'rgba(45, 212, 168, 0.7)';
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.fillText(layer.sub, diagramX, layer.y + 7);
    }

    // Legend
    const legendX = 12;
    const legendY = h - 65;
    ctx.font = '500 9px "Plus Jakarta Sans", sans-serif';

    const legendItems = [
      { color: '#2dd4a8', label: 'Receiver Tuned' },
      { color: '#84cc16', label: 'Intercept Hit' },
      { color: '#e8614d', label: 'Active Emitter' },
      { color: '#3a4a44', label: 'Noise Dwell' },
    ];

    legendItems.forEach((item, idx) => {
      const ly = legendY + idx * 14;
      ctx.beginPath();
      ctx.arc(legendX + 5, ly, 4, 0, TWO_PI);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.fillStyle = 'rgba(232, 240, 236, 0.55)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, legendX + 14, ly);
    });

    ctx.fillStyle = 'rgba(232, 240, 236, 0.3)';
    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('GRAPH ATTENTION NETWORK TOPOLOGY', 10, 10);

    animRef.current = requestAnimationFrame(render);
  }, [data]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [render]);

  return (
    <div className="glass-card p-3.5 h-full flex flex-col border border-base-600/30">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm bg-teal-400 shadow-[0_0_6px_rgba(45,212,168,0.6)]" />
          Graph Attention Visualizer
        </h2>
        <span className="text-[11px] text-teal-300/80 font-mono tracking-wider bg-teal-400/10 px-2 py-0.5 rounded-full border border-teal-400/20">
          {data?.channel_powers ? `${data.channel_powers.length} Nodes • 4-Head GAT` : '—'}
        </span>
      </div>
      <div className="gnn-container flex-1 relative border border-base-600/30 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
