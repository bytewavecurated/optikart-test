import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiPhone, FiUser, FiHome, FiMapPin, FiChevronsRight } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const SellerRegister = () => {
  const [formData, setFormData] = useState({
    businessName: '', ownerName: '', email: '', phone: '', password: '', confirmPassword: '',
    gstNumber: '', panNumber: '', aadharNumber: '', street: '', city: '', state: '', pincode: '',
    lat: '', lng: '', detecting: false,
    bankAccount: { accountNumber: '', ifscCode: '', bankName: '', branchName: '' }
  });
  const [verified, setVerified] = useState(null); // { sellerId } after registration
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { sellerRegister, verifySellerPhoneOTP } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!(formData.street || '').trim()) newErrors.street = 'Street address is required';
    if (!(formData.city || '').trim()) newErrors.city = 'City is required';
    if (!(formData.state || '').trim()) newErrors.state = 'State is required';
    if (!/^\d{6}$/.test(String(formData.pincode || '').trim())) newErrors.pincode = 'Enter a valid 6-digit PIN code';
    if (!(formData.bankAccount?.accountNumber || '').trim()) newErrors.accountNumber = 'Bank account number is required';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(formData.bankAccount?.ifscCode || '').toUpperCase())) newErrors.ifscCode = 'Enter a valid IFSC code';
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}[A-Z\d]{1}$/.test(String(formData.gstNumber || '').toUpperCase())) newErrors.gstNumber = 'Enter a valid 15-character GSTIN';
    if (!/^\d{12}$/.test(String(formData.aadharNumber || '').replace(/\s/g, ''))) newErrors.aadharNumber = 'Enter a valid 12-digit Aadhaar number';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Invalid phone';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Min 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Offers the applicant a precise pin; the server falls back to resolving the
  // PIN code, so this is an improvement, never a requirement.
  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error('This browser cannot share a location; the PIN code will be used instead'); return; }
    setFormData((f) => ({ ...f, detecting: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((f) => ({ ...f, detecting: false, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        toast.success('Store position captured');
      },
      () => { setFormData((f) => ({ ...f, detecting: false })); toast.error('Could not get your location; the PIN code will be used'); },
      { timeout: 10000 }
    );
  };

  const setBank = (k, v) => setFormData((f) => ({ ...f, bankAccount: { ...f.bankAccount, [k]: v.toUpperCase ? v.toUpperCase() : v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { confirmPassword, ...submitData } = formData;
    const result = await sellerRegister(submitData);
    setLoading(false);
    if (result.success) {
      // Registration issues a phone OTP; the account is usable only after it.
      setVerified({ sellerId: result.sellerId, email: formData.email });
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'var(--bg-white)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '24px 32px' }}>
          <h1 style={{ color: 'var(--text-white)', fontSize: '22px', fontWeight: 700 }}>Seller Registration</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>Start selling on OptiKart</p>
        </div>
        {verified ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await verifySellerPhoneOTP(verified.sellerId, otp);
              if (r.success) navigate('/seller/login');
            }}
            style={{ padding: '32px' }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>Verify your phone</h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
              We sent a 6-digit code to {verified.email}. Your store will appear in the marketplace once it is verified.
            </p>
            <div className="input-group">
              <label>OTP</label>
              <input className="input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg">Verify and continue</button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group"><label>Business Name *</label><input className="input" name="businessName" value={formData.businessName} onChange={handleChange} placeholder="Your store name" /></div>
            <div className="input-group"><label>Owner Name *</label><input className="input" name="ownerName" value={formData.ownerName} onChange={handleChange} placeholder="Full name" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div className="input-group"><label>Email *</label><input className="input" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email address" /></div>
            <div className="input-group"><label>Phone *</label><input className="input" name="phone" value={formData.phone} onChange={handleChange} placeholder="10-digit number" /></div>
          </div>
          <div className="input-group" style={{ marginTop: '16px' }}><label>GST Number (optional)</label><input className="input" name="gstNumber" value={formData.gstNumber} onChange={handleChange} placeholder="Enter GST number" /></div>
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--text-secondary)' }}>Store location</span>
              <button type="button" onClick={useMyLocation} disabled={formData.detecting} className="btn btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <FiMapPin size={14} /> {formData.detecting ? 'Detecting...' : (formData.lat ? 'Position captured' : 'Use my current location')}
              </button>
            </div>
            <div className="input-group"><label>Street *</label><input className="input" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} placeholder="Shop no., building, road" />{errors.street && <span className="error-text">{errors.street}</span>}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group" style={{ marginBottom: 0 }}><label>City *</label><input className="input" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />{errors.city && <span className="error-text">{errors.city}</span>}</div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>State *</label><input className="input" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />{errors.state && <span className="error-text">{errors.state}</span>}</div>
            </div>
            <div className="input-group" style={{ marginTop: 16 }}>
              <label>PIN code *</label>
              <input className="input" inputMode="numeric" maxLength={6} value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })} placeholder="6-digit PIN" />{errors.pincode && <span className="error-text">{errors.pincode}</span>}
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                Used to route nearby customer orders to your store{formData.lat ? ' (exact position captured)' : ' (resolved from the PIN code)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div className="input-group" style={{ marginBottom: 0 }}><label>GST number *</label><input className="input" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })} placeholder="27AAAAA0000A1Z5" maxLength={15} />{errors.gstNumber && <span className="error-text">{errors.gstNumber}</span>}</div>
            <div className="input-group"><label>PAN</label><input className="input" value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} placeholder="Optional" /></div>
          </div>

          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--text-secondary)' }}>Settlement bank account</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 10 }}>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Account number *</label><input className="input" value={formData.bankAccount.accountNumber} onChange={(e) => setBank('accountNumber', e.target.value.replace(/\s/g, ''))} />{errors.accountNumber && <span className="error-text">{errors.accountNumber}</span>}</div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>IFSC *</label><input className="input" value={formData.bankAccount.ifscCode} onChange={(e) => setBank('ifscCode', e.target.value.replace(/\s/g, ''))} placeholder="HDFC0001234" />{errors.ifscCode && <span className="error-text">{errors.ifscCode}</span>}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 16 }}>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Bank name *</label><input className="input" value={formData.bankAccount.bankName} onChange={(e) => setFormData({ ...formData, bankAccount: { ...formData.bankAccount, bankName: e.target.value } })} /></div>
              <div className="input-group" style={{ marginBottom: 0 }}><label>Branch</label><input className="input" value={formData.bankAccount.branchName} onChange={(e) => setFormData({ ...formData, bankAccount: { ...formData.bankAccount, branchName: e.target.value } })} /></div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '8px 0 0' }}>
              Payouts for delivered orders are transferred to this account.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div className="input-group"><label>Password *</label><input className="input" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 6 characters" /></div>
            <div className="input-group"><label>Confirm Password *</label><input className="input" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter password" /></div>
          </div>
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
          {Object.keys(errors).length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--danger)', margin: '14px 0 0' }}>
              Please correct the highlighted fields before registering.
            </p>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginTop: '24px' }}>
            {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Register as Seller'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px' }}>
            Already registered? <Link to="/seller/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login here</Link>
          </p>
        </form>
        )}
      </motion.div>
    </div>
  );
};

export default SellerRegister;
