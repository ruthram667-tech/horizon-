/**
 * Smart Scan EW — Military Base Sign-In Page
 * =============================================
 * Secure authentication page for military base operators.
 * Features radar-scope animated background, base selector,
 * and credential verification against hardcoded entries.
 *
 * Team HORIZON — SIH26055
 */

import React, { useState } from 'react';

/* ─── Hardcoded Military Base Credentials ─── */
const MILITARY_BASES = [
  { id: 'nc-hq', name: 'Northern Command HQ', region: 'Udhampur' },
  { id: 'ead-01', name: 'Eastern Air Defense Wing', region: 'Shillong' },
  { id: 'wc-sec', name: 'Western Command Sector', region: 'Chandimandir' },
  { id: 'sc-ops', name: 'Southern Command Operations', region: 'Pune' },
  { id: 'nsd-07', name: 'Naval Station Delta-7', region: 'Visakhapatnam' },
  { id: 'caf-12', name: 'Central Air Force Station-12', region: 'Nagpur' },
];

const VALID_CREDENTIALS = {
  'admin': 'horizon2026',
  'operator': 'smartscan',
  'demo': 'demo123',
};

/* ─── Radar Rings Background ─── */
function RadarBackground() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Concentric radar rings */}
      {[400, 300, 200, 100].map((size, i) => (
        <div
          key={size}
          className="radar-ring absolute"
          style={{
            width: size,
            height: size,
            top: `calc(50% - ${size / 2}px)`,
            left: `calc(50% - ${size / 2}px)`,
            opacity: 0.5 - i * 0.1,
          }}
        />
      ))}
      {/* Rotating sweep line */}
      <div className="radar-scope" style={{ top: 'calc(50% - 200px)', left: 'calc(50% - 200px)' }} />
      {/* Static grid dots */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 140;
        const x = 50 + Math.cos(angle) * (r / 4);
        const y = 50 + Math.sin(angle) * (r / 4);
        return (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-teal-400/20"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        );
      })}
    </div>
  );
}

/* ─── Shield Icon ─── */
function ShieldIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto">
      <path
        d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z"
        fill="url(#shield-grad)"
        stroke="rgba(45, 212, 168, 0.5)"
        strokeWidth="1"
      />
      <path
        d="M12 6L8 8.5V11.5C8 14.65 9.68 17.54 12 18.5C14.32 17.54 16 14.65 16 11.5V8.5L12 6Z"
        fill="rgba(10, 26, 26, 0.6)"
        stroke="rgba(45, 212, 168, 0.3)"
        strokeWidth="0.5"
      />
      <path d="M11 11L12.5 12.5L15 9.5" stroke="#2dd4a8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="shield-grad" x1="3" y1="2" x2="21" y2="24">
          <stop offset="0%" stopColor="rgba(45, 212, 168, 0.3)" />
          <stop offset="100%" stopColor="rgba(13, 158, 128, 0.15)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function SignInPage({ onSignIn }) {
  const [base, setBase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!base) {
      setError('Please select a military base');
      return;
    }
    if (!username.trim() || !password.trim()) {
      setError('Please enter credentials');
      return;
    }

    setLoading(true);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1200));

    if (VALID_CREDENTIALS[username.toLowerCase()] === password) {
      const selectedBase = MILITARY_BASES.find((b) => b.id === base);
      onSignIn({
        username: username.toLowerCase(),
        baseName: selectedBase.name,
        baseRegion: selectedBase.region,
        baseId: base,
      });
    } else {
      setError('Invalid credentials. Access denied.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen signin-bg radar-grid flex items-center justify-center px-6">
      <RadarBackground />

      <div className="signin-card w-full max-w-md p-8 relative z-10 animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-8">
          <ShieldIcon />
          <h1 className="text-2xl font-bold text-white mt-4 tracking-tight">
            Smart Scan EW
          </h1>
          <p className="text-xs text-sage-400 uppercase tracking-[0.25em] mt-2">
            Secure Access Portal
          </p>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent mx-auto mt-4" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Base Selector */}
          <div>
            <label className="stat-label block mb-2">Military Base</label>
            <select
              id="select-base"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="select-field"
            >
              <option value="">— Select Base —</option>
              {MILITARY_BASES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} • {b.region}
                </option>
              ))}
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="stat-label block mb-2">Operator ID</label>
            <div className="relative">
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter operator ID"
                className="input-field pl-10"
                autoComplete="username"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="stat-label block mb-2">Access Key</label>
            <div className="relative">
              <input
                id="input-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access key"
                className="input-field pl-10 pr-10"
                autoComplete="current-password"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-500 hover:text-teal-400 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-coral-400/10 border border-coral-400/20 text-coral-400 text-xs font-medium animate-fade-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="btn-sign-in"
            type="submit"
            disabled={loading}
            className={`w-full btn-primary flex items-center justify-center gap-2 py-3.5 ${loading ? 'opacity-60 cursor-wait' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Authorize Access
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-base-600/30">
          <div className="flex items-center justify-between text-[10px] text-sage-500 uppercase tracking-wider">
            <span>Team HORIZON</span>
            <span>SIH26055</span>
          </div>
          <p className="text-[10px] text-sage-600 text-center mt-2">
            Demo: operator / smartscan
          </p>
        </div>
      </div>
    </div>
  );
}
