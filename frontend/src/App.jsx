import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import LiveFeed from './components/LiveFeed';
import AttendanceGrid from './components/AttendanceGrid';
import DeviceStatus from './components/DeviceStatus';
import StatsCards from './components/StatsCards';
import SyncButton from './components/SyncButton';
import UsersList from './components/UsersList';
import ShiftManagement from './components/ShiftManagement';
import DailyReport from './components/DailyReport';
import AdminManagement from './components/AdminManagement';
import ProfileSettings from './components/ProfileSettings';
import AttendanceTable from './components/AttendanceTable';
import { Fingerprint, LayoutDashboard, Users as UsersIcon, Clock, FileText, LogOut, User as UserIcon, ShieldCheck, Settings } from 'lucide-react';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const { lastEvent, deviceStatus, eventHistory } = useWebSocket('ws://127.0.0.1:8000/ws');
  const [newEventsCount, setNewEventsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'users', 'shifts', 'reports', 'admins', 'settings'
  const userRole = localStorage.getItem('user_role');
  const userName = localStorage.getItem('username');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
    setToken(null);
  };

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
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <LayoutDashboard size={16} className="mr-2" />
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <UsersIcon size={16} className="mr-2" />
                Users
              </button>
              <button 
                onClick={() => setActiveTab('shifts')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === 'shifts' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Clock size={16} className="mr-2" />
                Shifts
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition ${
                  activeTab === 'reports' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <FileText size={16} className="mr-2" />
                Reports
              </button>

              {userRole === 'super_admin' && (
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

              {userRole === 'super_admin' && (
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

              <button 
                onClick={() => setActiveTab('settings')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-black transition ${
                  activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Settings size={16} className="mr-2" />
                Settings
              </button>
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
        {activeTab === 'dashboard' ? (
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
        ) : activeTab === 'shifts' ? (
          <div className="h-[750px]">
             <ShiftManagement />
          </div>
        ) : activeTab === 'reports' ? (
          <div className="h-[750px]">
             <DailyReport />
          </div>
        ) : activeTab === 'logs' ? (
          <div className="h-[750px]">
             <AttendanceTable newEventsCount={newEventsCount} />
          </div>
        ) : activeTab === 'admins' ? (
          <div className="h-[750px]">
             <AdminManagement />
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
