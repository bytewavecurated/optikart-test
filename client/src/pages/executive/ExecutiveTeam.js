import React, { useState, useEffect, useCallback } from 'react';
import { executive as executiveApi } from '../../services/api';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';
import toast from 'react-hot-toast';
import { FiUserPlus, FiTrash2, FiCopy, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

/**
 * Desk team.
 *
 * The executive endpoints existed before this screen, and they wrote a private
 * collection that no login route ever read - so a desk could "add" a team member
 * who could never sign in. This manages the same accounts the admin Staff screen
 * and the staff workspace use, restricted to the executive's own department, and
 * surfaces the one-time password so the credential can actually be handed over.
 */

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };

const ROLES = [
  ['doc_verifier', 'Prescription verifier'],
  ['delivery_manager', 'Delivery manager'],
  ['pickup_manager', 'Pickup manager'],
  ['user_manager', 'Customer accounts'],
  ['seller_manager', 'Seller manager'],
  ['finance_manager', 'Finance'],
  ['blog_manager', 'Content']
];

const label = (text) => (
  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>{text}</label>
);

export default function ExecutiveTeam() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [issued, setIssued] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'doc_verifier', phone: '', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getTeam();
      setRows(listOf(res.data));
    } catch (e) {
      toastError(e, 'Could not load your team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (ev) => {
    ev.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setBusy('add');
    try {
      const res = await executiveApi.addTeamMember({ ...form, password: form.password || undefined });
      toast.success('Team member added');
      if (res.data.tempPassword) {
        setIssued({ email: form.email.trim(), password: res.data.tempPassword });
        navigator.clipboard?.writeText(
          `Sign in at ${window.location.origin}/staff/login\nEmail: ${form.email.trim()}\nPassword: ${res.data.tempPassword}`
        ).catch(() => {});
      }
      setForm({ name: '', email: '', role: form.role, phone: '', password: '' });
      setShowForm(false);
      load();
    } catch (e) {
      toastError(e, 'Could not add the team member');
    } finally {
      setBusy('');
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Deactivated ${row.name}? Their past checks and actions stay on record.`)) return;
    setBusy(row._id);
    try {
      const res = await executiveApi.deactivateTeamMember(row._id);
      toast.success(res.data.message || 'Team member deactivated');
      load();
    } catch (e) {
      toastError(e, 'Could not deactivate that person');
    } finally {
      setBusy('');
    }
  };

  const toggleActive = async (row, next) => {
    setBusy(row._id);
    try {
      await executiveApi.updateTeamMember(row._id, { isActive: next });
      toast.success(next ? 'Access restored' : 'Access removed');
      load();
    } catch (e) {
      toastError(e, 'Could not change their access');
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Desk team</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 720 }}>
            People in your department who sign in to the staff workspace. Deactivating keeps their history, because
            prescription checks and order actions are attributed to these records.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}><FiUserPlus size={15} /> Add member</button>
      </div>

      {issued && (
        <div className="card-flat" style={{ padding: 14, marginBottom: 16, borderLeft: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <FiCheckCircle color="var(--success)" />
            <strong style={{ fontSize: 13.5 }}>Sign-in details for {issued.email}</strong>
            <code style={{ fontSize: 13 }}>{issued.password}</code>
            <button
              className="btn btn-outline"
              style={{ padding: '3px 10px', fontSize: 12 }}
              onClick={() => { navigator.clipboard?.writeText(`${issued.email} / ${issued.password}`).catch(() => {}); toast.success('Copied'); }}
            >
              <FiCopy size={12} /> copy
            </button>
            <button className="btn btn-outline" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setIssued(null)}>dismiss</button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Shown once and not recoverable afterwards - send it to them now. They can change it after signing in.
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={add} className="card-flat" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <div>{label('Name')}<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>{label('Email')}<input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>{label('Phone (optional)')}<input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>{label('Role')}
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>{label('Password (blank generates one)')}
              <input className="input" type="text" value={form.password} placeholder="min 6 characters"
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add to team'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 50, textAlign: 'center' }}><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No one in your department yet. Anyone you add here signs in at <code>/staff/login</code>.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Name', 'Email', 'Role', 'Sign-in', 'Last login', 'Access', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td style={{ ...td, fontWeight: 700 }}>{row.name}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{row.email}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{String(row.role || '').replace(/_/g, ' ')}</td>
                  <td style={td}>
                    {row.hasLogin
                      ? <span style={{ fontSize: 12.5, color: 'var(--success)' }}>account exists</span>
                      : <span style={{ fontSize: 12.5, color: 'var(--danger)', display: 'inline-flex', gap: 5, alignItems: 'center' }}><FiAlertCircle size={12} /> no login</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text-light)', fontSize: 12.5 }}>
                    {row.lastLogin ? new Date(row.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'never'}
                  </td>
                  <td style={td}>
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={row.isActive !== false} disabled={busy === row._id}
                        onChange={(e) => toggleActive(row, e.target.checked)} />
                      active
                    </label>
                  </td>
                  <td style={td}>
                    <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      disabled={busy === row._id} onClick={() => remove(row)}>
                      <FiTrash2 size={12} /> deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
