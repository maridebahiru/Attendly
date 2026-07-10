import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import LiveFeed from './components/LiveFeed';
import AttendanceGrid from './components/AttendanceGrid';
import DeviceStatus from './components/DeviceStatus';
import StatsCards from './components/StatsCards';
import SyncButton from './components/SyncButton';
import UsersList from './components/UsersList';

import ReportsDashboard from './components/ReportsDashboard';
import AdminManagement from './components/AdminManagement';
import ProfileSettings from './components/ProfileSettings';
import AttendanceTable from './components/AttendanceTable';
import PrivilegeManagement from './components/PrivilegeManagement';
import SystemManagement from './components/SystemManagement';
import ShiftManagement from './components/ShiftManagement';
import AbsenceReporting from './components/AbsenceReporting';
import { Fingerprint, LayoutDashboard, Users as UsersIcon, Clock, FileText, LogOut, User as UserIcon, ShieldCheck, Settings, Key, SlidersHorizontal, UserX, ShieldAlert, Lock } from 'lucide-react';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const { lastEvent, deviceStatus, eventHistory } = useWebSocket();
  const [newEventsCount, setNewEventsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'users', 'shifts', 'reports', 'admins', 'settings'
  const userRole = localStorage.getItem('user_role');
  const userName = localStorage.getItem('username');
  const userPrivileges = JSON.parse(localStorage.getItem('privileges') || '[]');

  const hasPrivilege = (page) => {
    if (userRole === 'super_admin') return true;
    if (page === 'absences' && userRole === 'team_leader') return true;
    return userPrivileges.includes(page);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
    localStorage.removeItem('privileges');
    setToken(null);
  };

  const refreshAttendance = () => setNewEventsCount(prev => prev + 1);

  // Trigger refetches in other components when a new event arrives
  useEffect(() => {
    if (lastEvent) {
      setNewEventsCount(prev => prev + 1);
    }
  }, [lastEvent]);

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      {/* Header bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Fingerprint size={24} />
              </div>
              <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 hidden md:block tracking-tighter">
                Attendly
              </h1>
            </div>
            
            <nav className="flex items-center gap-1 border-l border-gray-200 pl-6 h-8">
              {hasPrivilege('dashboard') && (
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <LayoutDashboard size={16} className="mr-2" />
                  Dashboard
                </button>
              )}
              {hasPrivilege('users') && (
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <UsersIcon size={16} className="mr-2" />
                  Users
                </button>
              )}

              {hasPrivilege('absences') && (
                <button 
                  onClick={() => setActiveTab('absences')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === 'absences' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <UserX size={16} className="mr-2" />
                  Absences
                </button>
              )}

              {hasPrivilege('shifts') && (
                <button 
                  onClick={() => setActiveTab('shifts')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === 'shifts' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Clock size={16} className="mr-2" />
                  Shifts
                </button>
              )}
              
              {hasPrivilege('privileges') && (
                <button 
                  onClick={() => setActiveTab('privileges')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === 'privileges' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Key size={16} className="mr-2" />
                  Privileges
                </button>
              )}

              {hasPrivilege('reports') && (
                <button 
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <FileText size={16} className="mr-2" />
                  Reports
                </button>
              )}

              {hasPrivilege('logs') && (
                <button 
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-black transition ${
                    activeTab === 'logs' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Clock size={16} className="mr-2" />
                  Logs
                </button>
              )}

              {hasPrivilege('admins') && (
                <button 
                  onClick={() => setActiveTab('admins')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-black transition ${
                    activeTab === 'admins' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <ShieldCheck size={16} className="mr-2" />
                  Admins
                </button>
              )}

              {hasPrivilege('settings') && (
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-black transition ${
                    activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Settings size={16} className="mr-2" />
                  Profile
                </button>
              )}

              {hasPrivilege('system') && (
                <button 
                  onClick={() => setActiveTab('system')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-black transition ${
                    activeTab === 'system' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <SlidersHorizontal size={16} className="mr-2" />
                  System
                </button>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-6 hidden sm:flex">
            <DeviceStatus wsStatus={deviceStatus} />
            <SyncButton />
            
            <div className="h-8 w-px bg-gray-200"></div>
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-gray-900 leading-tight">{userName}</span>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{userRole?.replace('_', ' ')}</span>
              </div>
              <div className="bg-gray-100 p-2 rounded-full text-gray-500">
                <UserIcon size={18} />
              </div>
              <button 
                onClick={handleLogout}
                className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasPrivilege(activeTab) ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-200 blur-3xl opacity-20 rounded-full animate-pulse"></div>
              <div className="relative p-8 bg-white text-rose-600 rounded-[2.5rem] shadow-2xl shadow-rose-100 border border-rose-50 flex items-center justify-center">
                <ShieldAlert size={80} strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-rose-600 text-white p-2.5 rounded-2xl shadow-lg border-4 border-white">
                <Lock size={20} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-5xl font-black text-gray-900 tracking-tight">Access Restricted</h2>
              <p className="text-gray-500 max-w-md mx-auto text-lg leading-relaxed">
                The <span className="text-rose-600 font-black uppercase px-2 py-1 bg-rose-50 rounded-lg">{activeTab}</span> module requires specific permissions that your account currently lacks.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95 flex items-center gap-2"
              >
                <LayoutDashboard size={18} />
                Return to Dashboard
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-4 bg-white text-gray-600 border border-gray-200 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all active:scale-95"
              >
                Re-authenticate
              </button>
            </div>

            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Contact System Administrator for elevated access</p>
          </div>
        ) : activeTab === 'dashboard' ? (
          <>
            {/* Top metrics level */}
            <StatsCards newEventsCount={newEventsCount} />
            
            {/* Grid layout for main content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
              {/* Left partition: Live feed (1/4 width) */}
              <div className="lg:col-span-1 h-full">
                <LiveFeed events={eventHistory} />
              </div>
              
              {/* Right partition: Attendance Grid (3/4 width) */}
              <div className="lg:col-span-3 h-full">
                <AttendanceGrid newEventsCount={newEventsCount} />
              </div>
            </div>
          </>
        ) : activeTab === 'users' ? (
          <div className="h-[750px]">
             <UsersList />
          </div>
        ) : activeTab === 'absences' ? (
          <div className="h-[750px]">
             <AbsenceReporting />
          </div>
        ) : activeTab === 'shifts' ? (
          <div className="h-[750px]">
             <ShiftManagement />
          </div>

        ) : activeTab === 'reports' ? (
          <div className="h-[750px]">
             <ReportsDashboard refreshTrigger={newEventsCount} />
          </div>
        ) : activeTab === 'privileges' ? (
          <div className="h-[750px]">
             <PrivilegeManagement />
          </div>
        ) : activeTab === 'logs' ? (
          <div className="h-[750px]">
             <AttendanceTable newEventsCount={newEventsCount} onRefresh={refreshAttendance} />
          </div>
        ) : activeTab === 'admins' ? (
          <div className="h-[750px]">
             <AdminManagement />
          </div>
        ) : activeTab === 'system' ? (
          <div className="h-[750px]">
             <SystemManagement />
          </div>
        ) : (
          <div className="h-[700px]">
             <ProfileSettings />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
