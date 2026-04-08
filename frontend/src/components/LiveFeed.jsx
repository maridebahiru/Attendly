import React from 'react';
import { User, LogIn, LogOut, CheckCircle } from 'lucide-react';

export default function LiveFeed({ events }) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          Live Capture Feed
        </h2>
        <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
          Showing last 20
        </span>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 pt-10">
            <User size={48} className="opacity-20" />
            <p>Waiting for live punches...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => (
              <div 
                key={`${event.user_id}-${event.timestamp}-${index}`} 
                className="animate-slide-down flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100 transition-all hover:shadow-md"
              >
                <div className="flex-shrink-0 mr-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-inner ${event.punch_type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {event.punch_type === 'IN' ? <LogIn size={24} /> : <LogOut size={24} />}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-800">{event.name || `User ${event.user_id}`}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <User size={12} /> ID: {event.user_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.punch_type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {event.punch_type}
                      </span>
                      <p className="text-xs font-medium text-gray-500 mt-1">
                        {new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle size={12} className="text-blue-500" />
                      Verify Type: {event.verify_type === 1 ? 'Fingerprint' : event.verify_type === 4 ? 'Card' : event.verify_type === 3 ? 'Password' : 'Other ('+event.verify_type+')'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
