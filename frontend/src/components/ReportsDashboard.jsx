import React, { useState, useEffect, useMemo } from 'react';
import client from '../api/client';
import { 
  Calendar, Clock, User, Download, RefreshCw, AlertCircle, FileText, 
  BarChart3, PieChart as PieChartIcon, TrendingUp, Filter, Search,
  ChevronRight, AlertTriangle, CheckCircle2, History, XCircle, FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const DeviceHistoryList = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await client.get('/device/history');
        setHistory(res.data);
      } catch (err) {
        console.error("Failed to fetch device history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">
    {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl"></div>)}
  </div>;

  return (
    <div className="space-y-3">
      {history.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.status === 'online' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              <RefreshCw size={16} className={item.status === 'online' ? '' : 'rotate-45'} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 capitalize">Device went {item.status}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">{item.device_ip}</div>
            </div>
          </div>
          <div className="text-right">
             <div className="text-xs font-black text-slate-700">{new Date(item.timestamp).toLocaleTimeString()}</div>
             <div className="text-[10px] font-bold text-slate-400 uppercase">{new Date(item.timestamp).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
      {history.length === 0 && <p className="text-center py-10 text-slate-400 italic">No activity logged yet.</p>}
    </div>
  );
};

const ReportsDashboard = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'monthly'
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'details', 'missing', 'charts', 'device'
  
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedYear, setSelectedYear] = useState(2016);
  const [nameFilter, setNameFilter] = useState('');
  
  const userRole = localStorage.getItem('user_role');
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  useEffect(() => {
    // A simplified initial fetch could set current eth date, but since we don't have it on frontend natively,
    // we just default to a known year or wait for user to select. We default to 1/1/2016.
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/attendance?`;
      if (viewMode === 'daily') {
        url += `eth_year=${selectedYear}&eth_month=${selectedMonth}&eth_day=${selectedDay}`;
      } else {
        url += `month=${selectedMonth}&year=${selectedYear}`;
      }
      
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
  }, [selectedDay, selectedMonth, selectedYear, viewMode]);

  const filteredData = useMemo(() => {
    if (!nameFilter) return reportData;
    return reportData.filter(item => 
      item.name.toLowerCase().includes(nameFilter.toLowerCase()) || 
      item.user_id.toLowerCase().includes(nameFilter.toLowerCase())
    );
  }, [reportData, nameFilter]);

  // Calculated Stats
  const stats = useMemo(() => {
    if (!filteredData.length) return { present: 0, late: 0, early: 0, missing: 0, overtime: 0 };
    
    return {
      present: filteredData.filter(u => u.status === 'Present').length,
      late: filteredData.reduce((acc, curr) => acc + (curr.late_count > 0 ? 1 : 0), 0),
      early: filteredData.reduce((acc, curr) => acc + (curr.early_departure_count > 0 ? 1 : 0), 0),
      missing: filteredData.reduce((acc, curr) => acc + (curr.missing_punches > 0 ? 1 : 0), 0),
      overtime: filteredData.reduce((acc, curr) => acc + (curr.overtime_hours > 0 ? 1 : 0), 0)
    };
  }, [filteredData]);

  // Chart Data
  const chartData = useMemo(() => {
    // For Bar Chart: Late vs Early vs OnTime
    const data = [
      { name: 'On Time', value: filteredData.filter(u => u.late_count === 0 && u.status === 'Present').length },
      { name: 'Late', value: filteredData.filter(u => u.late_count > 0).length },
      { name: 'Early Left', value: filteredData.filter(u => u.early_departure_count > 0).length },
      { name: 'Missing Punch', value: filteredData.filter(u => u.missing_punches > 0).length },
    ];
    return data;
  }, [filteredData]);

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(u => ({
      'ID': u.user_id,
      'Name': u.name,
      'Department': u.department,
      'Total Hours': u.total_hours,
      'Days Present': u.days_present,
      'Late Count': u.late_count,
      'Late Minutes': u.late_minutes,
      'Early Departures': u.early_departure_count,
      'Early Minutes': u.early_departure_minutes,
      'Missing Punches': u.missing_punches,
      'Overtime Hours': u.overtime_hours,
      'Status': u.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `Attendance_Report_${viewMode === 'daily' ? `${selectedYear}_${selectedMonth}_${selectedDay}` : selectedMonth + '_' + selectedYear}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text("Attendance Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Period: ${viewMode === 'daily' ? `${selectedDay}/${selectedMonth}/${selectedYear}` : selectedMonth + '/' + selectedYear} (Ethiopian Calendar)`, 14, 36);

    const tableData = filteredData.map(u => [
      u.user_id, u.name, u.department, u.total_hours, u.late_count, u.late_minutes, u.early_departure_count, u.missing_punches, u.overtime_hours, u.status
    ]);

    doc.autoTable({
      startY: 45,
      head: [['ID', 'Name', 'Dept', 'HRS', 'Late #', 'Late min', 'Early #', 'Missing', 'OT', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 }
    });

    doc.save(`Attendance_Report_${viewMode === 'daily' ? `${selectedYear}_${selectedMonth}_${selectedDay}` : selectedMonth + '_' + selectedYear}.pdf`);
  };

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-3xl border border-slate-200 overflow-hidden shadow-2xl">
      {/* Top Header Section */}
      <div className="bg-white p-6 border-b border-slate-100 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
              <BarChart3 size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reports & Analytics</h2>
              <p className="text-slate-500 text-sm font-medium">Comprehensive attendance tracking and discipline reports</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setViewMode('daily')}
                className={`px-5 py-2 text-xs font-black rounded-lg transition-all ${viewMode === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                DAILY
              </button>
              <button 
                onClick={() => setViewMode('monthly')}
                className={`px-5 py-2 text-xs font-black rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                MONTHLY
              </button>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>

            {/* Date/Month Picker */}
            {viewMode === 'daily' ? (
              <div className="flex gap-2">
                <select 
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                >
                  {[...Array(30)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                </select>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                >
                  {["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"].map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                >
                  {[2016, 2017, 2018].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                >
                  {["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"].map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                >
                  {[2016, 2017, 2018].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportExcel}
                  className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"
                  title="Export to Excel"
                >
                  <FileSpreadsheet size={20} />
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100"
                  title="Export to PDF"
                >
                  <FileText size={20} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 mt-8 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'summary', name: 'Overview', icon: TrendingUp },
            { id: 'details', name: 'Full Log Report', icon: History },
            { id: 'missing', name: 'Incomplete Punches', icon: AlertTriangle },
            { id: 'charts', name: 'Visual Charts', icon: PieChartIcon },
            { id: 'device', name: 'Device Activity', icon: RefreshCw },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-all whitespace-nowrap text-sm font-bold ${
                activeTab === tab.id 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon size={18} />
              {tab.name}
              {tab.id === 'missing' && stats.missing > 0 && (
                <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full ring-1 ring-amber-200">
                  {stats.missing}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
             <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
             <p className="text-slate-500 font-bold animate-pulse">Generating Report...</p>
          </div>
        ) : activeTab === 'device' ? (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
             <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
               <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                 <History size={20} className="text-blue-500" />
                 Connectivity History
               </h3>
               <DeviceHistoryList />
             </div>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-rose-500 gap-3">
            <XCircle size={48} className="opacity-20" />
            <p className="font-bold">{error}</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Search size={48} className="opacity-10" />
            <p className="font-medium italic">No attendance records found for this period.</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Search + Quick Filters Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search user name or ID..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/5 outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            {/* TAB CONTENT: SUMMARY */}
            {activeTab === 'summary' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Present', value: stats.present, color: 'emerald', icon: CheckCircle2 },
                    { label: 'Late Arrivals', value: stats.late, color: 'amber', icon: Clock },
                    { label: 'Early Departures', value: stats.early, color: 'blue', icon: TrendingUp },
                    { label: 'Missing Punches', value: stats.missing, color: 'rose', icon: AlertTriangle },
                    { label: 'Overtime Cases', value: stats.overtime, color: 'purple', icon: BarChart3 },
                  ].map((stat, i) => (
                    <div key={i} className={`bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-${stat.color}-200 transition-all cursor-default`}>
                      <div className={`p-2.5 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl self-start group-hover:scale-110 transition-transform`}>
                        <stat.icon size={20} />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-900 leading-none">{stat.value}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-1">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <BarChart3 size={18} className="text-blue-500" />
                        Attendance Composition
                      </h3>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} 
                              dy={10} 
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                            <Tooltip 
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>

                   <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm overflow-hidden relative">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6">Late Frequency (%)</h3>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
                        {chartData.map((entry, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[index]}}></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: DETAILS */}
            {activeTab === 'details' && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">User Details</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Mins (worked)</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Late Arrival</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Early Departure</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Overtime</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((user) => (
                      <tr key={user.user_id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                               <div className="text-sm font-bold text-slate-900">{user.name}</div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase">ID: {user.user_id} • {user.department}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center font-black text-slate-700">
                          {user.total_hours} <span className="text-[9px] text-slate-400">HRS</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          {user.late_count > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md ring-1 ring-amber-100">
                                {user.late_count} Times
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 mt-1">{user.late_minutes} MINS TOTAL</span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-500">Perfect</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                         {user.early_departure_count > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md ring-1 ring-rose-100">
                                {user.early_departure_count} Times
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 mt-1">{user.early_departure_minutes} MINS TOTAL</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                           {user.overtime_hours > 0 ? (
                              <span className="text-sm font-black text-indigo-600">+{user.overtime_hours} <span className="text-[9px]">HRS</span></span>
                           ) : (
                              <span className="text-[10px] text-slate-300">—</span>
                           )}
                        </td>
                        <td className="px-6 py-5 text-center">
                           <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase ${
                             user.status === 'Present' 
                             ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' 
                             : 'bg-slate-100 text-slate-400'
                           }`}>
                             {user.status}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: MISSING */}
            {activeTab === 'missing' && (
              <div className="space-y-4 animate-in zoom-in-95 duration-300">
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-amber-900">Action Required</h4>
                    <p className="text-xs text-amber-700 mt-1 font-medium italic">The following users have incomplete logs (e.g., Checked IN but never Checked OUT). Admin needs to manually adjust these in the Logs tab.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredData.filter(u => u.missing_punches > 0).map(u => (
                      <div key={u.user_id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 group hover:ring-2 hover:ring-amber-500/20 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-600">
                            {u.name.charAt(0)}
                          </div>
                          <div className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-lg ring-1 ring-rose-100 uppercase">
                            {u.missing_punches} Issue{u.missing_punches > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{u.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {u.user_id} • {u.department}</p>
                        </div>
                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase">
                          <span>Reported for {viewMode === 'daily' ? `${selectedDay}/${selectedMonth}/${selectedYear}` : 'this month'}</span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                   ))}
                   {filteredData.filter(u => u.missing_punches > 0).length === 0 && (
                     <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400 opacity-30">
                        <CheckCircle2 size={64} />
                        <p className="font-black uppercase tracking-widest">Everything Looks Perfect!</p>
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CHARTS */}
            {activeTab === 'charts' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-500 pb-12">
                  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2">
                       <BarChart3 size={20} className="text-blue-500" />
                       Performance Comparison
                    </h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredData.slice(0, 10)}>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                           <Tooltip contentStyle={{borderRadius: '16px'}} />
                           <Legend 
                              verticalAlign="top" 
                              align="right" 
                              iconType="circle" 
                              wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase'}} 
                           />
                           <Bar name="Lates (min)" dataKey="late_minutes" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                           <Bar name="Early (min)" dataKey="early_departure_minutes" fill="#f87171" radius={[6, 6, 0, 0]} />
                           <Bar name="Overtime (hrs)" dataKey="overtime_hours" fill="#818cf8" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2">
                       <TrendingUp size={20} className="text-emerald-500" />
                       Department Punctuality (%)
                    </h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                              data={Object.entries(filteredData.reduce((acc, curr) => {
                                if (!acc[curr.department]) acc[curr.department] = { name: curr.department, value: 0, total: 0 };
                                if (curr.late_count === 0) acc[curr.department].value++;
                                acc[curr.department].total++;
                                return acc;
                              }, {})).map(([k, v]) => ({ name: k, value: Math.round((v.value / v.total) * 100) }))}
                              cx="50%"
                              cy="50%"
                              label={({name, value}) => `${name}: ${value}%`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {COLORS.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                         </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2">
                       <TrendingUp size={20} className="text-emerald-500" />
                       Top Performers (Total Hours)
                    </h3>
                    <div className="space-y-4">
                      {filteredData.sort((a, b) => b.total_hours - a.total_hours).slice(0, 5).map((u, i) => (
                        <div key={u.user_id} className="flex items-center gap-4 group">
                          <span className="text-xs font-black text-slate-300 w-4">0{i+1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5">
                              <span className="text-sm font-bold text-slate-700">{u.name}</span>
                              <span className="text-xs font-black text-emerald-600">{u.total_hours} hrs</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 group-hover:opacity-80" 
                                style={{width: `${Math.min((u.total_hours / 160) * 100, 100)}%`}}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-12 bg-blue-50 rounded-2xl p-6 border border-blue-100">
                       <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Shift Adherence Insight</h4>
                       <p className="text-xs text-blue-700 leading-relaxed font-medium">
                         Based on current data, your team has a punctuality rate of <span className="font-black text-blue-900">{Math.round(((stats.present - stats.late) / (stats.present || 1)) * 100)}%</span>. 
                         Most lates occur during the <span className="underline decoration-blue-200">First Shift</span> period.
                       </p>
                    </div>
                  </div>
               </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

export default ReportsDashboard;
