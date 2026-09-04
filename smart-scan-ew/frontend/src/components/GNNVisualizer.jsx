/**
 * Smart Scan EW — GNN Visualizer
 * ================================
 * Live canvas-based visualization of the Graph Neural Network processing.
 * Shows frequency channel nodes in a circular layout, spectral adjacency
 * edges, attention weights, and animated data flow through GAT layers.
 *
 * Team HORIZON — SIH26055
 */

import React, { useRef, useEffect, useCallback } from 'react';

const TWO_PI = Math.PI * 2;

// Attention-inspired color for edges
function attentionColor(weight, alpha = 1) {
  // Gold → Orange → Crimson based on weight
  const r = Math.floor(255);
  const g = Math.floor(184 - weight * 140);
  const b = Math.floor(weight * 38);
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
    timeRef.current += 0.016; // ~60fps time increment
    const time = timeRef.current;

    const numChannels = data?.channel_powers?.length || 12;
    const powers = data?.channel_powers || new Array(numChannels).fill(-90);
    const tunedCh = data?.tuned_ch ?? -1;
    const activeChs = new Set(data?.active_target_ch || []);
    const isHit = data?.is_hit || false;

    // ── Layout ──
    const centerX = w * 0.42;
    const centerY = h * 0.48;
    const radius = Math.min(w, h) * 0.3;
    const nodeRadius = Math.min(w, h) * 0.028;

    // Calculate node positions in a circle
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

    // ── Draw background glow ──
    const bgGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.5);
    bgGlow.addColorStop(0, 'rgba(255, 184, 0, 0.015)');
    bgGlow.addColorStop(0.5, 'rgba(255, 107, 53, 0.008)');
    bgGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, w, h);

    // ── Draw spectral adjacency edges ──
    ctx.lineWidth = 1;
    for (let i = 0; i < numChannels; i++) {
      for (let offset of [1, 2]) {
        const j = i + offset;
        if (j < numChannels) {
          const ni = nodes[i];
          const nj = nodes[j];

          // Edge weight based on signal proximity
          const avgPower = ((powers[i] + powers[j]) / 2 + 90) / 80;
          const edgeAlpha = 0.05 + avgPower * 0.15;

          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 184, 0, ${edgeAlpha})`;

          // Curved edge
          const midX = (ni.x + nj.x) / 2 + (centerX - (ni.x + nj.x) / 2) * 0.3;
          const midY = (ni.y + nj.y) / 2 + (centerY - (ni.y + nj.y) / 2) * 0.3;
          ctx.moveTo(ni.x, ni.y);
          ctx.quadraticCurveTo(midX, midY, nj.x, nj.y);
          ctx.stroke();
        }
      }
    }

    // ── Draw attention beams from tuned channel ──
    if (tunedCh >= 0 && tunedCh < numChannels) {
      const tunedNode = nodes[tunedCh];
      const attentionHeads = 4;

      for (let head = 0; head < attentionHeads; head++) {
        // Simulate attention weights — stronger for nearby active channels
        for (let i = 0; i < numChannels; i++) {
          if (i === tunedCh) continue;

          const dist = Math.abs(i - tunedCh);
          const isActive = activeChs.has(i);
          const powerNorm = (powers[i] + 90) / 80;

          // Attention weight simulation
          let attWeight = 0;
          if (dist <= 2) attWeight += 0.3 / dist;
          if (isActive) attWeight += 0.4;
          attWeight += powerNorm * 0.2;
          attWeight = Math.min(attWeight, 1.0);

          if (attWeight < 0.08) continue;

          const ni = nodes[i];
          const headOffset = (head - 1.5) * 2;

          // Draw attention beam
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

    // ── Draw data flow particles ──
    // Spawn particles on tuned channel changes
    if (data && prevDataRef.current && data.tuned_ch !== prevDataRef.current.tuned_ch) {
      const from = prevDataRef.current.tuned_ch;
      const to = data.tuned_ch;
      if (from >= 0 && from < numChannels && to >= 0 && to < numChannels) {
        for (let p = 0; p < 6; p++) {
          particlesRef.current.push({
            fromIdx: from,
            toIdx: to,
            progress: 0,
            speed: 0.008 + Math.random() * 0.012,
            size: 2 + Math.random() * 2,
            born: time,
          });
        }
      }
    }
    prevDataRef.current = data;

    // Update and draw particles
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

      // Quadratic bezier point
      const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
      const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;

      const alpha = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, TWO_PI);
      ctx.fillStyle = `rgba(255, 184, 0, ${alpha * 0.9})`;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2.5, 0, TWO_PI);
      ctx.fillStyle = `rgba(255, 184, 0, ${alpha * 0.15})`;
      ctx.fill();
    }
    particlesRef.current = aliveParticles;

    // ── Draw nodes ──
    for (let i = 0; i < numChannels; i++) {
      const node = nodes[i];
      const powerNorm = (node.power + 90) / 80;
      const isActive = activeChs.has(i);
      const isTuned = i === tunedCh;
      const isHitNode = isTuned && isHit;

      // Node size pulsation based on signal
      const sizeMultiplier = 1 + powerNorm * 0.4;
      const pulseOffset = isTuned ? Math.sin(time * 4) * 0.15 : 0;
      const r = nodeRadius * (sizeMultiplier + pulseOffset);

      // Outer glow
      if (isActive || isTuned) {
        const glowR = r * 3;
        const glow = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, glowR);
        if (isHitNode) {
          glow.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
          glow.addColorStop(1, 'transparent');
        } else if (isTuned) {
          glow.addColorStop(0, 'rgba(255, 184, 0, 0.25)');
          glow.addColorStop(1, 'transparent');
        } else if (isActive) {
          glow.addColorStop(0, 'rgba(220, 38, 38, 0.2)');
          glow.addColorStop(1, 'transparent');
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, TWO_PI);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node body
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, TWO_PI);

      if (isHitNode) {
        // Green flash for successful interception
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        grad.addColorStop(0, 'rgba(74, 222, 128, 0.95)');
        grad.addColorStop(1, 'rgba(34, 197, 94, 0.7)');
        ctx.fillStyle = grad;
      } else if (isTuned) {
        // Gold glow for tuned channel
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        grad.addColorStop(0, 'rgba(255, 201, 64, 0.95)');
        grad.addColorStop(1, 'rgba(255, 184, 0, 0.7)');
        ctx.fillStyle = grad;
      } else if (isActive) {
        // Crimson pulse for active emitters
        const pulseAlpha = 0.6 + Math.sin(time * 3 + i) * 0.2;
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
        grad.addColorStop(0, `rgba(248, 113, 113, ${pulseAlpha})`);
        grad.addColorStop(1, `rgba(220, 38, 38, ${pulseAlpha * 0.7})`);
        ctx.fillStyle = grad;
      } else {
        // Idle channels — dim gray with subtle signal indication
        const brightness = 40 + powerNorm * 60;
        ctx.fillStyle = `rgba(${brightness}, ${brightness + 5}, ${brightness + 10}, 0.6)`;
      }
      ctx.fill();

      // Node border
      ctx.strokeStyle = isHitNode
        ? 'rgba(34, 197, 94, 0.8)'
        : isTuned
          ? 'rgba(255, 184, 0, 0.7)'
          : isActive
            ? 'rgba(220, 38, 38, 0.5)'
            : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = isTuned || isActive ? 2 : 1;
      ctx.stroke();

      // Channel label
      ctx.fillStyle = isTuned ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)';
      ctx.font = `${isTuned ? '600' : '400'} ${Math.max(8, nodeRadius * 0.8)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i}`, node.x, node.y);
    }

    // ── Layer Diagram (right side) ──
    const diagramX = w * 0.78;
    const diagramY = h * 0.15;
    const diagramH = h * 0.7;
    const layerGap = diagramH / 3;

    const layers = [
      { label: 'Input', sub: '[N×4]', y: diagramY },
      { label: 'GAT L1', sub: '4-Head → 128D', y: diagramY + layerGap },
      { label: 'GAT L2', sub: '1-Head → 32D', y: diagramY + layerGap * 2 },
      { label: 'Output', sub: 'Embeddings', y: diagramY + layerGap * 3 },
    ];

    // Draw layer connections
    for (let i = 0; i < layers.length - 1; i++) {
      const from = layers[i];
      const to = layers[i + 1];

      // Animated flow line
      const flowProgress = (time * 0.3 + i * 0.3) % 1;
      const flowY = from.y + (to.y - from.y) * flowProgress;

      ctx.beginPath();
      ctx.moveTo(diagramX, from.y + 14);
      ctx.lineTo(diagramX, to.y - 14);
      ctx.strokeStyle = 'rgba(255, 184, 0, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Animated dot flowing down
      if (data?.is_running !== false) {
        ctx.beginPath();
        ctx.arc(diagramX, flowY, 3, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255, 184, 0, 0.7)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(diagramX, flowY, 6, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255, 184, 0, 0.15)';
        ctx.fill();
      }
    }

    // Draw layer boxes
    for (const layer of layers) {
      const boxW = w * 0.16;
      const boxH = 28;
      const bx = diagramX - boxW / 2;
      const by = layer.y - boxH / 2;

      // Box background
      ctx.fillStyle = 'rgba(17, 19, 24, 0.8)';
      ctx.strokeStyle = 'rgba(255, 184, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '600 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.label, diagramX, layer.y - 4);

      // Sublabel
      ctx.fillStyle = 'rgba(255, 184, 0, 0.5)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(layer.sub, diagramX, layer.y + 7);
    }

    // ── Legend ──
    const legendX = 12;
    const legendY = h - 65;
    ctx.font = '9px Outfit, sans-serif';

    const legendItems = [
      { color: '#FFB800', label: 'Tuned' },
      { color: '#22c55e', label: 'Hit' },
      { color: '#DC2626', label: 'Active Target' },
      { color: '#555', label: 'Idle' },
    ];

    legendItems.forEach((item, idx) => {
      const ly = legendY + idx * 14;
      ctx.beginPath();
      ctx.arc(legendX + 5, ly, 4, 0, TWO_PI);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, legendX + 14, ly);
    });

    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = '600 9px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('GRAPH ATTENTION NETWORK', 10, 10);

    animRef.current = requestAnimationFrame(render);
  }, [data]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [render]);

  return (
    <div className="glass-card p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          <span className="text-gold-400 mr-2">◆</span>
          GNN Visualizer
        </h2>
        <span className="text-xs text-gray-500 font-mono">
          {data?.channel_powers ? `${data.channel_powers.length} Nodes | 4-Head GAT` : '—'}
        </span>
      </div>
      <div className="gnn-container flex-1 relative border border-surface-600/20">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
