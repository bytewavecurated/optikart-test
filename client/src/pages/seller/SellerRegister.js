import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiPhone, FiUser, FiHome } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

const SellerRegister = () => {
  const [formData, setFormData] = useState({ businessName: '', ownerName: '', email: '', phone: '', password: '', confirmPassword: '', gstNumber: '', businessAddress: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { sellerRegister } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { confirmPassword, ...submitData } = formData;
    const result = await sellerRegister(submitData);
    setLoading(false);
    if (result.success) navigate('/seller/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '24px 32px' }}>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>Seller Registration</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>Start selling on OptiKart</p>
        </div>
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
          <div className="input-group" style={{ marginTop: '16px' }}><label>Business Address</label><textarea className="input" rows={2} name="businessAddress" value={formData.businessAddress} onChange={handleChange} placeholder="Business address" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div className="input-group"><label>Password *</label><input className="input" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 6 characters" /></div>
            <div className="input-group"><label>Confirm Password *</label><input className="input" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter password" /></div>
          </div>
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
          <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginTop: '24px' }}>
            {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Register as Seller'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '16px' }}>
            Already registered? <Link to="/seller/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login here</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default SellerRegister;
