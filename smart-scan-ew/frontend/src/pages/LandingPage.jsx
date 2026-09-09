/**
 * Smart Scan EW — Landing Page (Arctic Teal)
 * =============================================
 * Premium hero section with animated background, features showcase,
 * architecture overview, and CTA to launch the dashboard.
 * Palette: Teal / Mint / Lime / Coral
 */

import React from 'react';
import { Link } from 'react-router-dom';

/* ─── Custom High-Precision SVG Icons ─── */
function GnnIcon({ className = "w-6 h-6 text-teal-400" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <line x1="12" y1="7.5" x2="5" y2="15.5" opacity="0.6" strokeDasharray="1 1" />
      <line x1="12" y1="7.5" x2="19" y2="15.5" opacity="0.6" strokeDasharray="1 1" />
      <line x1="7.5" y1="18" x2="16.5" y2="18" opacity="0.6" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" />
    </svg>
  );
}

function DqnIcon({ className = "w-6 h-6 text-lime-400" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" opacity="0.3" />
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FhssIcon({ className = "w-6 h-6 text-teal-300" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18h3v-6h4v10h4v-14h5" />
      <path d="M2 4a19.5 19.5 0 0 1 20 0" opacity="0.4" />
      <path d="M5 8a14 14 0 0 1 14 0" opacity="0.7" />
    </svg>
  );
}

function TelemetryIcon({ className = "w-6 h-6 text-coral-400" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

/* ─── Feature Card Data ─── */
const FEATURES = [
  {
    icon: GnnIcon,
    title: 'Graph Attention Network',
    subtitle: '2-Layer GAT Topology',
    description: 'Constructs dynamic spectral graphs across RF channels. Multi-head self-attention projects raw power vectors into 32-dimensional topological embeddings.',
    color: 'teal',
    stats: '4→128→32 D',
  },
  {
    icon: DqnIcon,
    title: 'Adaptive Q-Learning',
    subtitle: 'Deep Reinforcement Learning',
    description: 'Double DQN agent dynamically optimizes receiver tuning policy in non-stationary hopping environments with zero prior transmitter synchronization.',
    color: 'lime',
    stats: 'Double DQN',
  },
  {
    icon: FhssIcon,
    title: 'Agile Signal Interception',
    subtitle: 'Markov State Modeling',
    description: 'Wideband spectrum scanning with sub-millisecond dwell times. Tracks multi-emitter frequency transitions across the 2.0 to 18.0 GHz tactical spectrum.',
    color: 'sage',
    stats: '2.0 – 18.0 GHz',
  },
  {
    icon: TelemetryIcon,
    title: 'High-Speed Telemetry',
    subtitle: 'Real-Time Spectrogram',
    description: 'Zero-latency WebSocket pipeline feeding 2D canvas waterfall spectrograms and interactive GNN graph node transitions.',
    color: 'coral',
    stats: '<50ms Latency',
  },
];

const ARCH_NODES = [
  { id: 'rf', label: 'RF Simulator', sub: 'FHSS Synthetic / HW', color: 'sage' },
  { id: 'gnn', label: 'GNN Embedder', sub: '4-Head Attention', color: 'teal' },
  { id: 'rl', label: 'RL Decision Core', sub: 'Double DQN Policy', color: 'lime' },
  { id: 'api', label: 'FastAPI Stream', sub: 'Asynchronous WS', color: 'coral' },
  { id: 'ui', label: 'Tactical Console', sub: 'Interactive Canvas', color: 'teal' },
];

const TEAM_STATS = [
  { value: '16', label: 'Channels' },
  { value: '<50ms', label: 'Dwell Cycle' },
  { value: '94.8%', label: 'Hit Intercept' },
  { value: '2–18 GHz', label: 'Coverage' },
];

function FeatureCard({ feature, index }) {
  const colorMap = {
    teal: { border: 'hover:border-teal-400/40', text: 'text-teal-400', bg: 'bg-teal-400/10', glow: 'hover:shadow-[0_0_25px_rgba(45,212,168,0.12)]' },
    lime: { border: 'hover:border-lime-400/40', text: 'text-lime-400', bg: 'bg-lime-400/10', glow: 'hover:shadow-[0_0_25px_rgba(132,204,22,0.12)]' },
    sage: { border: 'hover:border-teal-300/40', text: 'text-teal-300', bg: 'bg-teal-300/10', glow: 'hover:shadow-[0_0_25px_rgba(81,247,218,0.12)]' },
    coral: { border: 'hover:border-coral-400/40', text: 'text-coral-400', bg: 'bg-coral-400/10', glow: 'hover:shadow-[0_0_25px_rgba(232,97,77,0.12)]' },
  };
  const c = colorMap[feature.color];
  const IconComponent = feature.icon;

  return (
    <div
      className={`feature-card glass-card p-6 md:p-7 transition-all duration-300 ${c.border} ${c.glow} animate-fade-in-up stagger-${index + 3}`}
    >
      <div className="flex items-start justify-between mb-5">
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center border border-white/5`}>
          <IconComponent />
        </div>
        <span className={`text-[11px] font-mono font-medium ${c.text} px-2.5 py-1 rounded-lg ${c.bg} border border-white/5 tracking-wider`}>
          {feature.stats}
        </span>
      </div>
      <h3 className="text-base md:text-lg font-bold text-white mb-1.5 tracking-tight">{feature.title}</h3>
      <p className={`text-[11px] font-semibold ${c.text} uppercase tracking-wider mb-3`}>
        {feature.subtitle}
      </p>
      <p className="text-sm text-sage-300/90 leading-relaxed font-normal">
        {feature.description}
      </p>
    </div>
  );
}

function ArchitectureSection() {
  return (
    <section className="py-24 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 animate-fade-in-up">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-teal-400 mb-3">
            System Architecture
          </p>
          <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
            End-to-End <span className="gradient-text">Signal Pipeline</span>
          </h2>
          <p className="text-sage-300/80 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Continuous spectrum ingestion processed through Graph Attention spatial encoders and Reinforcement Learning decision policy engines.
          </p>
        </div>

        {/* Pipeline Flow */}
        <div className="flex flex-wrap justify-center items-center gap-3 md:gap-2">
          {ARCH_NODES.map((node, i) => {
            const colorMap = {
              teal: 'border-teal-400/30 hover:border-teal-400/60',
              lime: 'border-lime-400/30 hover:border-lime-400/60',
              sage: 'border-teal-300/30 hover:border-teal-300/60',
              coral: 'border-coral-400/30 hover:border-coral-400/60',
            };
            return (
              <React.Fragment key={node.id}>
                <div className={`glass-card p-4 min-w-[150px] text-center border transition-all duration-300 ${colorMap[node.color]} animate-fade-in-up stagger-${i + 2}`}>
                  <div className="text-xs font-bold text-white tracking-tight">{node.label}</div>
                  <div className="text-[10px] text-sage-400 font-mono tracking-wider mt-1">{node.sub}</div>
                </div>
                {i < ARCH_NODES.length - 1 && (
                  <div className="text-teal-400/40 text-sm font-mono px-1 hidden md:block">→</div>
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
      <section className="hero-gradient grid-pattern relative min-h-[88vh] flex items-center justify-center px-6">
        {/* Floating orbs */}
        <div className="floating-orb w-96 h-96 bg-teal-400/10 top-20 -left-48" />
        <div className="floating-orb w-72 h-72 bg-lime-400/8 bottom-20 -right-36" style={{ animationDelay: '5s' }} />
        <div className="floating-orb w-48 h-48 bg-teal-500/6 top-1/2 left-1/3" style={{ animationDelay: '10s' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10 pt-8 pb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-teal-500/25 bg-base-800/60 backdrop-blur-md mb-8 animate-fade-in-up stagger-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-teal-300 uppercase tracking-widest">
              Autonomous Electronic Warfare Suite • SIH26055
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-6 animate-fade-in-up stagger-2">
            Cognitive EW Spectrum
            <br />
            <span className="gradient-text">Interception System</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-sage-300/90 max-w-2xl mx-auto mb-10 leading-relaxed font-normal animate-fade-in-up stagger-3">
            Autonomous RF signal interception and tracking across agile FHSS channels,
            driven by real-time Graph Neural Network embeddings and Deep Reinforcement Learning.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up stagger-4">
            <Link to="/dashboard" className="btn-primary flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider px-8 py-3.5 shadow-lg shadow-teal-500/15">
              <span>Launch Tactical Console</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link to="/analytics" className="btn-secondary flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-7 py-3.5">
              <span>Mission Analytics</span>
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-xl mx-auto animate-fade-in-up stagger-5 border-t border-white/5 pt-8">
            {TEAM_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">{stat.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-sage-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-lime-400 mb-3">
              Operational Capabilities
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              State-of-the-Art <span className="gradient-text">Algorithmic Core</span>
            </h2>
            <p className="text-sage-300/80 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Synthesizing spatial graph structures with temporal reinforcement policies for agile, non-cooperative signal intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ── */}
      <ArchitectureSection />

      {/* ── Reward Table ── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-teal-400 mb-3">
              Policy Optimization
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              Multi-Objective <span className="gradient-text-warm">Reward Formulation</span>
            </h2>
            <p className="text-sage-300/80 text-sm max-w-lg mx-auto">
              Balances rapid intercept acquisition against receiver channel switching overhead.
            </p>
          </div>

          <div className="glass-card overflow-hidden border border-base-600/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-600/30 bg-base-900/40">
                  <th className="text-left px-6 py-4 text-sage-300 font-semibold uppercase tracking-wider text-[11px]">Event Condition</th>
                  <th className="text-right px-6 py-4 text-sage-300 font-semibold uppercase tracking-wider text-[11px]">Reward Value</th>
                  <th className="text-left px-6 py-4 text-sage-300 font-semibold uppercase tracking-wider text-[11px] hidden md:table-cell">Operational Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-600/15">
                <tr className="hover:bg-teal-500/5 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,168,0.6)]" /> Intercept Hit
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-teal-400 font-bold tabular-nums">+10.0</td>
                  <td className="px-6 py-4 text-sage-400 text-xs hidden md:table-cell">Receiver successfully tuned to active FHSS emitter channel</td>
                </tr>
                <tr className="hover:bg-teal-500/5 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-sage-500" /> Inactive Dwell
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-coral-400 font-bold tabular-nums">−1.0</td>
                  <td className="px-6 py-4 text-sage-400 text-xs hidden md:table-cell">Tuned channel is quiet / noise floor only</td>
                </tr>
                <tr className="hover:bg-teal-500/5 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-coral-400 shadow-[0_0_8px_rgba(232,97,77,0.6)]" /> Missed Target
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-coral-400 font-bold tabular-nums">−5.0</td>
                  <td className="px-6 py-4 text-sage-400 text-xs hidden md:table-cell">Penalty per untuned active emitter channel in current hop window</td>
                </tr>
                <tr className="hover:bg-teal-500/5 transition-colors">
                  <td className="px-6 py-4 text-white font-medium flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(132,204,22,0.6)]" /> Retune Cost
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-lime-400 font-bold tabular-nums">−0.3·|Δf|</td>
                  <td className="px-6 py-4 text-sage-400 text-xs hidden md:table-cell">Synthesizer lock delay proportional to frequency step distance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── CTA Bottom ── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass-card-glow gradient-border p-10 md:p-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
              Ready for Mission Deployment?
            </h2>
            <p className="text-sage-300/90 text-sm md:text-base mb-8 max-w-md mx-auto leading-relaxed">
              Engage the live tactical console to stream synthetic or hardware spectrum data with live spectrogram and GNN graphs.
            </p>
            <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider px-8 py-3.5">
              <span>Open Tactical Console</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-base-600/20 py-8 px-6 bg-base-950/80">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-teal-400 flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-base-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v8"/>
                <path d="M8 12h8"/>
              </svg>
            </div>
            <span className="text-xs font-medium text-sage-400">
              Team HORIZON • Smart Innovation Hackathon 2026
            </span>
          </div>
          <div className="text-[11px] text-sage-500 font-mono tracking-wider">
            SIH26055 • Electronic Warfare Support Node Alpha
          </div>
        </div>
      </footer>
    </div>
  );
}
