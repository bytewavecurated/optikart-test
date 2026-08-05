import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiKey } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const SellerLogin = () => {
  const [step, setStep] = useState(1); // 1: email/password, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { sellerLogin, verifySellerLoginOTP } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!validate()) return;
      setLoading(true);
      const result = await sellerLogin(email, password);
      setLoading(false);
      
      if (result.success) {
        if (result.requiresOTP) {
          setStep(2);
          setSellerId(result.sellerId);
          toast.success('OTP sent to your email');
        } else if (result.token) {
          navigate('/seller/dashboard');
        }
      } else {
        toast.error(result.message || 'Login failed');
      }
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    const result = await verifySellerLoginOTP(sellerId, otp);
    setLoading(false);
    
    if (result.success) {
      toast.success('Seller login successful!');
      navigate('/seller/dashboard');
    } else {
      toast.error(result.message || 'OTP verification failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '420px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '24px 32px' }}>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>
            {step === 1 ? 'Seller Login' : 'Verify OTP'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>
            {step === 1 
              ? 'Access your seller dashboard'
              : `Enter the 6-digit OTP sent to ${email}`}
          </p>
        </div>
        
        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seller email" className={`input ${errors.email ? 'input-error' : ''}`} style={{ paddingLeft: '38px' }} />
              </div>
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={`input ${errors.password ? 'input-error' : ''}`} style={{ paddingLeft: '38px', paddingRight: '38px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', cursor: 'pointer' }}>{showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}</button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginBottom: '16px' }}>
              {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Login'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
              New seller? <Link to="/seller/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Register here</Link>
            </p>
            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              <Link to="/login" style={{ color: 'var(--text-light)' }}>User Login</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleOTPSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Enter OTP</label>
              <div style={{ position: 'relative' }}>
                <FiKey style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  className="input"
                  style={{ paddingLeft: '38px', letterSpacing: '8px', fontSize: '18px', fontWeight: 600 }}
                  maxLength={6}
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginBottom: '12px' }}>
              {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Verify & Login'}
            </button>
            <button 
              type="button" 
              onClick={() => setStep(1)} 
              className="btn btn-outline btn-block"
            >
              Back to Login
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default SellerLogin;
