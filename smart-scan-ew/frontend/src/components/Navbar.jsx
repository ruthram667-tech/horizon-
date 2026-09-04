/**
 * Smart Scan EW — Navbar (Warm Tactical)
 * ========================================
 * Premium persistent navigation bar with brand, page links,
 * scan status, and WebSocket connection indicator.
 * Colors: Gold / Flame / Crimson palette.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export default function Navbar({ isConnected, isRunning, connectionStatus }) {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <nav className="glass-navbar sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* ── Brand ── */}
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-flame-400 flex items-center justify-center shadow-lg group-hover:shadow-gold-400/20 transition-shadow duration-300">
            <span className="text-black font-bold text-base">⚡</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
              Smart Scan EW
            </h1>
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] leading-tight">
              Team HORIZON • SIH26055
            </p>
          </div>
        </NavLink>

        {/* ── Navigation Links ── */}
        {!isLanding && (
          <div className="hidden md:flex items-center gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </span>
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Analytics
              </span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </span>
            </NavLink>
          </div>
        )}

        {/* ── Status Indicators ── */}
        <div className="flex items-center gap-4">
          {!isLanding && (
            <>
              {/* Scan Status Badge */}
              <div className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all duration-300
                ${isRunning
                  ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
                  : 'bg-surface-700/50 border-surface-600/30 text-gray-500'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-gold-400 animate-pulse' : 'bg-gray-600'}`} />
                  {isRunning ? 'Scanning' : 'Idle'}
                </span>
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-1.5">
                <div className={isConnected ? 'connection-dot-connected' : 'connection-dot-disconnected'} />
                <span className="text-xs text-gray-400 font-mono hidden sm:inline">
                  {connectionStatus}
                </span>
              </div>
            </>
          )}

          {isLanding && (
            <NavLink to="/dashboard" className="btn-primary text-xs py-2 px-5">
              Launch Dashboard →
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
}
