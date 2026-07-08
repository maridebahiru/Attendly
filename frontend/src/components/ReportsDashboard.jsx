import React, { useState, useEffect, useMemo } from 'react';
import client from '../api/client';
import { 
  Calendar, Clock, User, Download, RefreshCw, AlertCircle, FileText, 
  BarChart3, PieChart as PieChartIcon, TrendingUp, Filter, Search,
  ChevronRight, AlertTriangle, CheckCircle2, History, XCircle, FileSpreadsheet, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const ReportsDashboard = ({ refreshTrigger }) => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'monthly'
  const [activeTab, setActiveTab] = useState('details'); // 'summary', 'details', 'missing', 'charts', 'device'
  
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [nameFilter, setNameFilter] = useState('');
  
  // Personal Report State
  const [selectedUserForReport, setSelectedUserForReport] = useState(null);
  const [personalReportData, setPersonalReportData] = useState(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const ethiopianMonths = useMemo(() => [
    "Meskerem", "Tekemt", "Hedar", "Tahsas", "Ter", "Yekatit",
    "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
  ], []);
  
  const userRole = localStorage.getItem('user_role');
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  useEffect(() => {
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
        // Fallback in case of server failure
        setSelectedDay(new Date().getDate());
        setSelectedMonth(new Date().getMonth() + 1);
        setSelectedYear(new Date().getFullYear());
      }
    };
    initDate();
  }, []);

  const fetchReport = async () => {
    if (!selectedYear || !selectedMonth || (viewMode === 'daily' && !selectedDay)) return;
    setLoading(true);
    try {
      let url = `/reports/attendance?`;
      if (viewMode === 'daily') {
        url += `eth_year=${selectedYear}&eth_month=${selectedMonth}&eth_day=${selectedDay}`;
      } else {
        url += `eth_year=${selectedYear}&eth_month=${selectedMonth}`;
      }
      url += `&_t=${Date.now()}`;
      
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

  const fetchPersonalReport = async () => {
    if (!selectedUserForReport || !fromDate || !toDate) return;
    setPersonalLoading(true);
    try {
      const res = await client.get(`/reports/attendance?user_id_filter=${selectedUserForReport.user_id}&start_date=${fromDate}&end_date=${toDate}&_t=${Date.now()}`);
      if (res.data && res.data.length > 0) {
        setPersonalReportData(res.data[0]);
      } else {
        setPersonalReportData({ daily_details: [], days_present: 0, total_hours: 0, late_count: 0 });
      }
    } catch (err) {
      console.error('Error fetching personal report:', err);
    } finally {
      setPersonalLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedDay, selectedMonth, selectedYear, viewMode, refreshTrigger]);

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

    autoTable(doc, {
      startY: 45,
      head: [['ID', 'Name', 'Dept', 'HRS', 'Late #', 'Late min', 'Early #', 'Missing', 'OT', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 }
    });

    doc.save(`Attendance_Report_${viewMode === 'daily' ? `${selectedYear}_${selectedMonth}_${selectedDay}` : selectedMonth + '_' + selectedYear}.pdf`);
  };

  const handleExportPersonalExcel = () => {
    if (!personalReportData || !personalReportData.daily_details) return;
    const dataToExport = personalReportData.daily_details.map(row => ({
      'Date (Gregorian)': row.gregorian_date || row.date,
      'Morning In': row.morning_in,
      'Morning Out': row.morning_out,
      'Afternoon In': row.afternoon_in,
      'Afternoon Out': row.afternoon_out,
      'Total Hours': row.total_hours,
      'Status': row.status,
      'Late Minutes': row.late_minutes,
      'Early Minutes': row.early_departure_minutes,
      'Remarks': !['Present', 'Absent', 'Half Day', 'Off Day'].includes(row.status) ? row.status : ''
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal Report");
    XLSX.writeFile(wb, `Personal_Report_${selectedUserForReport.name}_${fromDate}_to_${toDate}.xlsx`);
  };

  const handleExportPersonalPDF = () => {
    if (!personalReportData || !personalReportData.daily_details) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text(`Personal Report: ${selectedUserForReport.name}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`ID: ${selectedUserForReport.user_id} | Period: ${fromDate} to ${toDate}`, 14, 30);
    
    const tableData = personalReportData.daily_details.map(row => [
      row.gregorian_date || row.date, row.morning_in, row.morning_out, row.afternoon_in, row.afternoon_out, 
      row.total_hours, row.status, row.late_minutes, row.early_departure_minutes, 
      !['Present', 'Absent', 'Half Day', 'Off Day'].includes(row.status) ? row.status : ''
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'M. In', 'M. Out', 'A. In', 'A. Out', 'Hrs', 'Status', 'Late(m)', 'Early(m)', 'Remarks']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 }
    });

    doc.save(`Personal_Report_${selectedUserForReport.name}_${fromDate}_to_${toDate}.pdf`);
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
            {selectedDay && selectedMonth && selectedYear && (
              viewMode === 'daily' ? (
                <div className="flex gap-2">
                  <select 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                  >
                    {selectedMonth === 13 
                      ? [...Array(6)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)
                      : [...Array(30)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)
                    }
                  </select>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => {
                      const m = parseInt(e.target.value);
                      setSelectedMonth(m);
                      if (m === 13 && selectedDay > 6) {
                        setSelectedDay(5); // Reset to Pagume bounds
                      }
                    }}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                  >
                    {ethiopianMonths.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                  >
                    {[2016, 2017, 2018, 2019, 2020].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                  >
                    {ethiopianMonths.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                  >
                    {[2016, 2017, 2018, 2019, 2020].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )
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
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Gregorian Date</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Morning In</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Morning Out</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Afternoon In</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Afternoon Out</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Total Hrs</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Late (min)</th>
                        <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Early (min)</th>
                        <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredData.flatMap(user => 
                        user.daily_details.map((day, idx) => ({
                          ...day,
                          rowKey: `${user.user_id}-${day.date}-${idx}`
                        }))
                      ).map((row) => (
                        <tr key={row.rowKey} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div 
                              className="flex items-center gap-3 cursor-pointer group/user"
                              onClick={() => {
                                setSelectedUserForReport({ user_id: row.employee_id, name: row.employee_name });
                                setPersonalReportData(null);
                                setFromDate('');
                                setToDate('');
                              }}
                            >
                              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-black text-xs group-hover/user:bg-blue-600 group-hover/user:text-white transition-all shadow-sm">
                                {row.employee_name.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800 group-hover/user:text-blue-600 transition-colors">{row.employee_name}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">ID: {row.employee_id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-xs font-black text-slate-600 bg-slate-50 px-2 py-1 rounded-lg inline-block">
                              {row.date}
                            </div>
                          </td>
                          {/* Morning In */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-black ${row.morning_in === 'Not Scanned' ? 'text-slate-300' : 'text-slate-700'}`}>{row.morning_in}</span>
                              {row.morning_in !== 'Not Scanned' && (
                                <span className={`text-[9px] font-black uppercase ${row.morning_in_status === 'On Time' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {row.morning_in_status}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Morning Out */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-black ${row.morning_out === 'Not Scanned' ? 'text-slate-300' : 'text-slate-700'}`}>{row.morning_out}</span>
                              {row.morning_out !== 'Not Scanned' && (
                                <span className={`text-[9px] font-black uppercase ${row.morning_out_status === 'On Time' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {row.morning_out_status}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Afternoon In */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-black ${row.afternoon_in === 'Not Scanned' ? 'text-slate-300' : 'text-slate-700'}`}>{row.afternoon_in}</span>
                              {row.afternoon_in !== 'Not Scanned' && (
                                <span className={`text-[9px] font-black uppercase ${row.afternoon_in_status === 'On Time' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {row.afternoon_in_status}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Afternoon Out */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-black ${row.afternoon_out === 'Not Scanned' ? 'text-slate-300' : 'text-slate-700'}`}>{row.afternoon_out}</span>
                              {row.afternoon_out !== 'Not Scanned' && (
                                <span className={`text-[9px] font-black uppercase ${row.afternoon_out_status === 'On Time' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {row.afternoon_out_status}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Total Hrs */}
                          <td className="px-4 py-4 text-center">
                            <span className="text-xs font-black text-slate-700 bg-slate-50 px-2 py-1 rounded-lg">
                              {row.total_hours}h
                            </span>
                          </td>
                          {/* Late Mins */}
                          <td className="px-4 py-4 text-center">
                            <span className={`text-xs font-black ${row.late_minutes > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-400 bg-slate-50'} px-2 py-1 rounded-lg`}>
                              {row.late_minutes}m
                            </span>
                          </td>
                          {/* Early Mins */}
                          <td className="px-4 py-4 text-center">
                            <span className={`text-xs font-black ${row.early_departure_minutes > 0 ? 'text-amber-600 bg-amber-50' : 'text-slate-400 bg-slate-50'} px-2 py-1 rounded-lg`}>
                              {row.early_departure_minutes}m
                            </span>
                          </td>
                          {/* Status */}
                          <td className="px-6 py-4 text-center">
                             <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider ring-1 ${
                               row.status === 'Present'
                               ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' 
                               : row.status === 'Half Day'
                               ? 'bg-amber-50 text-amber-600 ring-amber-100'
                               : row.status === 'Off Day'
                               ? 'bg-slate-50 text-slate-400 ring-slate-100'
                               : 'bg-rose-50 text-rose-600 ring-rose-100'
                             }`}>
                               {row.status}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

      {/* Personal Report Modal */}
      {selectedUserForReport && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm">
                  {selectedUserForReport.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedUserForReport.name}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: {selectedUserForReport.user_id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUserForReport(null)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 bg-white flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">From</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">To</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                />
              </div>
              <button 
                onClick={fetchPersonalReport}
                disabled={!fromDate || !toDate || personalLoading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                {personalLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                APPLY
              </button>
              
              {personalReportData && (
                <div className="ml-auto flex gap-2">
                  <button 
                    onClick={handleExportPersonalExcel}
                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet size={20} />
                  </button>
                  <button 
                    onClick={handleExportPersonalPDF}
                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100 shadow-sm"
                    title="Export to PDF"
                  >
                    <FileText size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-slate-50/30 p-6">
              {!personalReportData && !personalLoading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 opacity-60">
                  <Calendar size={48} />
                  <p className="font-bold">Select a date range and click Apply to view the report.</p>
                </div>
              )}

              {personalLoading && (
                <div className="h-full flex flex-col items-center justify-center gap-4">
                   <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                   <p className="text-slate-500 font-bold animate-pulse">Fetching records...</p>
                </div>
              )}

              {personalReportData && (
                <div className="space-y-6 animate-in fade-in duration-500">
                   {/* Summary */}
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     {[
                       { label: 'Present Days', value: personalReportData.days_present, color: 'emerald' },
                       { label: 'Absent Days', value: personalReportData.daily_details.filter(d => d.status === 'Absent').length, color: 'rose' },
                       { label: 'Half Days', value: personalReportData.daily_details.filter(d => d.status === 'Half Day').length, color: 'amber' },
                       { label: 'Late Days', value: personalReportData.late_count, color: 'orange' },
                       { label: 'Total Hours', value: personalReportData.total_hours, color: 'blue' }
                     ].map((stat, i) => (
                       <div key={i} className={`bg-white p-4 rounded-2xl border border-${stat.color}-100 shadow-sm flex flex-col items-center justify-center`}>
                         <div className={`text-2xl font-black text-${stat.color}-600`}>{stat.value}</div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{stat.label}</div>
                       </div>
                     ))}
                   </div>

                   {/* Table */}
                   <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                     <div className="overflow-x-auto">
                       <table className="w-full text-left">
                         <thead>
                           <tr className="bg-slate-50 border-b border-slate-100">
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">M. In</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">M. Out</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">A. In</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">A. Out</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Hrs</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Status</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Late</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Early</th>
                             <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Remarks</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {personalReportData.daily_details.map((row, idx) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                               <td className="px-4 py-3">
                                 <div className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md inline-block">{row.gregorian_date || row.date}</div>
                               </td>
                               <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{row.morning_in !== 'Not Scanned' ? row.morning_in : '-'}</td>
                               <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{row.morning_out !== 'Not Scanned' ? row.morning_out : '-'}</td>
                               <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{row.afternoon_in !== 'Not Scanned' ? row.afternoon_in : '-'}</td>
                               <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{row.afternoon_out !== 'Not Scanned' ? row.afternoon_out : '-'}</td>
                               <td className="px-4 py-3 text-center">
                                 <span className="text-xs font-black text-blue-600">{row.total_hours}h</span>
                               </td>
                               <td className="px-4 py-3 text-center">
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                                    row.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                                    row.status === 'Half Day' ? 'bg-amber-100 text-amber-700' :
                                    row.status === 'Absent' ? 'bg-rose-100 text-rose-700' :
                                    row.status === 'Off Day' ? 'bg-slate-100 text-slate-500' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {row.status}
                                  </span>
                               </td>
                               <td className="px-4 py-3 text-center">
                                  {row.late_minutes > 0 ? (
                                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{row.late_minutes}m</span>
                                  ) : <span className="text-xs text-slate-300">-</span>}
                               </td>
                               <td className="px-4 py-3 text-center">
                                  {row.early_departure_minutes > 0 ? (
                                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{row.early_departure_minutes}m</span>
                                  ) : <span className="text-xs text-slate-300">-</span>}
                               </td>
                               <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                  {!['Present', 'Absent', 'Half Day', 'Off Day'].includes(row.status) ? row.status : '-'}
                               </td>
                             </tr>
                           ))}
                           {personalReportData.daily_details.length === 0 && (
                             <tr>
                               <td colSpan="10" className="px-4 py-8 text-center text-sm font-bold text-slate-400">No attendance records found for this date range.</td>
                             </tr>
                           )}
                         </tbody>
                       </table>
                     </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReportsDashboard;
