/**
 * Smart Scan EW — Metrics Panel (Arctic Teal — Compact Horizontal)
 * ==================================================================
 * Simplified compact metrics strip with 4 key metrics in a row.
 * Fits in the bottom strip of the dashboard.
 * Teal / Lime / Coral palette.
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
      const eased = t * t * (3 - 2 * t);
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

function MiniRingGauge({ value, size = 40, strokeWidth = 3.5, color = '#2dd4a8' }) {
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

export default function MetricsPanel({ data }) {
  const pd = data?.pd ?? 0;
  const pfa = data?.pfa ?? 0;
  const totalHits = data?.total_hits ?? 0;
  const totalHops = data?.total_hops ?? 0;
  const efficiency = totalHops > 0 ? (totalHits / totalHops) : 0;

  return (
    <div className="glass-card px-4 py-3">
      <div className="grid grid-cols-4 gap-4">
        {/* Detection Probability */}
        <div className="flex items-center gap-3 group">
          <MiniRingGauge value={pd} size={38} strokeWidth={3} color="#2dd4a8" />
          <div>
            <div className="text-lg font-bold font-mono text-teal-400" style={{ textShadow: '0 0 8px rgba(45,212,168,0.3)' }}>
              <AnimatedNumber value={pd * 100} decimals={1} suffix="%" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-sage-500 font-medium">Detection P<sub>d</sub></div>
          </div>
        </div>

        {/* False Alarm Rate */}
        <div className="flex items-center gap-3 group">
          <MiniRingGauge value={1 - pfa} size={38} strokeWidth={3} color="#84cc16" />
          <div>
            <div className="text-lg font-bold font-mono text-lime-400" style={{ textShadow: '0 0 8px rgba(132,204,22,0.3)' }}>
              <AnimatedNumber value={pfa * 100} decimals={2} suffix="%" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-sage-500 font-medium">False Alarm P<sub>fa</sub></div>
          </div>
        </div>

        {/* Total Intercepts */}
        <div className="flex items-center gap-3 group">
          <div className="w-[38px] h-[38px] rounded-full bg-teal-400/10 flex items-center justify-center text-lg">
            🎯
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-white">
              {totalHits}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-sage-500 font-medium">
              Intercepts <span className="text-sage-600">/ {totalHops}</span>
            </div>
          </div>
        </div>

        {/* Tuner Efficiency */}
        <div className="flex items-center gap-3 group">
          <MiniRingGauge value={efficiency} size={38} strokeWidth={3} color="#e8614d" />
          <div>
            <div className="text-lg font-bold font-mono text-coral-400" style={{ textShadow: '0 0 8px rgba(232,97,77,0.3)' }}>
              <AnimatedNumber value={efficiency * 100} decimals={1} suffix="%" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-sage-500 font-medium">Efficiency</div>
          </div>
        </div>
      </div>
    </div>
  );
}
