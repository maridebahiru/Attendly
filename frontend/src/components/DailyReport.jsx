import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Calendar, Clock, User, Download, RefreshCw, AlertCircle, FileText } from 'lucide-react';

const DailyReport = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [nameFilter, setNameFilter] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/attendance?`;
      if (viewMode === 'daily') {
        url += `target_date=${selectedDate}`;
      } else {
        url += `month=${selectedMonth}&year=${selectedYear}`;
      }
      
      if (nameFilter) url += `&name=${nameFilter}`;
      
      const response = await client.get(url);
      setReportData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Failed to fetch attendance report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate, selectedMonth, selectedYear, viewMode, nameFilter]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Attendance Analytics</h2>
            <p className="text-sm text-gray-500">Analyze punctuality and working hours</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <button 
              onClick={() => setViewMode('daily')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Daily
            </button>
            <button 
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Monthly
            </button>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'daily' ? (
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <div className="flex gap-2">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {months.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Search name..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
             <RefreshCw size={32} className="animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-10 text-center text-red-500 font-medium">{error}</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">Worked Hours</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">Late Arrivals</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">Overtime</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {reportData.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">ID: {user.user_id} • {user.shift_name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-black ${user.total_hours >= user.required_hours ? 'text-green-600' : 'text-blue-600'}`}>
                      {user.total_hours} <span className="text-[10px] text-gray-400">HRS</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.late_count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {user.late_count} {user.late_count === 1 ? 'Time' : 'Times'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold">
                    {user.overtime_hours > 0 ? (
                      <span className="text-orange-600">+{user.overtime_hours} hrs</span>
                    ) : (
                      <span className="text-gray-300">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded text-[11px] font-black uppercase ${user.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                   <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DailyReport;
