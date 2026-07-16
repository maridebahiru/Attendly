import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { LogIn, LogOut, Search, Clock } from 'lucide-react';

export default function StatsCards({ newEventsCount }) {
  const [stats, setStats] = useState({
    total: 0,
    in: 0,
    out: 0,
  });
  const [currentTime, setCurrentTime] = useState(new Date(Date.now() - 6 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() - 6 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch stats for today
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        // In a real production app, we would ideally have a dedicated /stats endpoint
        // For now, we'll fetch today's logs and calculate based on prompt requirements
        const response = await client.get(`/attendance?date=${today}&limit=5000`);
        const logs = response.data;
        
        let inCount = 0;
        let outCount = 0;
        
        // Count for currently IN / OUT
        // We'll calculate latest state for each user today
        const userState = {};
        logs.forEach(log => {
          // Since logs might be sorted descending by timestamp, the first one encountered is the latest
          if (!userState[log.user_id]) {
            userState[log.user_id] = log.punch_type;
            if (log.punch_type === 'IN') inCount++;
            if (log.punch_type === 'OUT') outCount++;
          }
        });

        setStats({
          total: logs.length,
          in: inCount,
          out: outCount,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    
    fetchStats();
    
    // Refresh stats every 30 seconds or when new events arrive
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [newEventsCount]); // Re-fetch when live events happen

  const cards = [
    { title: "Total Punches Today", value: stats.total, icon: <Clock className="text-blue-500" size={24} />, bg: "bg-blue-50" },
    { title: "Currently IN", value: stats.in, icon: <LogIn className="text-emerald-500" size={24} />, bg: "bg-emerald-50" },
    { title: "Currently OUT", value: stats.out, icon: <LogOut className="text-rose-500" size={24} />, bg: "bg-rose-50" },
    { title: "Current Time", value: currentTime, icon: <Clock className="text-purple-500" size={24} />, bg: "bg-purple-50" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 flex flex-col justify-between overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300">
            {React.cloneElement(card.icon, { size: 80 })}
          </div>
          <div className="flex items-center justify-between mb-4 z-10">
            <h3 className="text-sm font-medium text-gray-500">{card.title}</h3>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              {card.icon}
            </div>
          </div>
          <div className="z-10">
            <span className="text-3xl font-bold text-gray-800">{card.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
