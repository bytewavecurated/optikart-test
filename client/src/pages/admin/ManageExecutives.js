import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

const ManageExecutives = () => {
  const [executives, setExecutives] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [q, setQ] = useState({ search: '', status: '', sort: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExecutive, setEditingExecutive] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    permissions: [],
  });

  const departments = ['delivery', 'staff', 'users', 'sellers', 'manufacturers', 'orders', 'products'];

  useEffect(() => {
    const t = setTimeout(fetchExecutives, 260);
    return () => clearTimeout(t);
  }, [q]);

  const fetchExecutives = async () => {
    try {
      const res = await adminApi.getExecutives({
        search: q.search || undefined,
        status: q.status || undefined,
        sort: q.sort || undefined,
        page: q.page,
        limit: 20,
      });
      setExecutives(listOf(res.data));
      setMeta({ total: res.data.total ?? 0, page: res.data.page ?? 1, totalPages: res.data.totalPages ?? 1 });
    } catch (error) {
      console.error(error);
      toastError(error, 'Failed to fetch executives');
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
    } catch (error) {
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
    } catch (error) {
      toast.error(err.response?.data?.message || 'Failed to update executive');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this executive?')) return;
    try {
      await adminApi.deleteExecutive(id);
      toast.success('Executive deleted successfully');
      fetchExecutives();
    } catch (error) {
      toastError(error, 'Failed to delete executive');
    }
  };

  const handleBan = async (id, isBanned) => {
    try {
      await adminApi.banExecutive(id, { isBanned, banReason: isBanned ? 'Banned by admin' : '' });
      toast.success(isBanned ? 'Executive banned' : 'Executive unbanned');
      fetchExecutives();
    } catch (error) {
      toastError(error, 'Failed to update executive status');
    }
  };

  // filtering happens server-side via the toolbar; keeping the symbol name so
  // the render below stays untouched
  const filteredExecutives = executives;

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 14px' }}>
          <input
            value={q.search}
            onChange={(e) => setQ((v) => ({ ...v, search: e.target.value, page: 1 }))}
            placeholder="Search name, email, ID, phone…"
            className="input"
            style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
          />
          <select
            value={q.status}
            onChange={(e) => setQ((v) => ({ ...v, status: e.target.value, page: 1 }))}
            className="input"
            style={{ width: 140 }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={q.sort}
            onChange={(e) => setQ((v) => ({ ...v, sort: e.target.value, page: 1 }))}
            className="input"
            style={{ width: 160 }}
          >
            <option value="">Newest</option>
            <option value="name">Name A–Z</option>
          </select>
          <span style={{ fontSize: 12.5, color: 'var(--text-light)', marginLeft: 'auto' }}>
            {meta.total} team member{meta.total === 1 ? '' : 's'}
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '10px 20px',
            background: 'var(--brand)',
            color: 'var(--text-white)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
          }}
        >
          <FiPlus /> Add Executive
        </button>
      </div>

      <div
        style={{
          background: 'var(--bg-white)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                Executive ID
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                Name
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                Email
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                Department
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                Status
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredExecutives.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No executives found
                </td>
              </tr>
            ) : (
              filteredExecutives.map((exec) => (
                <tr key={exec._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                    {exec.executiveId || '-'}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{exec.name}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{exec.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius)',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--brand-tint)',
                        color: 'var(--brand)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {exec.department}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {exec.isBanned ? (
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius)',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'var(--danger-light)',
                          color: 'var(--danger)',
                        }}
                      >
                        Banned
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius)',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'var(--success-light)',
                          color: 'var(--success)',
                        }}
                      >
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
                            permissions: exec.permissions || [],
                          });
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--brand)',
                          color: 'var(--text-white)',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer',
                        }}
                        title="Edit"
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleBan(exec._id, !exec.isBanned)}
                        style={{
                          padding: '6px',
                          background: exec.isBanned ? 'var(--success)' : 'var(--warning)',
                          color: 'var(--text-white)',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer',
                        }}
                        title={exec.isBanned ? 'Unban' : 'Ban'}
                      >
                        {exec.isBanned ? <FiEye size={16} /> : <FiEyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(exec._id)}
                        style={{
                          padding: '6px',
                          background: 'var(--danger)',
                          color: 'var(--text-white)',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer',
                        }}
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
        {meta.totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '14px 0' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={q.page <= 1}
              onClick={() => setQ((v) => ({ ...v, page: v.page - 1 }))}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', alignSelf: 'center' }}>
              Page {meta.page} / {meta.totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={q.page >= meta.totalPages}
              onClick={() => setQ((v) => ({ ...v, page: v.page + 1 }))}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingExecutive) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-white)',
              borderRadius: 'var(--radius)',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
              {editingExecutive ? 'Edit Executive' : 'Add New Executive'}
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  placeholder="Executive name"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  placeholder="executive@email.com"
                />
              </div>

              {!editingExecutive && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    placeholder="Password"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  Department *
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept.charAt(0).toUpperCase() + dept.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={editingExecutive ? handleEdit : handleAdd}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--brand)',
                  color: 'var(--text-white)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                {editingExecutive ? 'Update' : 'Add'} Executive
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingExecutive(null);
                  setFormData({ name: '', email: '', password: '', department: '', permissions: [] });
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--border)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
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
