import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { 
  Calendar, 
  FileText, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  User, 
  Edit3, 
  ListOrdered,
  Plus,
  Check,
  X,
  UserX
} from 'lucide-react';

export default function AbsenceReporting() {
  const [users, setUsers] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const userRole = localStorage.getItem('user_role');
  const isSuperAdmin = userRole === 'super_admin';
  const isAuthorizedToReport = userRole === 'super_admin' || userRole === 'team_leader';

  const [formData, setFormData] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    reason: 'Sick Leave',
    custom_reason: '',
    notes: ''
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    reason: '',
    custom_reason: '',
    notes: ''
  });

  const fetchUsers = async () => {
    try {
      const response = await client.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchAbsences = async () => {
    setLoading(true);
    try {
      const response = await client.get('/absences');
      setAbsences(response.data);
    } catch (err) {
      console.error("Failed to fetch absences", err);
      setErrorMsg("Could not load absence reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAbsences();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const actualReason = formData.reason === 'Other' ? formData.custom_reason : formData.reason;
    if (formData.reason === 'Other' && !formData.custom_reason.trim()) {
      setErrorMsg("Please specify the custom reason.");
      setSubmitting(false);
      return;
    }

    try {
      await client.post('/absences', {
        user_id: formData.user_id,
        date: formData.date,
        reason: actualReason,
        notes: formData.notes
      });
      
      setFormData({
        user_id: '',
        date: new Date().toISOString().split('T')[0],
        reason: 'Sick Leave',
        custom_reason: '',
        notes: ''
      });
      
      setSuccessMsg("Absence report submitted successfully!");
      fetchAbsences();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || "Failed to submit absence report.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await client.put(`/absences/${id}`, { status });
      setSuccessMsg(`Report status updated to ${status}!`);
      fetchAbsences();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to update status.");
    }
  };

  const startEdit = (report) => {
    setEditingId(report.id);
    const standardReasons = ["Sick Leave", "Annual Leave", "Emergency Leave", "Business Trip", "Work From Home", "Suspended"];
    const isCustom = !standardReasons.includes(report.reason);
    
    setEditForm({
      reason: isCustom ? 'Other' : report.reason,
      custom_reason: isCustom ? report.reason : '',
      notes: report.notes || ''
    });
  };

  const handleSaveEdit = async (id) => {
    const actualReason = editForm.reason === 'Other' ? editForm.custom_reason : editForm.reason;
    try {
      await client.put(`/absences/${id}`, {
        reason: actualReason,
        notes: editForm.notes
      });
      setEditingId(null);
      setSuccessMsg("Report updated successfully!");
      fetchAbsences();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to update report.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest shadow-sm">
            <CheckCircle size={12} className="stroke-[3px]" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-widest shadow-sm">
            <XCircle size={12} className="stroke-[3px]" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest shadow-sm animate-pulse">
            <Clock size={12} className="stroke-[3px]" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full pb-20">
      {/* Submit Form (Authorized Roles) */}
      {isAuthorizedToReport && (
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative group">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-indigo-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                  <UserX size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Report Absence</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Submit staff unavailability</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-rose-50 text-rose-700 p-4 rounded-xl text-xs font-bold border border-rose-100 shadow-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2.5 bg-emerald-50 text-emerald-700 p-4 rounded-xl text-xs font-bold border border-emerald-100 shadow-sm">
                  <CheckCircle size={16} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Staff selection */}
              <div className="relative group">
                <label className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest z-10">Staff Member</label>
                <select
                  required
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 font-bold text-gray-700 focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-600 outline-none transition-all cursor-pointer shadow-inner appearance-none"
                >
                  <option value="" disabled>--- Select Staff Member ---</option>
                  {users.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.name} (UID: {u.user_id})</option>
                  ))}
                </select>
              </div>

              {/* Date selection */}
              <div className="relative group">
                <label className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest z-10">Absence Date</label>
                <input
                  required
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 font-bold text-gray-700 focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-600 outline-none transition-all shadow-inner"
                />
              </div>

              {/* Reason list */}
              <div className="relative group">
                <label className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest z-10">Reason for Absence</label>
                <select
                  required
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 font-bold text-gray-700 focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-600 outline-none transition-all cursor-pointer shadow-inner"
                >
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                  <option value="Business Trip">Business Trip</option>
                  <option value="Work From Home">Work From Home</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Other">Other (Specify below)</option>
                </select>
              </div>

              {/* Custom reason input if "Other" is chosen */}
              {formData.reason === 'Other' && (
                <div className="relative group animate-in slide-in-from-top-2 duration-200">
                  <label className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-orange-500 uppercase tracking-widest z-10">Specify Custom Reason</label>
                  <input
                    required
                    type="text"
                    name="custom_reason"
                    placeholder="Describe custom reason..."
                    value={formData.custom_reason}
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border-2 border-orange-100 rounded-xl px-4 py-3.5 font-bold text-gray-700 focus:ring-4 focus:ring-orange-50 focus:bg-white focus:border-orange-500 outline-none transition-all shadow-inner"
                  />
                </div>
              )}

              {/* Notes */}
              <div className="relative group">
                <label className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest z-10">Notes (Optional)</label>
                <textarea
                  name="notes"
                  rows="3"
                  placeholder="Provide any additional descriptions..."
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 font-bold text-gray-700 focus:ring-4 focus:ring-indigo-50 focus:bg-white focus:border-indigo-600 outline-none transition-all shadow-inner resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 duration-200 tracking-wider disabled:bg-indigo-400"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                ) : (
                  <>
                    <Send size={16} className="stroke-[2.5px]" />
                    SUBMIT REPORT
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reports Table List (Super Admin and Team Leaders) */}
      <div className={isAuthorizedToReport ? "lg:w-2/3" : "w-full"}>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden h-full flex flex-col group">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-blue-50/50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
                <ListOrdered size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Absence Registry</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">View and approve staff unavailability logs</p>
              </div>
            </div>
            {isSuperAdmin && (
              <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200">
                Super Admin Access
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {loading ? (
              <div className="text-center py-20 text-gray-400 font-bold">Loading reports...</div>
            ) : absences.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold flex flex-col items-center gap-4">
                <Calendar size={48} className="text-gray-300 stroke-[1.5px]" />
                No absence reports have been filed.
              </div>
            ) : (
              <div className="space-y-4">
                {absences.map(report => (
                  <div 
                    key={report.id} 
                    className="p-5 border border-gray-100 rounded-2xl bg-white hover:border-blue-200 hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
                        {report.name ? report.name.charAt(0) : 'U'}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-base">{report.name || 'Unknown User'}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">UID: {report.user_id}</span>
                          <span className="text-[10px] font-black text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            <Calendar size={10} /> {report.date}
                          </span>
                        </div>
                        
                        {editingId === report.id ? (
                          <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in slide-in-from-top-2">
                            <div className="relative group">
                              <label className="absolute -top-3 left-4 bg-gray-50 px-1 text-[9px] font-black text-indigo-600 uppercase tracking-widest z-10">Reason</label>
                              <select
                                name="reason"
                                value={editForm.reason}
                                onChange={handleEditChange}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                              >
                                <option value="Sick Leave">Sick Leave</option>
                                <option value="Annual Leave">Annual Leave</option>
                                <option value="Emergency Leave">Emergency Leave</option>
                                <option value="Business Trip">Business Trip</option>
                                <option value="Work From Home">Work From Home</option>
                                <option value="Suspended">Suspended</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                            {editForm.reason === 'Other' && (
                              <input
                                required
                                type="text"
                                name="custom_reason"
                                placeholder="Specify custom reason..."
                                value={editForm.custom_reason}
                                onChange={handleEditChange}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                              />
                            )}
                            <div className="relative group">
                              <label className="absolute -top-3 left-4 bg-gray-50 px-1 text-[9px] font-black text-indigo-600 uppercase tracking-widest z-10">Notes</label>
                              <textarea
                                name="notes"
                                rows="2"
                                placeholder="Notes..."
                                value={editForm.notes}
                                onChange={handleEditChange}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-gray-300 text-xs font-black rounded-lg hover:bg-gray-100 transition flex items-center gap-1">
                                <X size={12} /> CANCEL
                              </button>
                              <button onClick={() => handleSaveEdit(report.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-700 transition flex items-center gap-1">
                                <Check size={12} /> SAVE
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm">
                            <p className="font-bold text-gray-800">
                              Reason: <span className="text-indigo-600 font-extrabold">{report.reason}</span>
                            </p>
                            {report.notes && (
                              <p className="text-gray-500 text-xs mt-1.5 font-bold italic bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex items-start gap-1">
                                <FileText size={12} className="shrink-0 mt-0.5" />
                                <span>{report.notes}</span>
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Submitted By: {report.submitted_by} {report.approved_by && `| Reviewed By: ${report.approved_by}`}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div>{getStatusBadge(report.status)}</div>
                      
                      {/* Super Admin Actions */}
                      {isSuperAdmin && editingId !== report.id && (
                        <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                          {report.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleStatusChange(report.id, 'approved')}
                                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                                title="Approve"
                              >
                                <Check size={16} className="stroke-[3px]" />
                              </button>
                              <button 
                                onClick={() => handleStatusChange(report.id, 'rejected')}
                                className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                title="Reject"
                              >
                                <X size={16} className="stroke-[3px]" />
                              </button>
                            </>
                          )}
                          {report.status !== 'pending' && (
                            <button
                              onClick={() => handleStatusChange(report.id, 'pending')}
                              className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded-lg font-black transition uppercase tracking-wider"
                              title="Reset status"
                            >
                              Reset
                            </button>
                          )}
                          <div className="w-px h-5 bg-gray-200"></div>
                          <button 
                            onClick={() => startEdit(report)}
                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                            title="Edit Details"
                          >
                            <Edit3 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
