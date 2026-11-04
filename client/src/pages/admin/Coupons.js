import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

/*
 * Field names follow server/models/Coupon.js. The previous form posted `type`,
 * `value` and `minOrder`, offered a `flat` discount the schema calls `fixed`,
 * and never sent the required `validFrom` - so no coupon had ever been created
 * from this screen, and every row printed `undefined` for its terms.
 */
const EMPTY = {
  code: '', description: '', discountType: 'percentage', discountValue: '',
  minOrderAmount: '', maxDiscount: '', usageLimit: '', validFrom: '', validUntil: '', isActive: true
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const dateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/**
 * Whether the code can actually be redeemed right now. "Active" alone is not an
 * answer: a coupon past its end date or short of stock still reads as enabled in
 * the database, and an operator enabling one and seeing no effect has no way to
 * tell those apart.
 */
const liveState = (c, now = Date.now()) => {
  if (!c.isActive) return { label: 'Disabled', tone: 'var(--text-light)' };
  if (c.validFrom && new Date(c.validFrom).getTime() > now) {
    return { label: `Starts ${dateOnly(c.validFrom)}`, tone: 'var(--brand)' };
  }
  if (c.validUntil && new Date(c.validUntil).getTime() < now) return { label: 'Expired', tone: 'var(--danger)' };
  if (c.usageLimit && (c.usageCount || 0) >= c.usageLimit) return { label: 'Used up', tone: 'var(--danger)' };
  return { label: 'Live', tone: 'var(--success)' };
};

const Coupons = () => {
  const [couponList, setCouponList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCoupons(); }, []);

  const fetchCoupons = async () => {
    try {
      const res = await adminApi.getCoupons();
      setCouponList(listOf(res.data));
    } catch (error) {
      console.error(error);
      toastError(error, 'Could not load coupons');
    } finally {
      setLoading(false);
    }
  };

  const set = (key, value) => {
    setFormData((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const handleEdit = (coupon) => {
    setEditing(coupon);
    setFormData({
      code: coupon.code || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue ?? '',
      minOrderAmount: coupon.minOrderAmount ?? '',
      maxDiscount: coupon.maxDiscount ?? '',
      usageLimit: coupon.usageLimit ?? '',
      validFrom: dateOnly(coupon.validFrom),
      validUntil: dateOnly(coupon.validUntil),
      isActive: coupon.isActive !== false
    });
    setFieldErrors({});
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ ...EMPTY, validFrom: dateOnly(new Date()), validUntil: dateOnly(new Date(Date.now() + 30 * 864e5)) });
    setFieldErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        validFrom: formData.validFrom,
        validUntil: formData.validUntil,
        isActive: formData.isActive
      };
      if (formData.minOrderAmount !== '') payload.minOrderAmount = Number(formData.minOrderAmount);
      if (formData.maxDiscount !== '') payload.maxDiscount = Number(formData.maxDiscount);
      if (formData.usageLimit !== '') payload.usageLimit = Number(formData.usageLimit);

      const res = editing
        ? await adminApi.updateCoupon(editing._id, payload)
        : await adminApi.createCoupon(payload);
      toast.success(editing ? 'Coupon updated' : 'Coupon created');
      setShowForm(false);
      setEditing(null);
      fetchCoupons();
      return res;
    } catch (error) {
      const errs = error.response?.data?.errors;
      if (Array.isArray(errs)) {
        // Put each complaint next to the box that caused it rather than in a
        // toast nobody can map back to a field.
        setFieldErrors(Object.fromEntries(errs.map((e2) => [e2.field, e2.message])));
      }
      toastError(error, 'The coupon was not saved');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`Delete ${coupon.code}? Orders that already used it keep their discount.`)) return;
    try {
      await adminApi.deleteCoupon(coupon._id);
      toast.success('Coupon deleted');
      fetchCoupons();
    } catch (error) {
      toastError(error, 'Could not delete the coupon');
    }
  };

  const label = (text, required) => (
    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>
      {text}{required && ' *'}
    </label>
  );

  const field = (key, title, extra = {}) => (
    <div>
      {label(title, extra.required)}
      <input className="input" id={`coupon-${key}`} value={formData[key]} onChange={(e) => set(key, e.target.value)} {...extra} />
      {fieldErrors[key] && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger)' }}>{fieldErrors[key]}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: 10 }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Coupons ({couponList.length})</h1>
            <button onClick={openCreate} className="btn btn-primary"><FiPlus /> Add Coupon</button>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
            A code applies at checkout to every seller unless categories are restricted. Expired or fully used codes stay listed so the history is not silently rewritten.
          </p>

          {showForm && (
            <div className="card-flat" style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>{editing ? `Edit ${editing.code}` : 'New coupon'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                <div>
                  {label('Code *', true)}
                  <input className="input" id="coupon-code" value={formData.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SAVE20" />
                  {fieldErrors.code && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger)' }}>{fieldErrors.code}</p>}
                </div>
                <div>
                  {label('Discount type')}
                  <select className="input" id="coupon-discountType" value={formData.discountType} onChange={(e) => set('discountType', e.target.value)}>
                    <option value="percentage">Percentage off</option>
                    <option value="fixed">Fixed amount off</option>
                  </select>
                  {fieldErrors.discountType && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger)' }}>{fieldErrors.discountType}</p>}
                </div>
                {field('discountValue', formData.discountType === 'percentage' ? 'Percent off *' : 'Amount off (₹) *', { type: 'number', min: 1, required: true })}
                {field('minOrderAmount', 'Minimum order (₹)', { type: 'number', min: 0 })}
                {field('maxDiscount', formData.discountType === 'percentage' ? 'Maximum discount (₹)' : 'Cap (₹)', { type: 'number', min: 0 })}
                {field('usageLimit', 'Redemption limit (0 = unlimited)', { type: 'number', min: 0 })}
                {field('validFrom', 'Starts *', { type: 'date', required: true })}
                {field('validUntil', 'Ends *', { type: 'date', required: true })}
                <div>
                  {label('Short description')}
                  <input className="input" id="coupon-description" value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Shown to shoppers on the coupon card" />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5 }}>
                <input type="checkbox" id="coupon-isActive" checked={formData.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                Enabled
              </label>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : (editing ? 'Update coupon' : 'Create coupon')}</button>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : couponList.length === 0 ? (
            <div className="empty-state">
              <h3>No coupons yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Create one and shoppers can apply it at checkout.</p>
            </div>
          ) : (
            <div className="card-flat" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Code', 'Discount', 'Conditions', 'Window', 'Used', 'State', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {couponList.map((c) => {
                    const state = liveState(c);
                    return (
                      <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{c.code}</div>
                          {c.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.description}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>
                          {c.discountType === 'percentage' ? `${c.discountValue}%` : money(c.discountValue)}
                          {c.discountType === 'percentage' && c.maxDiscount ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 12 }}> up to {money(c.maxDiscount)}</span> : ''}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {c.minOrderAmount ? `min ${money(c.minOrderAmount)}` : 'no minimum'}
                          {(c.applicableCategories || []).length > 0 && ` · ${c.applicableCategories.join(', ')}`}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {dateOnly(c.validFrom)} → {dateOnly(c.validUntil)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>
                          {c.usageCount || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: state.tone }}>{state.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleEdit(c)} className="btn btn-outline btn-sm" aria-label={`Edit ${c.code}`}><FiEdit2 size={12} /></button>
                            <button onClick={() => handleDelete(c)} className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} aria-label={`Delete ${c.code}`}><FiTrash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

export default Coupons;
