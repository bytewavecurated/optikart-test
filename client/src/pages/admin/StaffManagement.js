import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

const STAFF_ROLES = [
  { value: 'blog_manager', label: 'Blog Manager' },
  { value: 'doc_verifier', label: 'Document Verifier' },
  { value: 'user_manager', label: 'User Manager' },
  { value: 'seller_manager', label: 'Seller Manager' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'delivery_manager', label: 'Delivery Manager' },
  { value: 'pickup_manager', label: 'Pickup Manager' },
];

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [q, setQ] = useState({ search: '', status: '', sort: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'blog_manager', password: '' });

  useEffect(() => {
    const t = setTimeout(fetchStaff, 280);
    return () => clearTimeout(t);
  }, [q]);
  const fetchStaff = async () => {
    try {
      const res = await adminApi.getStaff({
        search: q.search || undefined,
        status: q.status || undefined,
        sort: q.sort || undefined,
        page: q.page,
        limit: 20,
      });
      setStaff(listOf(res.data));
      setMeta({ total: res.data.total ?? 0, page: res.data.page ?? 1, totalPages: res.data.totalPages ?? 1 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Fill all fields');
      return;
    }
    try {
      const res = await adminApi.createStaff(formData);
      const issued =
        res.data.tempPassword && res.data.tempPassword !== formData.password
          ? res.data.tempPassword
          : formData.password;
      toast.success(`Staff created. Login password: ${issued}`, { duration: 12000 });
      setShowForm(false);
      setFormData({ name: '', email: '', role: 'blog_manager', password: '' });
      fetchStaff();
    } catch (error) {
      toastError(error, 'Could not create the staff account.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this staff member?')) return;
    try {
      await adminApi.deleteStaff(id);
      toast.success('Deleted');
      fetchStaff();
    } catch (error) {
      toastError(error, 'Failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 14px' }}>
            <input
              value={q.search}
              onChange={(e) => setQ((v) => ({ ...v, search: e.target.value, page: 1 }))}
              placeholder="Search name, email or role…"
              className="input"
              style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
            />
            <select
              value={q.status}
              onChange={(e) => setQ((v) => ({ ...v, status: e.target.value, page: 1 }))}
              className="input"
              style={{ width: 150 }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={q.sort}
              onChange={(e) => setQ((v) => ({ ...v, sort: e.target.value, page: 1 }))}
              className="input"
              style={{ width: 170 }}
            >
              <option value="">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="assignedAt">Recently assigned</option>
            </select>
            <span style={{ fontSize: 12.5, color: 'var(--text-light)', marginLeft: 'auto' }}>
              {meta.total} account{meta.total === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Staff Management ({staff.length})</h1>
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              <FiPlus /> Add Staff
            </button>
          </div>
          {showForm && (
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Add New Staff</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Name</label>
                  <input
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input
                    className="input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Role</label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <input
                    className="input"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleCreate} className="btn btn-primary">
                  Create
                </button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                    {['Name', 'Email', 'Role', 'Joined', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                          {s.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => handleDelete(s._id)} className="btn btn-danger btn-sm">
                          <FiTrash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
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
          )}
        </div>
      </main>
    </div>
  );
};

export default StaffManagement;
