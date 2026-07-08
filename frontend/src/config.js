// Configuration for local and production environment
const isHttps = window.location.protocol === 'https:';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isHttps ? 'https://attendly-dlj9.onrender.com' : `http://${window.location.hostname}:8000`);

export const WS_BASE_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    // Convert http:// -> ws:// and https:// -> wss://
    return import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws';
  }
  return isHttps ? 'wss://attendly-dlj9.onrender.com/ws' : `ws://${window.location.hostname}:8000/ws`;
})();
