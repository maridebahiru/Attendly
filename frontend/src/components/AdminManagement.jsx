import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { UserPlus, Shield, Trash2, ShieldAlert, RefreshCw, CheckCircle, MoreVertical, ShieldCheck, X, Check } from 'lucide-react';

const modules = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'users', name: 'User Management' },
  { id: 'privileges', name: 'Privilege Management' },
  { id: 'reports', name: 'Reports' },
  { id: 'logs', name: 'Attendance Logs' },
  { id: 'admins', name: 'Admin Management' },
  { id: 'settings', name: 'Settings' }
];

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [selectedPrivs, setSelectedPrivs] = useState(['dashboard']);
  const [submitting, setSubmitting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
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
    setSubmitting(true);
    
    try {
      const finalPrivs = role === 'super_admin' ? modules.map(m => m.id) : selectedPrivs;
      await client.post('/admins', { username, password, role, privileges: finalPrivs });
      setSuccess(`Account for "${username}" created successfully.`);
      setUsername('');
      setPassword('');
      setSelectedPrivs(['dashboard']);
      fetchAdmins();
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      const errorText = Array.isArray(errorDetail) 
        ? errorDetail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ') 
        : (typeof errorDetail === 'string' ? errorDetail : 'Failed to create admin.');
      setError(errorText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove administrative access for "${name}"?`)) return;
    
    try {
      await client.delete(`/admins/${id}`);
      setSuccess(`Removed administrator "${name}".`);
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete administrator.");
    }
  };

  const handleTogglePrivilege = async (admin, moduleId) => {
    const currentPrivs = admin.privileges || [];
    const newPrivs = currentPrivs.includes(moduleId)
      ? currentPrivs.filter(id => id !== moduleId)
      : [...currentPrivs, moduleId];
    
    try {
      await client.put(`/admins/${admin.id}`, { privileges: newPrivs });
      setSuccess(`Updated privileges for ${admin.username}.`);
      fetchAdmins();
    } catch (err) {
      setError("Failed to update privileges.");
    }
  };

  const handleToggleRole = async (admin) => {
    const newRole = admin.role === 'admin' ? 'super_admin' : 'admin';
    const newPrivs = newRole === 'super_admin' ? modules.map(m => m.id) : admin.privileges;
    try {
      await client.put(`/admins/${admin.id}`, { role: newRole, privileges: newPrivs });
      setSuccess(`Updated ${admin.username} to ${newRole.replace('_', ' ')}.`);
      fetchAdmins();
    } catch (err) {
      setError("Failed to update role.");
    }
  };

  const toggleFormPriv = (moduleId) => {
    setSelectedPrivs(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">System Administrators</h1>
          <p className="text-gray-500 mt-1">Manage admin accounts and their granular page-level permissions.</p>
        </div>
        <button 
          onClick={fetchAdmins} 
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm font-bold">Refresh Data</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Creation Form */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sticky top-24">
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                  placeholder="e.g. manager_jane"
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
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Access Level</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${role === 'admin' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('super_admin')}
                    className={`py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${role === 'super_admin' ? 'bg-white text-purple-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    Super Admin
                  </button>
                </div>
              </div>

              {role === 'admin' && (
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Page Privileges</label>
                  <div className="grid grid-cols-1 gap-2">
                    {modules.map(mod => (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleFormPriv(mod.id)}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm font-bold ${
                          selectedPrivs.includes(mod.id) 
                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                            : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                        }`}
                      >
                        {mod.name}
                        {selectedPrivs.includes(mod.id) && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
              >
                {submitting ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />}
                Grant Access
              </button>
            </form>

            {(error || success) && (
              <div className={`mt-6 p-4 rounded-xl text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 ${error ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                {error ? <ShieldAlert size={18} className="mt-0.5 shrink-0" /> : <CheckCircle size={18} className="mt-0.5 shrink-0" />}
                <div className="flex-1">
                    <p className="font-bold">{error ? 'System Error' : 'Success'}</p>
                    <p className="opacity-90">{error || success}</p>
                </div>
                <button onClick={() => {setError(null); setSuccess('');}} className="p-1 hover:bg-black/5 rounded">
                    <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Admin List */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gray-800 rounded-xl text-white">
                  <Shield size={22} />
                </div>
                <h2 className="text-xl font-black text-gray-800 tracking-tight">Active Administrators</h2>
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-gray-200">
                {admins.length} Accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Identity</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Role</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Page Access</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading && admins.length === 0 ? (
                    <tr>
                        <td colSpan="4" className="px-8 py-12 text-center text-gray-400 italic">Loading administrators...</td>
                    </tr>
                  ) : admins.map(adm => (
                    <tr key={adm.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${adm.role === 'super_admin' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {adm.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-gray-900">{adm.username}</div>
                                <div className="text-[10px] text-gray-400 uppercase font-black tracking-tight mt-0.5">Joined {new Date(adm.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => handleToggleRole(adm)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${adm.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'}`}
                        >
                          {adm.role.replace('_', ' ')}
                        </button>
                      </td>
                      <td className="px-8 py-6">
                        {adm.role === 'super_admin' ? (
                          <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Full Access</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {modules.map(mod => {
                              const has = (adm.privileges || []).includes(mod.id);
                              return (
                                <button
                                  key={mod.id}
                                  onClick={() => handleTogglePrivilege(adm, mod.id)}
                                  className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-tight border transition-all ${
                                    has 
                                      ? 'bg-blue-50 border-blue-100 text-blue-600' 
                                      : 'bg-white border-gray-100 text-gray-300 hover:border-gray-300 hover:text-gray-500'
                                  }`}
                                  title={mod.name}
                                >
                                  {mod.id.substring(0, 4)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <button 
                                onClick={() => handleDeleteAdmin(adm.id, adm.username)}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Remove Access"
                            >
                                <Trash2 size={18} />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-all">
                                <MoreVertical size={18} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminManagement;
