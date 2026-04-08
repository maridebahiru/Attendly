import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Plus, UserCheck, Briefcase, Clock, AlertCircle, Save, CheckCircle2, ChevronRight, Hash } from 'lucide-react';

const ShiftManagement = () => {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [newShift, setNewShift] = useState({
    name: '',
    start_time_1: '07:30',
    end_time_1: '12:00',
    start_time_2: '14:00',
    end_time_2: '17:30',
    total_hours_required: 8.0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, usersRes] = await Promise.all([
        axios.get('http://localhost:8000/shifts'),
        axios.get('http://localhost:8000/users')
      ]);
      setShifts(shiftsRes.data);
      setUsers(usersRes.data);
      setError(null);
    } catch (err) {
      setError('Could not load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddShift = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/shifts', newShift);
      setShowAddModal(false);
      fetchData();
      showSuccess('Shift created successfully!');
    } catch (err) {
      setError('Failed to create shift.');
    }
  };

  const assignShift = async (userId, shiftId) => {
    try {
      await axios.post(`http://localhost:8000/users/${userId}/shift?shift_id=${shiftId}`);
      fetchData();
      showSuccess('User shift updated!');
    } catch (err) {
      setError('Assignment failed.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full pb-20">
      {/* Shifts List */}
      <div className="lg:w-1/3 flex flex-col gap-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative group">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-indigo-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                <Briefcase size={22} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Available Shifts</h2>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 group-hover:scale-105 active:scale-95 duration-200"
              title="Add Shift"
            >
              <Plus size={20} className="stroke-[3px]" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[500px] overflow-auto">
            {shifts.map(shift => (
              <div key={shift.id} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-white hover:border-indigo-200 transition-all duration-300 group hover:shadow-xl">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="font-black text-gray-900 group-hover:text-indigo-700 transition-colors flex items-center gap-2">
                     <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                     {shift.name}
                   </h3>
                   <span className="text-[10px] uppercase font-black tracking-widest bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full shadow-sm">
                     {shift.total_hours_required}<span className="ml-0.5">hrs Required</span>
                   </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm group-hover:border-indigo-100 transition duration-300">
                    <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter mb-1.5 flex items-center gap-1.5 line-clamp-1 overflow-hidden">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div> Morning Session
                    </div>
                    <p className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                      <Clock size={12} className="text-indigo-400 group-hover:animate-pulse" /> 
                      {shift.start_time_1} - {shift.end_time_1}
                    </p>
                  </div>
                  {shift.start_time_2 && (
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm group-hover:border-indigo-100 transition duration-300">
                      <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter mb-1.5 flex items-center gap-1.5 line-clamp-1 overflow-hidden">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div> afternoon session
                      </div>
                      <p className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                        <Clock size={12} className="text-orange-400 group-hover:animate-pulse" />
                        {shift.start_time_2} - {shift.end_time_2}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Users Assignment */}
      <div className="lg:w-2/3">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden h-full flex flex-col group">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-blue-50/50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
                <UserCheck size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Assign Shifts</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Manage employee working hours</p>
              </div>
            </div>
            {successMsg && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-2.5 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                <CheckCircle2 size={16} className="stroke-[3px]" />
                <span className="text-sm font-black tracking-tighter">{successMsg}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
            {users.map(user => (
              <div key={user.user_id} className="group/item flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-50 transition-all duration-300 relative overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-0 group-hover/item:opacity-[0.03] pointer-events-none transition duration-500">
                    <Hash className="absolute right-0 top-0 w-32 h-32 -rotate-12" />
                </div>

                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-100 group-hover/item:scale-105 transition-transform duration-500">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg group-hover/item:text-blue-700 transition duration-300">{user.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">{user.department}</span>
                      <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-tighter">UID: {user.user_id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 relative z-10">
                  <div className="flex flex-col items-end gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5">Assigned Shift</label>
                    <select 
                      value={user.shift_id || ""}
                      onChange={(e) => assignShift(user.user_id, e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-2.5 text-sm font-black text-gray-700 focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-400 outline-none transition-all duration-300 cursor-pointer appearance-none min-w-[200px] shadow-sm hover:border-blue-200"
                    >
                      <option value="" disabled className="font-bold text-gray-400">--- Select Shift ---</option>
                      {shifts.map(s => (
                        <option key={s.id} value={s.id} className="font-bold text-gray-700 py-2">{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 group-hover/item:bg-blue-50 group-hover/item:border-blue-100 transition-colors duration-300">
                      <ChevronRight className="text-gray-300 group-hover/item:text-blue-600 transition" size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] w-full max-w-lg border border-white/20 animate-in slide-in-from-bottom-8 duration-500 overflow-hidden">
            <div className="p-10 pb-6">
                <div className="flex items-center gap-5 mb-10">
                    <div className="p-4 bg-indigo-600 rounded-[1.25rem] text-white shadow-2xl shadow-indigo-200 rotate-6">
                        <Settings size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Create Shift</h2>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Configure Working Protocol</p>
                    </div>
                </div>

                <form onSubmit={handleAddShift} className="space-y-8">
                  <div className="relative group">
                    <label className="absolute -top-3 left-6 bg-white px-2.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest z-10 transition-all duration-300 group-focus-within:scale-110">Shift Reference Name</label>
                    <input 
                      required
                      placeholder="e.g. Regular Day Shift"
                      className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-[1.25rem] px-8 py-5 font-black text-gray-700 focus:ring-8 focus:ring-indigo-50 focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-gray-300 placeholder:font-bold shadow-inner"
                      value={newShift.name}
                      onChange={e => setNewShift({...newShift, name: e.target.value})}
                    />
                  </div>

                  <div className="bg-indigo-50/30 p-8 rounded-[2rem] border border-indigo-100/50 space-y-10 group/sessions shadow-inner relative">
                    <div className="absolute right-6 top-6 opacity-10 group-hover/sessions:scale-110 transition duration-700">
                        <Clock size={40} className="text-indigo-900" />
                    </div>

                    <div className="space-y-4">
                        <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Morning Session (REQUIRED)
                        </div>
                        <div className="grid grid-cols-2 gap-6 relative">
                            <input 
                                type="time" required
                                className="bg-white border-2 border-indigo-100 rounded-2xl px-6 py-4 font-black text-gray-700 focus:border-indigo-600 outline-none shadow-sm transition-all text-center text-lg"
                                value={newShift.start_time_1}
                                onChange={e => setNewShift({...newShift, start_time_1: e.target.value})}
                            />
                            <input 
                                type="time" required
                                className="bg-white border-2 border-indigo-100 rounded-2xl px-6 py-4 font-black text-gray-700 focus:border-indigo-600 outline-none shadow-sm transition-all text-center text-lg"
                                value={newShift.end_time_1}
                                onChange={e => setNewShift({...newShift, end_time_1: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="text-[11px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-orange-400"></div> Afternoon Session (OPTIONAL)
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <input 
                                type="time"
                                className="bg-white border-2 border-orange-100 rounded-2xl px-6 py-4 font-black text-gray-700 focus:border-orange-600 outline-none shadow-sm transition-all text-center text-lg placeholder-gray-200"
                                value={newShift.start_time_2}
                                onChange={e => setNewShift({...newShift, start_time_2: e.target.value})}
                            />
                            <input 
                                type="time"
                                className="bg-white border-2 border-orange-100 rounded-2xl px-6 py-4 font-black text-gray-700 focus:border-orange-600 outline-none shadow-sm transition-all text-center text-lg placeholder-gray-200"
                                value={newShift.end_time_2}
                                onChange={e => setNewShift({...newShift, end_time_2: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="relative group/hours">
                        <label className="absolute -top-3 left-6 bg-white px-2.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest z-10">DAILY Hour Target</label>
                        <input 
                            type="number" step="0.5" required
                            className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-8 py-4 font-black text-gray-800 focus:border-emerald-600 outline-none shadow-sm transition-all text-xl"
                            value={newShift.total_hours_required}
                            onChange={e => setNewShift({...newShift, total_hours_required: parseFloat(e.target.value)})}
                        />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 py-5 rounded-[1.5rem] font-black text-gray-400 border-2 border-gray-100 hover:bg-gray-50 transition active:scale-95 duration-200 tracking-tighter"
                    >
                      ABORT
                    </button>
                    <button 
                      type="submit" 
                      className="flex-3 bg-indigo-600 text-white rounded-[1.5rem] font-black hover:bg-indigo-700 transition shadow-2xl shadow-indigo-200 px-12 py-5 flex items-center justify-center gap-3 active:scale-95 duration-200 tracking-tighter"
                    >
                      <Save size={20} className="stroke-[2.5px]" />
                      DEPLOY SHIFT
                    </button>
                  </div>
                </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagement;
