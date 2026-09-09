/**
 * Smart Scan EW — Analytics Page (Arctic Teal)
 * ================================================
 * Historical metrics, session trends, and RL agent performance.
 * Teal / Lime / Coral / Sage palette.
 */

import React, { useState, useEffect, useRef } from 'react';

/* ─── Ring Gauge Component ─── */
function RingGauge({ value, max = 1, size = 120, strokeWidth = 8, color = '#2dd4a8', label, sublabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="ring-gauge flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle className="ring-gauge-track" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth} />
          <circle
            className="ring-gauge-fill"
            cx={size/2} cy={size/2} r={radius}
            strokeWidth={strokeWidth}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono text-white">
            {(value * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-xs font-semibold text-white uppercase tracking-wider">{label}</div>
        {sublabel && <div className="text-[10px] text-sage-500 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ─── Sparkline Chart ─── */
function SparklineChart({ values, color = '#2dd4a8', width = 200, height = 60, label }) {
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

    // Area fill
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((values[i] - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + '25');
    gradient.addColorStop(1, color + '03');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((values[i] - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // End dot
    const lastX = width;
    const lastY = height - ((values[values.length - 1] - min) / range) * (height - 4) - 2;
    ctx.beginPath();
    ctx.arc(lastX - 1, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [values, color, width, height]);

  return (
    <div>
      {label && <div className="text-xs text-sage-400 mb-2 uppercase tracking-wider font-medium">{label}</div>}
      <canvas ref={canvasRef} style={{ width, height }} className="rounded" />
    </div>
  );
}

export default function AnalyticsPage({ data }) {
  const [pdHistory, setPdHistory] = useState([]);
  const [pfaHistory, setPfaHistory] = useState([]);
  const [hitsHistory, setHitsHistory] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const pdHistRef = useRef([]);
  const pfaHistRef = useRef([]);
  const hitsHistRef = useRef([]);
  const rewardHistRef = useRef([]);

  useEffect(() => {
    if (!data) return;
    pdHistRef.current.push(data.pd || 0);
    pfaHistRef.current.push(data.pfa || 0);
    hitsHistRef.current.push(data.total_hits || 0);
    rewardHistRef.current.push(data.episode_reward || 0);

    if (pdHistRef.current.length > 200) pdHistRef.current.shift();
    if (pfaHistRef.current.length > 200) pfaHistRef.current.shift();
    if (hitsHistRef.current.length > 200) hitsHistRef.current.shift();
    if (rewardHistRef.current.length > 200) rewardHistRef.current.shift();

    if (data.total_hops % 5 === 0) {
      setPdHistory([...pdHistRef.current]);
      setPfaHistory([...pfaHistRef.current]);
      setHitsHistory([...hitsHistRef.current]);
      setRewardHistory([...rewardHistRef.current]);
    }
  }, [data?.total_hops]);

  const pd = data?.pd ?? 0;
  const pfa = data?.pfa ?? 0;
  const totalHits = data?.total_hits ?? 0;
  const totalHops = data?.total_hops ?? 0;
  const totalMisses = data?.total_misses ?? 0;
  const efficiency = totalHops > 0 ? totalHits / totalHops : 0;
  const episodeReward = data?.episode_reward ?? 0;

  return (
    <div className="min-h-[calc(100vh-57px)] p-6 md:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white mb-1.5 tracking-tight">
            Mission Telemetry & Analytics
          </h1>
          <p className="text-xs text-sage-300 font-medium">
            Real-time interception convergence curves, probability metrics, and RL reward trends
          </p>
        </div>

        {/* Ring Gauges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <div className="glass-card p-6 flex items-center justify-center border border-base-600/30">
            <RingGauge value={pd} color="#2dd4a8" label="Detection Rate" sublabel="Empirical Pd" />
          </div>
          <div className="glass-card p-6 flex items-center justify-center border border-base-600/30">
            <RingGauge value={1 - pfa} color="#84cc16" label="Selectivity" sublabel="1 - Pfa Accuracy" />
          </div>
          <div className="glass-card p-6 flex items-center justify-center border border-base-600/30">
            <RingGauge value={efficiency} color="#e8614d" label="Dwell Efficiency" sublabel="Hits / Dwell Cycles" />
          </div>
          <div className="glass-card p-6 flex items-center justify-center border border-base-600/30">
            <RingGauge value={Math.min(1, Math.max(0, episodeReward / 500))} color="#0d9e80" label="Policy Return" sublabel={`${episodeReward.toFixed(0)} pts`} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Dwell Epochs', value: totalHops.toLocaleString(), color: 'text-white' },
            { label: 'Confirmed Hits', value: totalHits.toLocaleString(), color: 'text-teal-300' },
            { label: 'Target Misses', value: totalMisses.toLocaleString(), color: 'text-coral-400' },
            { label: 'False Alarm Pfa', value: `${(pfa * 100).toFixed(2)}%`, color: 'text-lime-400' },
            { label: 'Cumulative Reward', value: episodeReward.toFixed(0), color: 'text-sage-200' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4 text-center border border-base-600/30">
              <div className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${stat.color}`}>{stat.value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-sage-400 mt-1.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Trend Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-6 border border-base-600/30">
            <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-teal-400" />Detection Probability History (Pd)
            </h3>
            <SparklineChart values={pdHistory.length > 1 ? pdHistory : [0, 0]} color="#2dd4a8" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-sage-400 font-mono tabular-nums">
              <span>Epoch 0</span>
              <span className="text-teal-300 font-medium">Current: {(pd * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="glass-card p-6 border border-base-600/30">
            <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-lime-400" />False Alarm Rate Convergence (Pfa)
            </h3>
            <SparklineChart values={pfaHistory.length > 1 ? pfaHistory : [0, 0]} color="#84cc16" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-sage-400 font-mono tabular-nums">
              <span>Epoch 0</span>
              <span className="text-lime-400 font-medium">Current: {(pfa * 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="glass-card p-6 border border-base-600/30">
            <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-teal-300" />Cumulative Intercept Interceptions
            </h3>
            <SparklineChart values={hitsHistory.length > 1 ? hitsHistory : [0, 0]} color="#0d9e80" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-sage-400 font-mono tabular-nums">
              <span>Epoch 0</span>
              <span className="text-teal-300 font-medium">Total: {totalHits}</span>
            </div>
          </div>

          <div className="glass-card p-6 border border-base-600/30">
            <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-coral-400" />Episode Reward Trajectory
            </h3>
            <SparklineChart values={rewardHistory.length > 1 ? rewardHistory : [0, 0]} color="#e8614d" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-sage-400 font-mono tabular-nums">
              <span>Epoch 0</span>
              <span className="text-coral-400 font-medium">Return: {episodeReward.toFixed(0)} pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
