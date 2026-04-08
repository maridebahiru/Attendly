import React, { useState } from 'react';
import client from '../api/client';
import { Settings, User, Lock, Save, CheckCircle, AlertCircle } from 'lucide-react';

const ProfileSettings = () => {
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await client.put('/admin/me', {
        username: username,
        ...(password && { password: password })
      });

      localStorage.setItem('username', response.data.username);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setPassword('');
      
      // Optional: force logout if username changed to re-login? 
      // For now just update storage.
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      const errorText = Array.isArray(errorDetail) 
        ? errorDetail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ') 
        : (typeof errorDetail === 'string' ? errorDetail : 'Failed to update profile.');
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 mt-8">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Settings size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Account Settings</h2>
            <p className="text-sm text-gray-500">Update your credentials and profile info</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <User size={20} />
              </div>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">New Password</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Lock size={20} />
              </div>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                placeholder="Leave blank to keep current"
              />
            </div>
            <p className="text-[11px] text-gray-400 ml-1 italic">Only enter a password if you wish to change it.</p>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (
              <>
                <Save size={20} />
                Update Profile
              </>
            )}
          </button>
        </form>

        {message.text && (
          <div className={`mt-8 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSettings;
