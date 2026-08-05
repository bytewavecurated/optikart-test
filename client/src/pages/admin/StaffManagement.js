import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'support', password: '' });

  useEffect(() => { fetchStaff(); }, []);
  const fetchStaff = async () => {
    try { const res = await adminApi.getStaff(); setStaff(res.data.data || []); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password) { toast.error('Fill all fields'); return; }
    try { await adminApi.createStaff(formData); toast.success('Staff created'); setShowForm(false); setFormData({ name: '', email: '', role: 'support', password: '' }); fetchStaff(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this staff member?')) return;
    try { await adminApi.deleteStaff(id); toast.success('Deleted'); fetchStaff(); } catch (err) { toast.error('Failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Staff Management ({staff.length})</h1>
            <button onClick={() => setShowForm(true)} className="btn btn-primary"><FiPlus /> Add Staff</button>
          </div>
          {showForm && (
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Add New Staff</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group"><label>Name</label><input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="input-group"><label>Email</label><input className="input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                <div className="input-group"><label>Role</label><select className="input" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}><option value="support">Support</option><option value="moderator">Moderator</option><option value="manager">Manager</option></select></div>
                <div className="input-group"><label>Password</label><input className="input" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleCreate} className="btn btn-primary">Create</button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Name', 'Email', 'Role', 'Joined', 'Actions'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.email}</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{s.role}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px' }}><button onClick={() => handleDelete(s._id)} className="btn btn-danger btn-sm"><FiTrash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default StaffManagement;
