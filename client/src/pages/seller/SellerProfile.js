import React, { useState } from 'react';
import { FiSave } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const SellerProfile = () => {
  const { seller, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    businessName: seller?.businessName || '',
    ownerName: seller?.ownerName || '',
    email: seller?.email || '',
    phone: seller?.phone || '',
    gstNumber: seller?.gstNumber || '',
    businessAddress: seller?.businessAddress || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateProfile(formData);
    setSaving(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Seller Profile</h1>
          <div style={{ maxWidth: '700px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>{(formData.businessName || 'S').charAt(0).toUpperCase()}</div>
                <div><h3 style={{ fontSize: '18px', fontWeight: 600 }}>{formData.businessName}</h3><p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Status: <span className="badge badge-success">Active</span></p></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group"><label>Business Name</label><input className="input" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} /></div>
                <div className="input-group"><label>Owner Name</label><input className="input" value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} /></div>
                <div className="input-group"><label>Email</label><input className="input" value={formData.email} disabled style={{ background: 'var(--bg-primary)' }} /></div>
                <div className="input-group"><label>Phone</label><input className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div className="input-group"><label>GST Number</label><input className="input" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })} /></div>
                <div className="input-group"><label>Business Address</label><textarea className="input" rows={2} value={formData.businessAddress} onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })} /></div>
              </div>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ marginTop: '20px' }}>
                {saving ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <><FiSave size={14} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerProfile;
