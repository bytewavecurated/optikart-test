import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { listOf, oneOf } from '../../services/apiResponse.js';
import { toastError, toastSuccess } from '../../services/errors.js';
import { FiPlus, FiSearch, FiTruck, FiSlash, FiCheck, FiX } from 'react-icons/fi';

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };

const EMPTY_FORM = {
  name: '', email: '', phone: '', password: '',
  vehicleType: 'bike', vehicleNumber: '', licenseNumber: '',
  aadharNumber: '', panNumber: '',
  bankDetails: { accountNumber: '', ifscCode: '', bankName: '', branchName: '' }
};

export default function ManageDeliveryPartners() {
  const [tab, setTab] = useState('partners');
  const [partners, setPartners] = useState([]);
  const [working, setWorking] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState(null);
  const [query, setQuery] = useState('');
  const [workingSearch, setWorkingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchPartners = useCallback(async () => {
    try {
      const res = await api.get('/delivery-partner');
      setPartners(listOf(res.data));
    } catch (err) {
      toastError(err, 'Could not load delivery partners');
    }
  }, []);

  const fetchWorking = useCallback(async () => {
    try {
      const res = await api.get('/delivery-partner/working', {
        params: { search: workingSearch || undefined, status: statusFilter || undefined }
      });
      setWorking(res.data.deliveries || []);
      setSummary(res.data.partners || []);
    } catch (err) {
      toastError(err, 'Could not load active deliveries');
    }
  }, [workingSearch, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      await Promise.all([fetchPartners(), fetchWorking()]);
      if (!cancelled) setLoading(false);
    };
    boot();
    return () => { cancelled = true; };
  }, [fetchPartners, fetchWorking]);

  const filteredPartners = useMemo(() => {
    if (!query.trim()) return partners;
    const q = query.toLowerCase();
    return partners.filter((p) =>
      [p.name, p.email, p.phone, p.vehicleNumber, p.deliveryPartnerId]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [partners, query]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setBank = (k, v) => setForm((f) => ({ ...f, bankDetails: { ...f.bankDetails, [k]: v } }));

  const valid = form.name.trim()
    && /^\S+@\S+\.\S+$/.test(form.email)
    && /^\d{10}$/.test(String(form.phone).replace(/\D/g, ''))
    && String(form.password).length >= 6
    && form.vehicleNumber.trim()
    && form.licenseNumber.trim()
    && form.bankDetails.accountNumber.trim()
    && form.bankDetails.ifscCode.trim()
    && form.bankDetails.bankName.trim();

  const createPartner = async (e) => {
    e.preventDefault();
    if (!valid) { toastError('Every field marked required must be filled'); return; }
    try {
      const res = await api.post('/delivery-partner/register', form);
      const p = oneOf(res.data, 'partner') || {};
      setCreated({
        name: p.name || form.name,
        email: p.email || form.email,
        password: form.password,
        id: p.deliveryPartnerId || ''
      });
      setForm(EMPTY_FORM);
      fetchPartners();
      toastSuccess('Partner account created');
    } catch (err) {
      toastError(err, 'Could not create partner');
    }
  };

  const toggleBan = async (p) => {
    try {
      const reason = p.isBanned ? undefined : (window.prompt('Reason for blocking?') || 'Blocked by admin');
      await api.put(`/delivery-partner/${p._id}/ban`, { isBanned: !p.isBanned, reason });
      toastSuccess(p.isBanned ? 'Partner reinstated' : 'Partner blocked');
      fetchPartners();
    } catch (err) {
      toastError(err, 'Could not update partner');
    }
  };

  const label = (text) => (
    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>{text}</label>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className={tab === 'partners' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('partners')}>
          <FiTruck size={15} /> Partners ({partners.length})
        </button>
        <button className={tab === 'working' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('working')}>
          <FiSearch size={15} /> Working now ({working.length})
        </button>
      </div>

      {tab === 'partners' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <FiSearch size={15} style={{ position: 'absolute', left: 11, top: 13, color: 'var(--text-light)' }} />
              <input className="input" style={{ paddingLeft: 34 }} placeholder="Search name, email, phone, vehicle, ID"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              <FiPlus size={15} /> New partner
            </button>
          </div>

          {showForm && (
            <form onSubmit={createPartner} className="card-flat" style={{ padding: 20, marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Create a delivery partner login</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>{label('Full name *')}<input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
                <div>{label('Email *')}<input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                <div>{label('Phone *')}<input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10 digits" /></div>
                <div>{label('Login password *')}<input className="input" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="at least 6 characters" /></div>
                <div>{label('Vehicle type *')}
                  <select className="input" value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
                    {['bike', 'scooter', 'car', 'cycle'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>{label('Vehicle number *')}<input className="input" value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value)} /></div>
                <div>{label('Licence number *')}<input className="input" value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} /></div>
                <div>{label('Aadhaar number')}<input className="input" value={form.aadharNumber} onChange={(e) => set('aadharNumber', e.target.value)} /></div>
                <div>{label('PAN')}<input className="input" value={form.panNumber} onChange={(e) => set('panNumber', e.target.value)} /></div>
                <div>{label('Bank name *')}<input className="input" value={form.bankDetails.bankName} onChange={(e) => setBank('bankName', e.target.value)} /></div>
                <div>{label('Account number *')}<input className="input" value={form.bankDetails.accountNumber} onChange={(e) => setBank('accountNumber', e.target.value)} /></div>
                <div>{label('IFSC *')}<input className="input" value={form.bankDetails.ifscCode} onChange={(e) => setBank('ifscCode', e.target.value)} /></div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '12px 0 14px' }}>
                Hand these credentials to the partner. They sign in at <code>/delivery-partner/login</code>.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={!valid}>Create account</button>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
              </div>
            </form>
          )}

          {created && (
            <div className="card-flat" style={{ padding: 16, marginBottom: 18, borderLeft: '3px solid var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 13.5 }}>
                  <strong>{created.name}</strong> can now sign in.
                  <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                    Email <b>{created.email}</b> · Password <b>{created.password}</b>
                    {created.id ? ` · Partner ID ${created.id}` : ''}
                  </div>
                </div>
                <button onClick={() => setCreated(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><FiX size={16} /></button>
              </div>
            </div>
          )}

          <div className="card-flat" style={{ overflowX: 'auto' }}>
            {loading ? <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</p>
              : filteredPartners.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No delivery partners yet.</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Name</th><th style={th}>Contact</th><th style={th}>Vehicle</th>
                    <th style={th}>Active</th><th style={th}>Deliveries</th><th style={th}>Earnings</th>
                    <th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredPartners.map((p) => (
                      <tr key={p._id}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{p.deliveryPartnerId}</div>
                        </td>
                        <td style={td}>{p.phone}<div style={{ fontSize: 12, color: 'var(--text-light)' }}>{p.email}</div></td>
                        <td style={td}><span style={{ textTransform: 'capitalize' }}>{p.vehicleType}</span><div style={{ fontSize: 12, color: 'var(--text-light)' }}>{p.vehicleNumber}</div></td>
                        <td style={td}>
                          <span className={`badge ${p.isAvailable ? 'badge-soft-success' : 'badge-soft-neutral'}`} style={{ padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                            {p.isAvailable ? 'Available' : 'Busy'}
                          </span>
                        </td>
                        <td style={td}>{p.totalDeliveries ?? 0}</td>
                        <td style={td}>
                          Rs. {Math.round(p.totalEarnings || 0).toLocaleString('en-IN')}
                          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>due Rs. {Math.round(p.pendingEarnings || 0).toLocaleString('en-IN')}</div>
                        </td>
                        <td style={td}>
                          <span className={`badge ${p.isBanned ? 'badge-soft-danger' : 'badge-soft-neutral'}`} style={{ padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                            {p.isBanned ? 'Blocked' : (p.isActive === false ? 'Disabled' : 'Active')}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => toggleBan(p)} title={p.isBanned ? 'Reinstate' : 'Block'} className="btn btn-link" style={{ color: p.isBanned ? 'var(--success)' : 'var(--danger)' }}>
                            {p.isBanned ? <><FiCheck size={14} /> Reinstate</> : <><FiSlash size={14} /> Block</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}

      {tab === 'working' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <FiSearch size={15} style={{ position: 'absolute', left: 11, top: 13, color: 'var(--text-light)' }} />
              <input className="input" style={{ paddingLeft: 34 }} placeholder="Search order, partner, seller, customer or address"
                value={workingSearch} onChange={(e) => setWorkingSearch(e.target.value)} />
            </div>
            <select className="input" style={{ width: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All active statuses</option>
              {['confirmed', 'packed', 'picked_up', 'in_transit'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>

          {summary.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
              {summary.map((s, i) => (
                <div key={i} className="card-flat" style={{ padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{s.partner?.name || 'Unassigned'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{s.activeDeliveries} live · earns Rs. {Math.round(s.expectedEarnings).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card-flat" style={{ overflowX: 'auto' }}>
            {working.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No partner is carrying an order right now.</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Order</th><th style={th}>Partner</th><th style={th}>Pick up from</th>
                    <th style={th}>Deliver to</th><th style={th}>Status</th><th style={th}>Km</th><th style={th}>Earns</th>
                  </tr></thead>
                  <tbody>
                    {working.map((r) => (
                      <tr key={r.orderId}>
                        <td style={{ ...td, fontWeight: 600 }}>{r.orderNumber}</td>
                        <td style={td}>{r.partner?.name}<div style={{ fontSize: 12, color: 'var(--text-light)' }}>{r.partner?.phone}</div></td>
                        <td style={td}>{r.seller?.storeName || '-'}<div style={{ fontSize: 12, color: 'var(--text-light)' }}>{r.seller?.phone}</div></td>
                        <td style={td}>{r.customer?.name}<div style={{ fontSize: 12, color: 'var(--text-light)' }}>{r.destination}</div></td>
                        <td style={{ ...td, textTransform: 'capitalize' }}>{r.orderStatus?.replace('_', ' ')}</td>
                        <td style={td}>{r.distanceKm || '-'}</td>
                        <td style={td}>Rs. {Math.round(r.earnings || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}
    </div>
  );
}
