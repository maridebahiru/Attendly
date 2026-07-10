import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { 
  Shield, 
  ShieldCheck, 
  User, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Users,
  Key,
  FileText,
  Clock,
  ShieldAlert,
  Settings,
  Lock,
  Unlock,
  Save,
  SlidersHorizontal,
  UserX
} from 'lucide-react';

const modules = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, description: 'Overview metrics and live activity feed' },
  { id: 'users', name: 'User Management', icon: Users, description: 'Manage biometric enrollments and user profiles' },
  { id: 'privileges', name: 'Privilege Management', icon: Key, description: 'Configure granular page-level access for admins' },
  { id: 'reports', name: 'Reports', icon: FileText, description: 'Generate and export attendance reports' },
  { id: 'logs', name: 'Attendance Logs', icon: Clock, description: 'View and edit raw punch records' },
  { id: 'admins', name: 'Admin Management', icon: ShieldAlert, description: 'Create and remove system administrator accounts' },
  { id: 'settings', name: 'Profile Settings', icon: Settings, description: 'Configure admin account credentials' },
  { id: 'system', name: 'System Management', icon: SlidersHorizontal, description: 'Configure global working hours, off days, and device connection' },
  { id: 'absences', name: 'Absence Management', icon: UserX, description: 'Manage employee absences, leaves and off-days' },
  { id: 'shifts', name: 'Shift Management', icon: Clock, description: 'Configure working hour shifts and assign them to employees' }
];

const PrivilegeManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const userRole = localStorage.getItem('user_role');
  const isSuperAdmin = userRole === 'super_admin';

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await client.get('/admins');
      setAdmins(response.data);
    } catch (err) {
      setErrorMsg('Failed to load system administrators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdmins();
    }
  }, [isSuperAdmin]);

  const handleTogglePrivilege = (adminId, moduleId) => {
    setAdmins(prev => prev.map(admin => {
      if (admin.id === adminId) {
        const currentPrivs = admin.privileges || [];
        const newPrivs = currentPrivs.includes(moduleId)
          ? currentPrivs.filter(id => id !== moduleId)
          : [...currentPrivs, moduleId];
        return { ...admin, privileges: newPrivs, isDirty: true };
      }
      return admin;
    }));
  };

  const handleSavePrivileges = async (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    if (!admin) return;

    setUpdatingId(adminId);
    setErrorMsg('');
    try {
      await client.put(`/admins/${adminId}`, { 
        privileges: admin.privileges 
      });
      
      setSuccessMsg(`Privileges for "${admin.username}" saved successfully.`);
      
      // Clear dirty flag
      setAdmins(prev => prev.map(a => 
        a.id === adminId ? { ...a, isDirty: false } : a
      ));

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(`Failed to save privileges for ${admin.username}.`);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-500">
        <div className="p-6 bg-rose-50 text-rose-600 rounded-3xl shadow-xl shadow-rose-100/50">
          <ShieldAlert size={64} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Access Denied</h2>
          <p className="text-gray-500 max-w-sm mx-auto">This module is reserved for <span className="text-rose-600 font-bold uppercase">Super Admins</span> only. Standard administrators cannot modify system privileges.</p>
        </div>
      </div>
    );
  }

  const filteredAdmins = admins.filter(admin => 
    admin.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Privilege Management</h1>
          <p className="text-gray-500 mt-2 text-lg">Control page-level access for system administrators.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search administrators..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none w-72 shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={fetchAdmins}
            className="p-3 bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-100 rounded-2xl transition-all shadow-sm active:scale-95 group"
            title="Refresh List"
          >
            <RefreshCw size={22} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="fixed bottom-8 right-8 z-50 space-y-4 pointer-events-none">
        {successMsg && (
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl shadow-emerald-200 animate-in slide-in-from-right duration-500 pointer-events-auto">
            <div className="bg-white/20 p-2 rounded-xl">
                <CheckCircle2 size={24} />
            </div>
            <div>
                <p className="font-black text-sm">Success</p>
                <p className="text-xs opacity-90">{successMsg}</p>
            </div>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-600 text-white px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl shadow-rose-200 animate-in slide-in-from-right duration-500 pointer-events-auto">
            <div className="bg-white/20 p-2 rounded-xl">
                <AlertCircle size={24} />
            </div>
            <div>
                <p className="font-black text-sm">Error</p>
                <p className="text-xs opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4">
        {loading && admins.length === 0 ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white h-24 rounded-3xl border border-gray-100 animate-pulse"></div>
          ))
        ) : filteredAdmins.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="flex justify-center mb-4 text-gray-300">
                <User size={64} />
            </div>
            <p className="text-gray-500 text-lg font-medium">No administrators found.</p>
          </div>
        ) : filteredAdmins.map((admin) => (
          <div 
            key={admin.id} 
            className={`group bg-white rounded-3xl border transition-all duration-500 overflow-hidden ${
              expandedId === admin.id 
                ? 'border-indigo-200 shadow-2xl shadow-indigo-50 ring-1 ring-indigo-50' 
                : 'border-gray-100 hover:border-gray-200 hover:shadow-lg'
            }`}
          >
            {/* Admin Header Row */}
            <div 
              onClick={() => setExpandedId(expandedId === admin.id ? null : admin.id)}
              className="px-8 py-6 flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                  expandedId === admin.id ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'
                }`}>
                  {admin.role === 'super_admin' ? <ShieldCheck size={28} /> : <User size={28} />}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">{admin.username}</h3>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      admin.role === 'super_admin' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {admin.role.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {admin.role === 'super_admin' 
                      ? 'Full system access granted' 
                      : `${(admin.privileges || []).length} active modules enabled`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {admin.isDirty && (
                    <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-full animate-pulse border border-amber-100">
                        <Save size={12} />
                        Unsaved Changes
                    </span>
                )}
                <div className={`p-2 rounded-xl transition-all duration-500 ${
                  expandedId === admin.id ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'text-gray-300 group-hover:text-gray-600'
                }`}>
                  <ChevronDown size={24} />
                </div>
              </div>
            </div>

            {/* Expandable Privilege Grid */}
            <div className={`transition-all duration-500 ease-in-out ${
              expandedId === admin.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
            }`}>
              <div className="px-8 pb-8 pt-4 border-t border-gray-50 bg-gray-50/30">
                {admin.role === 'super_admin' ? (
                  <div className="bg-white rounded-2xl p-10 border border-purple-100 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                        <Lock size={32} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-gray-900">Privileges Locked</h4>
                        <p className="text-gray-500 max-w-md mx-auto mt-2">Super Admins automatically have access to all system modules. Their privileges cannot be restricted to ensure system continuity.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {modules.map((module) => {
                        const isEnabled = (admin.privileges || []).includes(module.id);
                        const Icon = module.icon;
                        
                        return (
                          <div 
                            key={module.id}
                            onClick={() => handleTogglePrivilege(admin.id, module.id)}
                            className={`group/card p-5 rounded-3xl border transition-all duration-300 cursor-pointer flex items-start gap-4 ${
                              isEnabled 
                                ? 'bg-white border-indigo-200 shadow-md shadow-indigo-100/50' 
                                : 'bg-gray-50/50 border-gray-100 opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                            }`}
                          >
                            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                              isEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400'
                            }`}>
                              <Icon size={24} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`font-black text-sm tracking-tight ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {module.name}
                                </h4>
                                
                                {/* Toggle Switch */}
                                <div className={`w-10 h-5 rounded-full transition-colors relative ${isEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${isEnabled ? 'left-6' : 'left-1'}`}></div>
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{module.description}</p>
                              
                              <div className="mt-3 flex items-center gap-2">
                                {isEnabled ? (
                                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                                        <Unlock size={10} /> Authorized
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                        <Lock size={10} /> Restricted
                                    </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions Footer */}
                    <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-100">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(null);
                        }}
                        className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        disabled={!admin.isDirty || updatingId === admin.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavePrivileges(admin.id);
                        }}
                        className={`px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                          !admin.isDirty 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                            : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                        }`}
                      >
                        {updatingId === admin.id ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Save Configuration
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivilegeManagement;
