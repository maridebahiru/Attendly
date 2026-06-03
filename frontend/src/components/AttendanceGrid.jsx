import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { User, Clock, Search, Filter, Calendar } from 'lucide-react';

export default function AttendanceGrid({ newEventsCount }) {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [holidayName, setHolidayName] = useState(null);
  const [nameFilter, setNameFilter] = useState('');

  const ethiopianMonths = [
    "Meskerem", "Tekemt", "Hedar", "Tahsas", "Ter", "Yekatit",
    "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
  ];

  useEffect(() => {
    // On mount, fetch today's Ethiopian calendar date
    const initDate = async () => {
      try {
        const res = await client.get('/calendar/today');
        if (res.data) {
          setSelectedDay(res.data.day);
          setSelectedMonth(res.data.month);
          setSelectedYear(res.data.year);
        }
      } catch (e) {
        console.error("Failed to fetch Ethiopian calendar today", e);
        // Fallback
        const today = new Date();
        setSelectedDay(today.getDate());
        setSelectedMonth(today.getMonth() + 1);
        setSelectedYear(today.getFullYear());
      }
    };
    initDate();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/attendance?eth_year=${selectedYear}&eth_month=${selectedMonth}&eth_day=${selectedDay}`;
      if (nameFilter) url += `&name=${nameFilter}`;
      
      const response = await client.get(url);
      setReportData(response.data);

      // Extract active holiday if today is a holiday
      const holidayStatus = response.data.length > 0 
        ? response.data[0].daily_details?.find(d => d.status.startsWith("Holiday:"))?.status 
        : null;
      setHolidayName(holidayStatus ? holidayStatus.replace("Holiday: ", "") : null);
    } catch (error) {
      console.error("Failed to fetch dashboard records", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedYear && selectedMonth && selectedDay) {
      fetchReport();
    }
  }, [selectedYear, selectedMonth, selectedDay, nameFilter, newEventsCount]);

  const getPunchByLabel = (punches, label) => {
    // We now look for the specific persisted label rather than relying on array order
    if (punches) {
      const punch = punches.find(p => p.label === label);
      return punch ? punch.time : '';
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
          
          {selectedDay && selectedMonth && selectedYear && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
              <Calendar className="text-blue-600 mx-1.5" size={16} />
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                className="px-1 py-1 text-xs font-bold text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                {selectedMonth === 13 
                  ? [...Array(6)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)
                  : [...Array(30)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)
                }
              </select>
              <span className="text-gray-300 text-xs">/</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = parseInt(e.target.value);
                  setSelectedMonth(m);
                  if (m === 13 && selectedDay > 6) {
                    setSelectedDay(5); // Reset to Pagume bounds
                  }
                }}
                className="px-1 py-1 text-xs font-bold text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                {ethiopianMonths.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
              <span className="text-gray-300 text-xs">/</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-1 py-1 text-xs font-bold text-gray-700 bg-transparent outline-none cursor-pointer"
              >
                {[2016, 2017, 2018, 2019, 2020].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {holidayName && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top duration-300 shrink-0">
          <span className="text-xl">🇪🇹</span>
          <div className="flex-1">
            <span className="text-xs font-black text-blue-900 uppercase tracking-wide">Public Holiday today: </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">{holidayName}</span>
          </div>
        </div>
      )}

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
                  <React.Fragment key={user.user_id}>
                    <tr className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{user.name}</span>
                        <span className="text-xs text-gray-500 font-medium">ID: {user.user_id}</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black uppercase mb-1 px-1.5 py-0.5 rounded ${getPunchByLabel(user.punches, "Morning In") ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>Morning In</span>
                        <span className={`text-sm font-black ${getPunchByLabel(user.punches, "Morning In") ? 'text-blue-600' : 'text-gray-300'}`}>
                          {getPunchByLabel(user.punches, "Morning In") || 'Not Scanned'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black uppercase mb-1 px-1.5 py-0.5 rounded ${getPunchByLabel(user.punches, "Morning Out") ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>Morning Out</span>
                        <span className={`text-sm font-black ${getPunchByLabel(user.punches, "Morning Out") ? 'text-orange-600' : 'text-gray-300'}`}>
                          {getPunchByLabel(user.punches, "Morning Out") || 'Not Scanned'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black uppercase mb-1 px-1.5 py-0.5 rounded ${getPunchByLabel(user.punches, "Afternoon In") ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>Afternoon In</span>
                        <span className={`text-sm font-black ${getPunchByLabel(user.punches, "Afternoon In") ? 'text-blue-600' : 'text-gray-300'}`}>
                          {getPunchByLabel(user.punches, "Afternoon In") || 'Not Scanned'}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black uppercase mb-1 px-1.5 py-0.5 rounded ${getPunchByLabel(user.punches, "Afternoon Out") ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>Afternoon Out</span>
                        <span className={`text-sm font-black ${getPunchByLabel(user.punches, "Afternoon Out") ? 'text-orange-600' : 'text-gray-300'}`}>
                          {getPunchByLabel(user.punches, "Afternoon Out") || 'Not Scanned'}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {user.punches?.some(p => p.label === "Unclassified") && (
                    <tr className="bg-gray-50/50">
                      <td colSpan="5" className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Unclassified Scans:</span>
                          <div className="flex flex-wrap gap-2">
                            {user.punches.filter(p => p.label === "Unclassified").map((p, idx) => (
                              <span key={idx} className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                {p.time}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
