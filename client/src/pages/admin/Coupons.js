import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const Coupons = () => {
  const [couponList, setcouponList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ code: '', type: 'percentage', value: '', minOrder: '', maxDiscount: '', description: '', validUntil: '' });

  useEffect(() => { fetchCoupons(); }, []);
  const fetchCoupons = async () => {
    try { const res = await adminApi.getCoupons(); setcouponList(res.data.data || []); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!formData.code || !formData.value) { toast.error('Fill required fields'); return; }
    try {
      if (editing) { await adminApi.updateCoupon(editing._id, formData); toast.success('Updated'); }
      else { await adminApi.createCoupon(formData); toast.success('Created'); }
      setShowForm(false); setEditing(null); setFormData({ code: '', type: 'percentage', value: '', minOrder: '', maxDiscount: '', description: '', validUntil: '' }); fetchCoupons();
    } catch (err) { toast.error('Failed'); }
  };

  const handleEdit = (coupon) => {
    setEditing(coupon);
    setFormData({ code: coupon.code, type: coupon.type, value: coupon.value, minOrder: coupon.minOrder || '', maxDiscount: coupon.maxDiscount || '', description: coupon.description || '', validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try { await adminApi.deleteCoupon(id); toast.success('Deleted'); fetchCoupons(); } catch (err) { toast.error('Failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Coupons ({couponList.length})</h1>
            <button onClick={() => { setShowForm(true); setEditing(null); setFormData({ code: '', type: 'percentage', value: '', minOrder: '', maxDiscount: '', description: '', validUntil: '' }); }} className="btn btn-primary"><FiPlus /> Add Coupon</button>
          </div>
          {showForm && (
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editing ? 'Edit' : 'Create'} Coupon</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group"><label>Code *</label><input className="input" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE20" /></div>
                <div className="input-group"><label>Type</label><select className="input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}><option value="percentage">Percentage</option><option value="flat">Flat</option></select></div>
                <div className="input-group"><label>Value *</label><input className="input" type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} /></div>
                <div className="input-group"><label>Min Order</label><input className="input" type="number" value={formData.minOrder} onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })} /></div>
                <div className="input-group"><label>Max Discount</label><input className="input" type="number" value={formData.maxDiscount} onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })} /></div>
                <div className="input-group"><label>Valid Until</label><input className="input" type="date" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} /></div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Description</label><input className="input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleSave} className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Code', 'Type', 'Value', 'Min Order', 'Valid Until', 'Actions'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {couponList.map((c) => (
                    <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{c.code}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{c.type}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>{c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{c.minOrder ? `₹${c.minOrder}` : '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{c.validUntil ? new Date(c.validUntil).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '12px 16px' }}><div style={{ display: 'flex', gap: '6px' }}><button onClick={() => handleEdit(c)} className="btn btn-outline btn-sm"><FiEdit2 size={12} /></button><button onClick={() => handleDelete(c._id)} className="btn btn-danger btn-sm"><FiTrash2 size={12} /></button></div></td>
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

export default Coupons;
