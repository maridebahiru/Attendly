// Configuration for local and production environment
export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

export const WS_BASE_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    // Convert http:// -> ws:// and https:// -> wss://
    return import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws';
  }
  return `ws://${window.location.hostname}:8000/ws`;
})();
