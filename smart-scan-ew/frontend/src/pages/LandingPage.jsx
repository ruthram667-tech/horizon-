/**
 * Smart Scan EW — Landing Page (Warm Palette)
 * ==============================================
 * Premium hero section with animated background, features showcase,
 * architecture overview, and CTA to launch the dashboard.
 * Colors: Gold / Flame / Crimson — No blue or purple.
 */

import React from 'react';
import { Link } from 'react-router-dom';

/* ─── Feature Card Data ─── */
const FEATURES = [
  {
    icon: '🧠',
    title: 'Graph Neural Network',
    subtitle: '2-Layer GAT Architecture',
    description: 'Models frequency channels as a graph with spectral adjacency and observed hop transitions. 4-head attention produces rich 32-dim node embeddings.',
    color: 'gold',
    stats: '4→128→32',
  },
  {
    icon: '🎯',
    title: 'Deep Q-Network',
    subtitle: 'Reinforcement Learning Agent',
    description: 'Double DQN with experience replay learns optimal tuning strategies. Adapts in real-time to evolving FHSS patterns without prior intelligence.',
    color: 'flame',
    stats: 'ε-greedy',
  },
  {
    icon: '📡',
    title: 'FHSS Interception',
    subtitle: 'Markov Hopping Simulator',
    description: 'Synthetic RF simulator generates realistic frequency-hopping signals with evolving transition matrices and AWGN noise modeling.',
    color: 'amber',
    stats: '2–18 GHz',
  },
  {
    icon: '⚡',
    title: 'Real-Time Streaming',
    subtitle: 'Slow Scan Visualization',
    description: 'High-performance FastAPI backend streams live telemetry via WebSocket with canvas-rendered waterfall spectrogram and GNN graph visualization.',
    color: 'crimson',
    stats: '~2 FPS',
  },
];

const ARCH_NODES = [
  { id: 'rf', label: 'RF Simulator', sub: 'FHSS / AWGN', icon: '📻', color: 'amber' },
  { id: 'gnn', label: 'GNN Embedder', sub: '2-Layer GAT', icon: '🧠', color: 'gold' },
  { id: 'rl', label: 'RL Agent', sub: 'Double DQN', icon: '🎯', color: 'flame' },
  { id: 'api', label: 'FastAPI + WS', sub: 'REST + Stream', icon: '🔌', color: 'crimson' },
  { id: 'ui', label: 'React Dashboard', sub: 'Canvas + Glass', icon: '🖥️', color: 'gold' },
];

const TEAM_STATS = [
  { value: '12', label: 'Channels' },
  { value: '~2', label: 'FPS' },
  { value: '10+', label: 'Reward Hit' },
  { value: '<50ms', label: 'Latency' },
];

function FeatureCard({ feature, index }) {
  const colorMap = {
    gold: { border: 'hover:border-gold-400/30', glow: 'rgba(255,184,0,0.15)', text: 'text-gold-400', bg: 'bg-gold-400/10' },
    flame: { border: 'hover:border-flame-400/30', glow: 'rgba(255,107,53,0.15)', text: 'text-flame-400', bg: 'bg-flame-400/10' },
    amber: { border: 'hover:border-amber-400/30', glow: 'rgba(251,191,36,0.15)', text: 'text-amber-400', bg: 'bg-amber-400/10' },
    crimson: { border: 'hover:border-crimson-400/30', glow: 'rgba(220,38,38,0.15)', text: 'text-crimson-400', bg: 'bg-crimson-500/10' },
  };
  const c = colorMap[feature.color];

  return (
    <div
      className={`feature-card glass-card-interactive p-6 animate-fade-in-up stagger-${index + 3} ${c.border}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center text-2xl`}>
          {feature.icon}
        </div>
        <span className={`text-xs font-mono ${c.text} px-2 py-1 rounded-md ${c.bg}`}>
          {feature.stats}
        </span>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{feature.title}</h3>
      <p className={`text-xs font-medium ${c.text} uppercase tracking-wider mb-3`}>
        {feature.subtitle}
      </p>
      <p className="text-sm text-gray-400 leading-relaxed">
        {feature.description}
      </p>
    </div>
  );
}

function ArchitectureSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 animate-fade-in-up">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400 mb-3">
            System Architecture
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            End-to-End <span className="gradient-text">AI Pipeline</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            From raw RF simulation through GNN feature extraction to RL-driven tuning decisions,
            streamed live to the browser with cinematic slow-scan visualization.
          </p>
        </div>

        {/* Pipeline Flow */}
        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-2">
          {ARCH_NODES.map((node, i) => {
            const colorMap = {
              gold: 'border-gold-400/30 hover:border-gold-400/50',
              flame: 'border-flame-400/30 hover:border-flame-400/50',
              amber: 'border-amber-400/30 hover:border-amber-400/50',
              crimson: 'border-crimson-400/30 hover:border-crimson-400/50',
            };
            return (
              <React.Fragment key={node.id}>
                <div className={`arch-node ${colorMap[node.color]} min-w-[140px] animate-fade-in-up stagger-${i + 2}`}>
                  <div className="text-3xl mb-2">{node.icon}</div>
                  <div className="text-sm font-bold text-white">{node.label}</div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-1">{node.sub}</div>
                </div>
                {i < ARCH_NODES.length - 1 && (
                  <div className="text-gold-400/60 text-lg font-mono hidden md:block">→</div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ── Hero Section ── */}
      <section className="hero-gradient grid-pattern relative min-h-[85vh] flex items-center justify-center px-6">
        {/* Floating orbs — warm palette */}
        <div className="floating-orb w-96 h-96 bg-gold-400/10 top-20 -left-48" />
        <div className="floating-orb w-72 h-72 bg-flame-400/10 bottom-20 -right-36" style={{ animationDelay: '5s' }} />
        <div className="floating-orb w-48 h-48 bg-crimson-500/8 top-1/2 left-1/3" style={{ animationDelay: '10s' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-surface-500/40 bg-surface-800/40 backdrop-blur-sm mb-8 animate-fade-in-up stagger-1">
            <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
            <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Smart Innovation Hackathon 2026 • SIH26055
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6 animate-fade-in-up stagger-2">
            Smart Scan
            <br />
            <span className="gradient-text">Electronic Warfare</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up stagger-3">
            AI-powered Electronic Warfare Support system that intercepts fast-hopping
            FHSS radio signals <strong className="text-gray-300">without prior intelligence</strong>,
            using Graph Neural Networks and Reinforcement Learning.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up stagger-4">
            <Link to="/dashboard" className="btn-primary flex items-center gap-2 text-base">
              <span>Launch Dashboard</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link to="/analytics" className="btn-secondary flex items-center gap-2">
              <span>View Analytics</span>
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto animate-fade-in-up stagger-5">
            {TEAM_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 animate-fade-in-up">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-flame-400 mb-3">
              Core Capabilities
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Powered by <span className="gradient-text">Advanced AI</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Combining graph-based spectrum analysis with deep reinforcement learning
              for real-time adaptive electronic warfare support.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ── */}
      <ArchitectureSection />

      {/* ── Reward Table ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400 mb-3">
              Reward Engineering
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Multi-Component <span className="gradient-text-warm">Reward Function</span>
            </h2>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-600/30">
                  <th className="text-left px-6 py-4 text-gray-400 font-medium uppercase tracking-wider text-xs">Event</th>
                  <th className="text-right px-6 py-4 text-gray-400 font-medium uppercase tracking-wider text-xs">Reward</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium uppercase tracking-wider text-xs hidden md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-600/10 hover:bg-surface-700/20 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gold-400" /> Intercept Hit
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-gold-400 font-bold">+10.0</td>
                  <td className="px-6 py-4 text-gray-400 hidden md:table-cell">Tuned to active emitter channel</td>
                </tr>
                <tr className="border-b border-surface-600/10 hover:bg-surface-700/20 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-500" /> Empty Scan
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-crimson-400 font-bold">−1.0</td>
                  <td className="px-6 py-4 text-gray-400 hidden md:table-cell">Tuned to noise/inactive channel</td>
                </tr>
                <tr className="border-b border-surface-600/10 hover:bg-surface-700/20 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-crimson-500" /> Missed Active
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-crimson-400 font-bold">−5.0</td>
                  <td className="px-6 py-4 text-gray-400 hidden md:table-cell">Per missed active channel</td>
                </tr>
                <tr className="hover:bg-surface-700/20 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-flame-400" /> Switching Cost
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-flame-400 font-bold">−0.3·|Δf|</td>
                  <td className="px-6 py-4 text-gray-400 hidden md:table-cell">Tuning delay proportional to frequency distance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── CTA Bottom ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass-card-glow gradient-border p-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Intercept?
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Launch the real-time tactical dashboard and watch the AI agent
              intercept frequency-hopping signals in real time.
            </p>
            <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 text-base">
              <span>Open Dashboard</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-surface-600/20 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-400 to-flame-400 flex items-center justify-center">
              <span className="text-black font-bold text-xs">⚡</span>
            </div>
            <span className="text-sm text-gray-500">
              Team HORIZON — Smart Innovation Hackathon 2026
            </span>
          </div>
          <div className="text-xs text-gray-600 font-mono">
            SIH26055 • Electronic Warfare Support System
          </div>
        </div>
      </footer>
    </div>
  );
}
