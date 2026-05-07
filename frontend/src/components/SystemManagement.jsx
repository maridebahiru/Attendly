import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Settings, Save, CheckCircle, AlertCircle, Clock, CalendarDays, Monitor, Network } from 'lucide-react';

const SystemManagement = () => {
  const [settings, setSettings] = useState({
    entering_time: '08:00',
    out_time: '17:00',
    off_days: 'Saturday,Sunday',
    machine_id: 1,
    port: 4370,
    device_ip: '192.168.10.40'
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await client.get('/settings');
        setSettings(res.data);
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setFetching(false);
      }
    };
    fetchSettings();
  }, []);

  const handleDayToggle = (day) => {
    const currentDays = settings.off_days ? settings.off_days.split(',').filter(d => d.trim()) : [];
    if (currentDays.includes(day)) {
      setSettings({ ...settings, off_days: currentDays.filter(d => d !== day).join(',') });
    } else {
      setSettings({ ...settings, off_days: [...currentDays, day].join(',') });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await client.put('/settings', settings);
      setMessage({ type: 'success', text: 'System settings updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Settings size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Management</h2>
            <p className="text-sm text-slate-500">Configure global working hours, off days, and biometric device parameters.</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Time Settings */}
            <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="font-bold flex items-center gap-2 text-slate-700">
                <Clock size={18} className="text-blue-500" />
                Working Hours
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Entering Time</label>
                  <input 
                    type="time" required
                    value={settings.entering_time}
                    onChange={(e) => setSettings({ ...settings, entering_time: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Out Time</label>
                  <input 
                    type="time" required
                    value={settings.out_time}
                    onChange={(e) => setSettings({ ...settings, out_time: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Off Days Selection */}
            <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h3 className="font-bold flex items-center gap-2 text-slate-700">
                <CalendarDays size={18} className="text-emerald-500" />
                Off Days
              </h3>
              <div className="space-y-2">
                 <p className="text-xs text-slate-500 mb-4">Select days that are not counted as working days for attendance calculation (Ethiopian Calendar mapping applies to weekdays).</p>
                 <div className="flex flex-wrap gap-2">
                   {daysOfWeek.map(day => {
                     const isSelected = settings.off_days?.includes(day);
                     return (
                       <button
                         key={day}
                         type="button"
                         onClick={() => handleDayToggle(day)}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                           isSelected 
                           ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 shadow-sm' 
                           : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                         }`}
                       >
                         {day}
                       </button>
                     )
                   })}
                 </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
             <div className="col-span-full">
               <h3 className="font-bold flex items-center gap-2 text-slate-700">
                 <Monitor size={18} className="text-purple-500" />
                 Device Connection Config
               </h3>
             </div>
             
             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Machine ID</label>
                <input 
                  type="number" required
                  value={settings.machine_id}
                  onChange={(e) => setSettings({ ...settings, machine_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
             </div>
             
             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Port</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Network size={16} /></div>
                  <input 
                    type="number" required
                    value={settings.port}
                    onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) })}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                  />
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Device IP</label>
                <input 
                  type="text" required
                  value={settings.device_ip}
                  onChange={(e) => setSettings({ ...settings, device_ip: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
             </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (
              <>
                <Save size={20} />
                Save System Configuration
              </>
            )}
          </button>
        </form>

        {message.text && (
          <div className={`mt-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemManagement;
