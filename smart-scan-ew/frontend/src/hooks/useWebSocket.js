/**
 * Smart Scan EW — WebSocket Hook (Slow Scan Mode)
 * ==================================================
 * High-performance WebSocket consumer with auto-reconnect,
 * exponential backoff, and THROTTLED state updates (~2 FPS)
 * with smooth interpolation between frames for cinematic scanning.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = `ws://${window.location.hostname}:8000/ws/stream`;
const MAX_RECONNECT_DELAY = 8000;
const INITIAL_RECONNECT_DELAY = 1000;

// Slow scan: update the UI every ~500ms (2 FPS) instead of every frame
const DISPLAY_INTERVAL_MS = 500;

function lerpArray(prev, next, t) {
  if (!prev || !next || prev.length !== next.length) return next;
  return prev.map((v, i) => v + (next[i] - v) * t);
}

export default function useWebSocket() {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const wsRef = useRef(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef(null);
  const latestRawData = useRef(null);
  const displayedData = useRef(null);
  const lastUpdateTime = useRef(0);
  const rafId = useRef(null);
  const mountedRef = useRef(true);

  // Throttled render loop with interpolation
  const startRenderLoop = useCallback(() => {
    const render = (timestamp) => {
      if (!mountedRef.current) return;

      if (latestRawData.current !== null) {
        const now = performance.now();
        const elapsed = now - lastUpdateTime.current;

        if (elapsed >= DISPLAY_INTERVAL_MS) {
          // Time to push a new display frame
          const raw = latestRawData.current;

          if (displayedData.current && displayedData.current.channel_powers && raw.channel_powers) {
            // Smooth interpolation of power values
            const interpolated = {
              ...raw,
              channel_powers: lerpArray(
                displayedData.current.channel_powers,
                raw.channel_powers,
                0.6 // Blend factor: 60% toward new data for smooth transition
              ),
            };
            displayedData.current = interpolated;
            setData({ ...interpolated });
          } else {
            displayedData.current = raw;
            setData({ ...raw });
          }

          lastUpdateTime.current = now;
        }
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
          latestRawData.current = parsed;
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
