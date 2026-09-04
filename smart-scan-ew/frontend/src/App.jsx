/**
 * Smart Scan EW — Main Application
 * ==================================
 * Root component with React Router navigation.
 * Manages WebSocket connection and routes between pages.
 *
 * Team HORIZON — SIH26055
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useWebSocket from './hooks/useWebSocket';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const { data, isConnected, connectionStatus } = useWebSocket();
  const isRunning = data?.is_running || false;

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* ── Persistent Navbar ── */}
        <Navbar
          isConnected={isConnected}
          isRunning={isRunning}
          connectionStatus={connectionStatus}
        />

        {/* ── Page Routes ── */}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                data={data}
                isConnected={isConnected}
                isRunning={isRunning}
              />
            }
          />
          <Route
            path="/analytics"
            element={<AnalyticsPage data={data} />}
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                isConnected={isConnected}
                isRunning={isRunning}
              />
            }
          />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
