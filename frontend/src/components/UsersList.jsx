import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Users, UserPlus, Save, X, RefreshCw } from 'lucide-react';

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [newUser, setNewUser] = useState({
    user_id: '',
    name: '',
    department: 'General',
    password: '',
    privilege: 0
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await client.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDevice = async () => {
    setLoading(true);
    try {
      await client.post('/device/sync');
      await fetchUsers(); // Re-fetch the newly synced users
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: name === 'privilege' ? parseInt(value) : value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    
    try {
      await client.post('/users', newUser);
      await fetchUsers();
      setIsModalOpen(false);
      setNewUser({ user_id: '', name: '', department: 'General', password: '', privilege: 0 });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || "Failed to create user. Is the device online?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Users className="text-blue-500" size={20} />
          Enrolled Users
        </h2>
        
        <div className="flex gap-2">
          <button
            onClick={handleSyncDevice}
            className="flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync from Machine
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <UserPlus size={16} className="mr-2" />
            Add New User
          </button>
        </div>
      </div>

      <div className="overflow-x-auto flex-1 h-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 bg-opacity-90 backdrop-blur-sm z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID / Badge</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center text-gray-500">Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center text-gray-500">No users found. Try clicking 'Sync from Machine'!</td>
              </tr>
            ) : (
              users.map((user, idx) => (
                <tr key={`${user.user_id}-${idx}`} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.user_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                      {user.department || 'General'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-slide-down">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Enroll New User</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="px-6 py-4 space-y-4">
              {errorMsg && (
                <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-4 border border-rose-200">
                  {errorMsg}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID / Badge Number *</label>
                <input required type="text" name="user_id" value={newUser.user_id} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm" placeholder="e.g. 1001" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input required type="text" name="name" value={newUser.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm" placeholder="e.g. John Doe" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" name="department" value={newUser.department} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Type</label>
                  <select name="privilege" value={newUser.privilege} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm">
                    <option value={0}>Normal User (0)</option>
                    <option value={14}>Admin (14)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keypad Passcode</label>
                  <input type="password" name="password" value={newUser.password} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm" placeholder="Optional" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition shadow-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm disabled:bg-blue-400">
                  {saving ? <div className="h-4 w-4 border-2 border-white rounded-full border-t-transparent animate-spin mr-2"></div> : <Save size={16} className="mr-2" />}
                  Save to Database & Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
