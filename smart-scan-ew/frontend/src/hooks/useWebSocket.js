/**
 * Smart Scan EW — WebSocket Hook
 * ================================
 * High-performance WebSocket consumer with auto-reconnect,
 * exponential backoff, and 30 FPS render-capped state updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:8000/ws/stream`;
const MAX_RECONNECT_DELAY = 8000;
const INITIAL_RECONNECT_DELAY = 1000;

export default function useWebSocket() {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const wsRef = useRef(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef(null);
  const latestData = useRef(null);
  const rafId = useRef(null);
  const mountedRef = useRef(true);

  // Render loop: cap state updates to requestAnimationFrame rate
  const startRenderLoop = useCallback(() => {
    const render = () => {
      if (!mountedRef.current) return;
      if (latestData.current !== null) {
        setData({ ...latestData.current });
      }
      rafId.current = requestAnimationFrame(render);
    };
    rafId.current = requestAnimationFrame(render);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectDelay.current = INITIAL_RECONNECT_DELAY;
        console.log('[WS] Connected to', WS_URL);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          latestData.current = parsed;
        } catch (e) {
          console.warn('[WS] Parse error:', e);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        console.log('[WS] Disconnected, reconnecting in', reconnectDelay.current, 'ms');

        // Exponential backoff reconnect
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(
            reconnectDelay.current * 2,
            MAX_RECONNECT_DELAY
          );
          connect();
        }, reconnectDelay.current);
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        ws.close();
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      setConnectionStatus('error');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    startRenderLoop();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [connect, startRenderLoop]);

  return { data, isConnected, connectionStatus };
}
