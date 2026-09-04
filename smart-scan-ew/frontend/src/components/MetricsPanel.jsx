/**
 * Smart Scan EW — Metrics Panel (Warm Palette)
 * ===============================================
 * Tactical metrics grid with animated ring gauges, sparklines,
 * and status indicators. Gold / Flame / Crimson theme.
 */

import React, { useState, useEffect, useRef } from 'react';

function AnimatedNumber({ value, decimals = 1, suffix = '' }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    const diff = value - prev;
    if (Math.abs(diff) < 0.001) {
      setDisplay(value);
      return;
    }

    const steps = 12;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = t * t * (3 - 2 * t); // smoothstep
      setDisplay(prev + diff * eased);
      if (step >= steps) {
        clearInterval(interval);
        setDisplay(value);
      }
    }, 16);

    prevRef.current = value;
    return () => clearInterval(interval);
  }, [value]);

  return (
    <span>
      {typeof display === 'number' ? display.toFixed(decimals) : '—'}
      {suffix}
    </span>
  );
}

function MiniRingGauge({ value, size = 48, strokeWidth = 4, color = '#FFB800' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="ring-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="ring-gauge-track"
          cx={size/2} cy={size/2} r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="ring-gauge-fill"
          cx={size/2} cy={size/2} r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
    </div>
  );
}

function StatusIndicator({ value, thresholds }) {
  const { good, warn } = thresholds;
  let color = 'bg-crimson-500';
  let glow = 'rgba(220, 38, 38, 0.5)';

  if (value >= good) {
    color = 'bg-gold-400';
    glow = 'rgba(255, 184, 0, 0.5)';
  } else if (value >= warn) {
    color = 'bg-flame-400';
    glow = 'rgba(255, 107, 53, 0.5)';
  }

  return (
    <div
      className={`w-2 h-2 rounded-full ${color}`}
      style={{ boxShadow: `0 0 8px ${glow}` }}
    />
  );
}

function MiniSparkline({ values, color = '#FFB800', width = 80, height = 24 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length < 2) return;

    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...values, 0.01);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((values[i] - min) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gradient fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, color + '05');
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [values, color, width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} />;
}

export default function MetricsPanel({ data }) {
  const pdHistoryRef = useRef([]);
  const pfaHistoryRef = useRef([]);
  const [pdHistory, setPdHistory] = useState([]);
  const [pfaHistory, setPfaHistory] = useState([]);

  useEffect(() => {
    if (!data) return;

    pdHistoryRef.current.push(data.pd || 0);
    pfaHistoryRef.current.push(data.pfa || 0);

    if (pdHistoryRef.current.length > 60) pdHistoryRef.current.shift();
    if (pfaHistoryRef.current.length > 60) pfaHistoryRef.current.shift();

    // Update display arrays less frequently
    setPdHistory([...pdHistoryRef.current]);
    setPfaHistory([...pfaHistoryRef.current]);
  }, [data?.total_hops]);

  const pd = data?.pd ?? 0;
  const pfa = data?.pfa ?? 0;
  const totalHits = data?.total_hits ?? 0;
  const totalHops = data?.total_hops ?? 0;
  const efficiency = totalHops > 0 ? (totalHits / totalHops) : 0;
  const episodeReward = data?.episode_reward ?? 0;

  return (
    <div className="glass-card p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          <span className="text-flame-400 mr-2">◆</span>
          Tactical Metrics
        </h2>
        <span className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
          LIVE
          <span className="inline-block w-1.5 h-1.5 bg-gold-400 rounded-full animate-pulse" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Detection Probability */}
        <div className="glass-card p-3 relative overflow-hidden group hover:border-gold-400/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MiniRingGauge value={pd} size={36} strokeWidth={3} color="#FFB800" />
              <StatusIndicator value={pd} thresholds={{ good: 0.6, warn: 0.3 }} />
            </div>
            <MiniSparkline values={pdHistory} color="#FFB800" />
          </div>
          <div className="stat-value text-gold-400">
            <AnimatedNumber value={pd * 100} decimals={1} suffix="%" />
          </div>
          <div className="stat-label">Detection Prob (P<sub>d</sub>)</div>
        </div>

        {/* False Alarm Rate */}
        <div className="glass-card p-3 relative overflow-hidden group hover:border-flame-400/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MiniRingGauge value={1 - pfa} size={36} strokeWidth={3} color="#FF6B35" />
              <StatusIndicator value={1 - pfa} thresholds={{ good: 0.95, warn: 0.8 }} />
            </div>
            <MiniSparkline values={pfaHistory} color="#FF6B35" />
          </div>
          <div className="stat-value text-flame-400">
            <AnimatedNumber value={pfa * 100} decimals={2} suffix="%" />
          </div>
          <div className="stat-label">False Alarm (P<sub>fa</sub>)</div>
        </div>

        {/* Total Intercepts */}
        <div className="glass-card p-3 group hover:border-gold-500/30 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎯</span>
            <StatusIndicator value={efficiency} thresholds={{ good: 0.3, warn: 0.1 }} />
          </div>
          <div className="stat-value text-gold-400">
            {totalHits}
          </div>
          <div className="stat-label">Total Intercepts</div>
          <div className="text-xs text-gray-500 mt-1 font-mono">
            of {totalHops} scans
          </div>
        </div>

        {/* Tuner Efficiency */}
        <div className="glass-card p-3 group hover:border-crimson-500/30 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <MiniRingGauge value={efficiency} size={36} strokeWidth={3} color="#DC2626" />
          </div>
          <div className="stat-value text-crimson-400">
            <AnimatedNumber value={efficiency * 100} decimals={1} suffix="%" />
          </div>
          <div className="stat-label">Tuner Efficiency</div>
          <div className="text-xs text-gray-500 mt-1 font-mono">
            Rwd: {episodeReward.toFixed(0)}
          </div>
        </div>
      </div>
    </div>
  );
}
