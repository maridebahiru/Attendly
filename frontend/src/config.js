// Configuration for local and production environment
const isHttps = window.location.protocol === 'https:';

const rawApiUrl = import.meta.env.VITE_API_URL || 
  (isHttps ? 'https://attendly-dlj9.onrender.com' : `http://${window.location.hostname}:8000`);

// Helper to auto-upgrade protocol to HTTPS/WSS if the page is loaded over HTTPS (excluding local development IPs)
const sanitizeUrl = (url, targetProtocol) => {
  if (!url) return url;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.');
  if (isHttps && !isLocal) {
    if (targetProtocol === 'https') {
      return url.replace(/^http:/, 'https:');
    } else if (targetProtocol === 'wss') {
      return url.replace(/^ws:/, 'wss:');
    }
  }
  return url;
};

export const API_BASE_URL = sanitizeUrl(rawApiUrl, 'https');

export const WS_BASE_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    // Convert http:// -> ws:// and https:// -> wss://
    const wsUrl = import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws';
    return sanitizeUrl(wsUrl, 'wss');
  }
  const fallbackWs = isHttps ? 'wss://attendly-dlj9.onrender.com/ws' : `ws://${window.location.hostname}:8000/ws`;
  return sanitizeUrl(fallbackWs, 'wss');
})();

console.log('Attendance System API Base URL:', API_BASE_URL);
console.log('Attendance System WS Base URL:', WS_BASE_URL);

