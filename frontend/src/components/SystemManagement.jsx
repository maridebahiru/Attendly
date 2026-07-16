import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Settings, Save, CheckCircle, AlertCircle, Clock, CalendarDays, Monitor, Network } from 'lucide-react';


const SystemManagement = () => {
  const [settings, setSettings] = useState({
    entering_time: '08:00',
    out_time: '17:00',
    morning_in: '08:00',
    morning_out: '12:00',
    afternoon_in: '13:00',
    afternoon_out: '17:00',
    off_days: 'Saturday,Sunday',
    machine_id: 1,
    port: 4370,
    device_ip: '192.168.10.40',
    morning_in_start: '02:00',
    morning_in_end: '03:00',
    morning_out_start: '05:00',
    morning_out_end: '07:00',
    afternoon_in_start: '08:00',
    afternoon_in_end: '09:00',
    afternoon_out_start: '10:00',
    afternoon_out_end: '12:00'
  });
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [syncYear, setSyncYear] = useState(new Date().getFullYear());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ type: '', text: '' });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const fetchHolidays = async () => {
    try {
      const res = await client.get('/settings/holidays');
      setHolidays(res.data);
    } catch (err) {
      console.error("Failed to fetch holidays", err);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await client.get('/settings');
        const data = res.data;
        setSettings({
          entering_time: data.entering_time || '08:00',
          out_time: data.out_time || '17:00',
          morning_in: data.morning_in || '08:00',
          morning_out: data.morning_out || '12:00',
          afternoon_in: data.afternoon_in || '13:00',
          afternoon_out: data.afternoon_out || '17:00',
          off_days: data.off_days || '',
          machine_id: data.machine_id ?? 1,
          port: data.port ?? 4370,
          device_ip: data.device_ip || '',
          morning_in_start: data.morning_in_start || '08:00',
          morning_in_end: data.morning_in_end || '09:00',
          morning_out_start: data.morning_out_start || '11:00',
          morning_out_end: data.morning_out_end || '13:00',
          afternoon_in_start: data.afternoon_in_start || '14:00',
          afternoon_in_end: data.afternoon_in_end || '15:00',
          afternoon_out_start: data.afternoon_out_start || '16:00',
          afternoon_out_end: data.afternoon_out_end || '18:00'
        });
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setFetching(false);
      }
    };

    fetchSettings();
    fetchHolidays();
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

  const handleFetchCalendar = async (e) => {
    e.preventDefault();
    setSyncLoading(true);
    setSyncMessage({ type: '', text: '' });
    
    try {
      const response = await client.post(`/settings/holidays/sync?year=${syncYear}`);
      setSyncMessage({
        type: 'success',
        text: response.data.message || `Successfully synced and replaced holiday data for year ${syncYear}.`
      });
      // Refresh the sidebar holidays list immediately
      fetchHolidays();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Failed to fetch and sync calendar data.";
      setSyncMessage({
        type: 'error',
        text: errorMsg
      });
    } finally {
      setSyncLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
      {/* Settings Form */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 p-8 w-full">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Settings size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Management</h2>
            <p className="text-sm text-slate-500">Configure off days, scan time ranges, and biometric device parameters.</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-8">
          
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

          {/* Scan Time Range Configuration */}
          <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold flex items-center gap-2 text-slate-700">
              <Clock size={18} className="text-indigo-500" />
              Scan Time Range Configuration
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure the time ranges for classifying user fingerprint scan sessions. Scans falling outside these ranges will be shown as Unclassified.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Morning In */}
              <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Morning In Range</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                    <input 
                      type="time" required
                      value={settings.morning_in_start || ''}
                      onChange={(e) => setSettings({ ...settings, morning_in_start: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                    <input 
                      type="time" required
                      value={settings.morning_in_end || ''}
                      onChange={(e) => setSettings({ ...settings, morning_in_end: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                </div>
              </div>

              {/* Morning Out */}
              <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Morning Out Range</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                    <input 
                      type="time" required
                      value={settings.morning_out_start || ''}
                      onChange={(e) => setSettings({ ...settings, morning_out_start: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                    <input 
                      type="time" required
                      value={settings.morning_out_end || ''}
                      onChange={(e) => setSettings({ ...settings, morning_out_end: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                </div>
              </div>

              {/* Afternoon In */}
              <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Afternoon In Range</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                    <input 
                      type="time" required
                      value={settings.afternoon_in_start || ''}
                      onChange={(e) => setSettings({ ...settings, afternoon_in_start: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                    <input 
                      type="time" required
                      value={settings.afternoon_in_end || ''}
                      onChange={(e) => setSettings({ ...settings, afternoon_in_end: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                </div>
              </div>

              {/* Afternoon Out */}
              <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Afternoon Out Range</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                    <input 
                      type="time" required
                      value={settings.afternoon_out_start || ''}
                      onChange={(e) => setSettings({ ...settings, afternoon_out_start: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                    <input 
                      type="time" required
                      value={settings.afternoon_out_end || ''}
                      onChange={(e) => setSettings({ ...settings, afternoon_out_end: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 animate-none"
                    />
                  </div>
                </div>
              </div>
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

        {/* Calendar Data Section */}
        <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
          <h3 className="font-bold flex items-center gap-2 text-slate-700">
            <span className="text-xl">📅</span>
            Calendar Data
          </h3>
          <p className="text-xs text-slate-500">
            Sync or update Ethiopian public holidays for a specific Gregorian year. Wipes any currently cached holidays and populates fresh data from the Calendarific API.
          </p>
          
          <form onSubmit={handleFetchCalendar} className="flex flex-col sm:flex-row items-end gap-4 max-w-md">
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Gregorian Year</label>
              <input 
                type="number" required min="2000" max="2100"
                value={syncYear}
                onChange={(e) => setSyncYear(parseInt(e.target.value) || '')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                placeholder="e.g. 2026"
              />
            </div>
            
            <button 
              type="submit"
              disabled={syncLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 w-full sm:w-auto cursor-pointer"
            >
              {syncLoading ? 'Syncing...' : 'Fetch Calendar'}
            </button>
          </form>

          {syncMessage.text && (
            <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300 ${syncMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
              {syncMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{syncMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Synchronized Holidays Card */}
      <div className="w-full lg:w-80 shrink-0 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col max-h-[850px] overflow-hidden">
        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
          <span className="text-xl">🇪🇹</span>
          Synced Holidays
        </h3>
        <p className="text-[11px] text-slate-500 font-medium mb-4">
          All Ethiopian public holidays fetched once per year and stored in the database.
        </p>
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
          {holidays.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No holidays loaded.</p>
          ) : (
            holidays.map((h, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1 hover:border-blue-100 transition-colors">
                <span className="text-xs font-black text-slate-700 leading-tight">{h.name}</span>
                <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-400 mt-1">
                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-black">ETH: {h.date}</span>
                </div>
                <span className="text-[8px] font-bold text-slate-400 text-right">GREG: {h.gregorian_date}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemManagement;
