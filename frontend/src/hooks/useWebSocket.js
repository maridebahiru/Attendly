import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook for connecting to the backend WebSocket
 * Auto-reconnects on disconnect with 3s delay
 */
export function useWebSocket(url = 'ws://localhost:8000/ws') {
  const [lastEvent, setLastEvent] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [eventHistory, setEventHistory] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'live_punch') {
            setLastEvent(payload.data);
            setEventHistory((prev) => {
              // Keep last 20 events in history
              const newHistory = [payload.data, ...prev];
              return newHistory.slice(0, 20);
            });
          } else if (payload.type === 'device_status') {
            setDeviceStatus(payload);
          }
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect with 3s delay
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        // Error will typically trigger onclose which handles the reconnect
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to construct websocket:", err);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Remove onclose listener to avoid triggering reconnect during unmount
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { lastEvent, deviceStatus, isConnected, eventHistory };
}
