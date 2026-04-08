import React, { useState } from 'react';
import client from '../api/client';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    setToast(null);
    
    try {
      const response = await client.post('/device/sync');
      setToast({
        type: 'success',
        message: `Sync successful! ${response.data.synced_records} records synced.`
      });
    } catch (err) {
      console.error("Sync failed", err);
      setToast({
        type: 'error',
        message: 'Failed to sync with device.'
      });
    } finally {
      setSyncing(false);
      // Hide toast after 4 seconds
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          syncing 
            ? 'bg-blue-100 text-blue-400 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm focus:ring-blue-500 hover:shadow'
        }`}
      >
        <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Manual Sync'}
      </button>

      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-full right-0 mt-2 w-64 p-3 rounded-lg shadow-lg border text-sm flex items-start z-50 animate-slide-down ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-rose-500 mr-2 flex-shrink-0 mt-0.5" />
          )}
          <p>{toast.message}</p>
        </div>
      )}
    </div>
  );
}
