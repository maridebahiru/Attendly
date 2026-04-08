import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { UserPlus, Shield, Trash2, ShieldAlert, RefreshCw, CheckCircle } from 'lucide-react';

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');

  const fetchAdmins = async () => {
    try {
      const response = await client.get('/admins');
      setAdmins(response.data);
    } catch (err) {
      setError('Failed to fetch administrators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess('');
    
    try {
      await client.post('/admins', { username, password, role });
      setSuccess(`User ${username} created successfully.`);
      setUsername('');
      setPassword('');
      fetchAdmins();
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      const errorText = Array.isArray(errorDetail) 
        ? errorDetail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ') 
        : (typeof errorDetail === 'string' ? errorDetail : 'Failed to create admin.');
      setError(errorText);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6">
      {/* Creation Form */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
            <UserPlus size={22} />
          </div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Add Administrator</h2>
        </div>

        <form onSubmit={handleCreateAdmin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
            <input 
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g. hr_manager"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Initial Password</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">System Role</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="admin">HR User (Admin)</option>
              <option value="super_admin">System Owner (Super Admin)</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            Create Account
          </button>
        </form>

        {(error || success) && (
          <div className={`mt-6 p-4 rounded-xl text-sm flex items-start gap-3 ${error ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
            {error ? <ShieldAlert size={18} className="mt-0.5" /> : <CheckCircle size={18} className="mt-0.5" />}
            <span>{error || success}</span>
          </div>
        )}
      </div>

      {/* Admin List */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-800 rounded-xl text-white">
              <Shield size={22} />
            </div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight">Active Administrators</h2>
          </div>
          <button onClick={fetchAdmins} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Username</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Created On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map(adm => (
                <tr key={adm.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-gray-900">{adm.username}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${adm.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {adm.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs text-gray-400">{new Date(adm.created_at).toLocaleDateString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminManagement;
