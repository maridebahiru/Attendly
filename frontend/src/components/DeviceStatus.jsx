import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Clock, AlertTriangle } from 'lucide-react';

export default function DeviceStatus({ wsStatus }) {
  const [deviceInfo, setDeviceInfo] = useState({
    online: false,
    last_seen: null,
    missed_punches: 0
  });

  // Fetch initial status and poll every 10s if we don't have websocket coverage
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await client.get('/device/status');
        // Only update if websocket hasn't given us fresh data recently
        if (!wsStatus) {
            setDeviceInfo(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch device status", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [wsStatus]);

  // Priority to WebSocket push events over polling
  useEffect(() => {
    if (wsStatus) {
      setDeviceInfo(prev => ({
        ...prev,
        online: wsStatus.status === 'online',
        missed_punches: wsStatus.missed_count !== undefined ? wsStatus.missed_count : prev.missed_punches,
        last_seen: wsStatus.status === 'online' ? new Date().toISOString() : prev.last_seen
      }));
    }
  }, [wsStatus]);

  return (
    <div className="flex items-center space-x-4 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
      <div className="flex items-center">
        <span className="relative flex h-3 w-3 mr-2">
          {deviceInfo.online ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </>
          ) : wsStatus?.status === 'reconnecting' ? (
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          ) : (
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          )}
        </span>
        <span className="text-sm font-semibold text-gray-700">
          ZMM200_TFT {deviceInfo.online ? 'Online' : 'Offline'}
        </span>
      </div>
      
      {deviceInfo.last_seen && !deviceInfo.online && (
        <div className="hidden md:flex items-center text-xs text-gray-500 border-l border-gray-200 pl-4">
          <Clock size={12} className="mr-1" />
          Last: {new Date(deviceInfo.last_seen).toLocaleTimeString()}
        </div>
      )}
      
      {deviceInfo.missed_punches > 0 && (
        <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border-l border-gray-200 ml-2">
          <AlertTriangle size={12} className="mr-1" />
          {deviceInfo.missed_punches} pending
        </div>
      )}
    </div>
  );
}
