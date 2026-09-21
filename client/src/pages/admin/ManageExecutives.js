import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import toast from 'react-hot-toast';

const ManageExecutives = () => {
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExecutive, setEditingExecutive] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    permissions: []
  });

  const departments = ['delivery', 'staff', 'users', 'sellers', 'manufacturers', 'orders', 'products'];

  useEffect(() => {
    fetchExecutives();
  }, []);

  const fetchExecutives = async () => {
    try {
      const res = await adminApi.getExecutives();
      setExecutives(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch executives');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await adminApi.createExecutive(formData);
      toast.success('Executive added successfully');
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', department: '', permissions: [] });
      fetchExecutives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add executive');
    }
  };

  const handleEdit = async () => {
    try {
      await adminApi.updateExecutive(editingExecutive._id, formData);
      toast.success('Executive updated successfully');
      setEditingExecutive(null);
      setFormData({ name: '', email: '', password: '', department: '', permissions: [] });
      fetchExecutives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update executive');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this executive?')) return;
    try {
      await adminApi.deleteExecutive(id);
      toast.success('Executive deleted successfully');
      fetchExecutives();
    } catch (err) {
      toast.error('Failed to delete executive');
    }
  };

  const handleBan = async (id, isBanned) => {
    try {
      await adminApi.banExecutive(id, { isBanned, banReason: isBanned ? 'Banned by admin' : '' });
      toast.success(isBanned ? 'Executive banned' : 'Executive unbanned');
      fetchExecutives();
    } catch (err) {
      toast.error('Failed to update executive status');
    }
  };

  const filteredExecutives = executives.filter(exec =>
    exec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exec.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exec.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exec.executiveId && exec.executiveId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Manage Executives</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '10px 20px',
            background: '#667eea',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          <FiPlus /> Add Executive
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9e9e9e' }} />
        <input
          type="text"
          placeholder="Search by name, email, department, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 10px 10px 40px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Executive ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredExecutives.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#757575' }}>
                  No executives found
                </td>
              </tr>
            ) : (
              filteredExecutives.map((exec) => (
                <tr key={exec._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{exec.executiveId || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{exec.name}</td>
                  <td style={{ padding: '12px', color: '#757575' }}>{exec.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#e3f2fd',
                      color: '#1976d2',
                      textTransform: 'capitalize'
                    }}>
                      {exec.department}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {exec.isBanned ? (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: '#ffebee',
                        color: '#c62828'
                      }}>
                        Banned
                      </span>
                    ) : (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: '#e8f5e9',
                        color: '#2e7d32'
                      }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setEditingExecutive(exec);
                          setFormData({
                            name: exec.name,
                            email: exec.email,
                            password: '',
                            department: exec.department,
                            permissions: exec.permissions || []
                          });
                        }}
                        style={{ padding: '6px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Edit"
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleBan(exec._id, !exec.isBanned)}
                        style={{ padding: '6px', background: exec.isBanned ? '#4caf50' : '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title={exec.isBanned ? 'Unban' : 'Ban'}
                      >
                        {exec.isBanned ? <FiEye size={16} /> : <FiEyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(exec._id)}
                        style={{ padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingExecutive) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
              {editingExecutive ? 'Edit Executive' : 'Add New Executive'}
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Executive name"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="executive@email.com"
                />
              </div>

              {!editingExecutive && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Password"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                >
                  <option value="">Select department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept.charAt(0).toUpperCase() + dept.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={editingExecutive ? handleEdit : handleAdd}
                style={{ flex: 1, padding: '12px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                {editingExecutive ? 'Update' : 'Add'} Executive
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingExecutive(null);
                  setFormData({ name: '', email: '', password: '', department: '', permissions: [] });
                }}
                style={{ flex: 1, padding: '12px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageExecutives;
