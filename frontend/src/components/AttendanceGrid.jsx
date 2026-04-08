import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { User, Clock, Search, Filter, Calendar } from 'lucide-react';

export default function AttendanceGrid({ newEventsCount }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [nameFilter, setNameFilter] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/attendance?target_date=${selectedDate}`;
      if (nameFilter) url += `&name=${nameFilter}`;
      
      const response = await client.get(url);
      setReportData(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard records", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDate, nameFilter, newEventsCount]);

  const getPunchByOrder = (punches, order) => {
    // order 0: Morning In, 1: Morning Out, 2: Afternoon In, 3: Afternoon Out
    if (punches && punches[order]) {
      return punches[order].time;
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header with Search and Date */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-blue-600" size={20} />
          Attendance Dashboard
        </h2>
        
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Filter by name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Structured Table View */}
      <div className="flex-1 overflow-auto bg-white">
        {loading && reportData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">User Details</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Morning In</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Morning Out</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Afternoon In</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Afternoon Out</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">No records found for the selected date or name.</td>
                </tr>
              ) : (
                reportData.map((user) => (
                  <tr key={user.user_id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{user.name}</span>
                        <span className="text-xs text-gray-500 font-medium">ID: {user.user_id}</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-black ${getPunchByOrder(user.punches, 0) ? 'text-blue-600' : 'text-gray-300'}`}>
                        {getPunchByOrder(user.punches, 0) || '---'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-black ${getPunchByOrder(user.punches, 1) ? 'text-orange-600' : 'text-gray-300'}`}>
                        {getPunchByOrder(user.punches, 1) || '---'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-black ${getPunchByOrder(user.punches, 2) ? 'text-blue-600' : 'text-gray-300'}`}>
                        {getPunchByOrder(user.punches, 2) || '---'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-black ${getPunchByOrder(user.punches, 3) ? 'text-orange-600' : 'text-gray-300'}`}>
                        {getPunchByOrder(user.punches, 3) || '---'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
