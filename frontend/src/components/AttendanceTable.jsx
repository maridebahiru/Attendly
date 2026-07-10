import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Filter, ChevronLeft, ChevronRight, Edit2, Save, X } from 'lucide-react';
import { toEthiopianTime, toStandardTime } from '../utils/timeConversion';

export default function AttendanceTable({ newEventsCount, onRefresh }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    date: '',
    userId: ''
  });
  const limit = 15;
  const userRole = localStorage.getItem('user_role');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/attendance?skip=${page * limit}&limit=${limit}&_t=${Date.now()}`;
      if (filters.date) url += `&date=${filters.date}`;
      if (filters.userId) url += `&user_id=${filters.userId}`;
      
      const response = await client.get(url);
      setLogs(response.data);
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filters, newEventsCount]); 

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(0); // Reset page on filter change
  };

  const startEdit = (log) => {
    setEditingId(log.id);
    // Convert log.timestamp from standard time to Ethiopian time before editing
    const formattedDate = log.timestamp ? toEthiopianTime(log.timestamp) : '';
    setEditTime(formattedDate);
    setEditType(log.punch_type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTime('');
    setEditType('');
  };

  const saveEdit = async (logId) => {
    try {
      const userName = localStorage.getItem('username') || 'Admin';
      // Convert edited Ethiopian time back to standard time before sending to the API
      const standardTime = toStandardTime(editTime);
      await client.put(`/attendance/${logId}`, {
        timestamp: standardTime, 
        punch_type: editType,
        edited_by: userName
      });
      setEditingId(null);
      fetchLogs(); // Refresh local list
      if (onRefresh) onRefresh(); // Trigger global refresh
    } catch (error) {
      alert("Failed to update log: " + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Detailed logs</h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="date"
              name="date"
              value={filters.date}
              onChange={handleFilterChange}
              className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <input
            type="text"
            name="userId"
            placeholder="Filter by User ID"
            value={filters.userId}
            onChange={handleFilterChange}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 bg-opacity-90 backdrop-blur-sm z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time (Device)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sync Status</th>
              {userRole === 'super_admin' && (
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-gray-500">Loading records...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-gray-500">No attendance records found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{log.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">ID: {log.user_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId && editingId === log.id ? (
                      <input 
                         type="datetime-local" 
                        step="1"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : (
                      <>
                        <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded font-black tracking-wider uppercase">ETH</span>
                          {log.eth_date || toEthiopianTime(new Date(log.timestamp)).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500 font-medium pl-9">
                          {log.eth_time || toEthiopianTime(new Date(log.timestamp)).toLocaleTimeString()}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId && editingId === log.id ? (
                      <select 
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="IN">IN</option>
                        <option value="OUT">OUT</option>
                      </select>
                    ) : (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.punch_type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.punch_type}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${
                      log.punch_label === 'Morning In' ? 'bg-blue-100 text-blue-800' :
                      log.punch_label === 'Morning Out' ? 'bg-orange-100 text-orange-800' :
                      log.punch_label === 'Afternoon In' ? 'bg-indigo-100 text-indigo-800' :
                      log.punch_label === 'Afternoon Out' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {log.punch_label || 'Unclassified'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      log.sync_status === 'synced' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {log.sync_status}
                    </span>
                  </td>
                  {userRole === 'super_admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingId && editingId === log.id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => saveEdit(log.id)} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg transition-colors">
                            <Save size={16} />
                          </button>
                          <button onClick={cancelEdit} className="text-gray-600 hover:text-gray-900 bg-gray-50 p-1.5 rounded-lg transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => startEdit(log)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1.5 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing page <span className="font-medium">{page + 1}</span>
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${page === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={logs.length < limit}
                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${logs.length < limit ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
