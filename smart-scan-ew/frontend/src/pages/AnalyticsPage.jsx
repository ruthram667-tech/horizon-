/**
 * Smart Scan EW — Analytics Page (Warm Palette)
 * ================================================
 * Historical metrics, session trends, and RL agent performance.
 * Gold / Flame / Crimson theme — no blue or purple.
 */

import React, { useState, useEffect, useRef } from 'react';

/* ─── Ring Gauge Component ─── */
function RingGauge({ value, max = 1, size = 120, strokeWidth = 8, color = '#FFB800', label, sublabel }) {
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
        {sublabel && <div className="text-[10px] text-gray-500 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ─── Sparkline Chart ─── */
function SparklineChart({ values, color = '#FFB800', width = 200, height = 60, label }) {
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
      {label && <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-medium">{label}</div>}
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

    // Throttle UI updates
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
    <div className="min-h-[calc(100vh-57px)] p-6 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Analytics</h1>
          <p className="text-sm text-gray-400">Real-time performance metrics and historical trends</p>
        </div>

        {/* Ring Gauges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6 flex items-center justify-center">
            <RingGauge value={pd} color="#FFB800" label="Detection Prob" sublabel="Pd" />
          </div>
          <div className="glass-card p-6 flex items-center justify-center">
            <RingGauge value={1 - pfa} color="#FF6B35" label="Accuracy" sublabel="1 - Pfa" />
          </div>
          <div className="glass-card p-6 flex items-center justify-center">
            <RingGauge value={efficiency} color="#DC2626" label="Efficiency" sublabel="Hits / Scans" />
          </div>
          <div className="glass-card p-6 flex items-center justify-center">
            <RingGauge value={Math.min(1, Math.max(0, episodeReward / 500))} color="#f59e0b" label="Reward" sublabel={`${episodeReward.toFixed(0)} pts`} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Scans', value: totalHops.toLocaleString(), color: 'text-white' },
            { label: 'Total Hits', value: totalHits.toLocaleString(), color: 'text-gold-400' },
            { label: 'Total Misses', value: totalMisses.toLocaleString(), color: 'text-crimson-400' },
            { label: 'False Alarm', value: `${(pfa * 100).toFixed(2)}%`, color: 'text-flame-400' },
            { label: 'Cumul. Reward', value: episodeReward.toFixed(0), color: 'text-amber-400' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4 text-center">
              <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Trend Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              <span className="text-gold-400 mr-2">◆</span>Detection Probability Over Time
            </h3>
            <SparklineChart values={pdHistory.length > 1 ? pdHistory : [0, 0]} color="#FFB800" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-gray-500 font-mono">
              <span>Start</span>
              <span>Current: {(pd * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              <span className="text-flame-400 mr-2">◆</span>False Alarm Rate Over Time
            </h3>
            <SparklineChart values={pfaHistory.length > 1 ? pfaHistory : [0, 0]} color="#FF6B35" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-gray-500 font-mono">
              <span>Start</span>
              <span>Current: {(pfa * 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              <span className="text-amber-400 mr-2">◆</span>Cumulative Hits
            </h3>
            <SparklineChart values={hitsHistory.length > 1 ? hitsHistory : [0, 0]} color="#f59e0b" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-gray-500 font-mono">
              <span>Start</span>
              <span>Total: {totalHits}</span>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              <span className="text-crimson-400 mr-2">◆</span>Episode Reward
            </h3>
            <SparklineChart values={rewardHistory.length > 1 ? rewardHistory : [0, 0]} color="#DC2626" width={500} height={100} />
            <div className="flex justify-between mt-3 text-xs text-gray-500 font-mono">
              <span>Start</span>
              <span>Current: {episodeReward.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
