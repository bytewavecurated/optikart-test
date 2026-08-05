import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiShield, FiKey } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const AdminLogin = () => {
  const [step, setStep] = useState(1); // 1: email/password, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { adminLogin, verifyAdminLoginOTP } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    const result = await adminLogin(email, password);
    setLoading(false);
    
    if (result.success) {
      if (result.requiresOTP) {
        setStep(2);
        toast.success('OTP sent to your email');
      } else if (result.token) {
        navigate('/admin');
      }
    } else {
      toast.error(result.message || 'Login failed');
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    const result = await verifyAdminLoginOTP(email, otp);
    setLoading(false);
    
    if (result.success) {
      toast.success('Admin login successful!');
      navigate('/admin');
    } else {
      toast.error(result.message || 'OTP verification failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1b2a', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a237e, #283593)', padding: '32px', textAlign: 'center' }}>
          <FiShield size={40} style={{ color: '#fff', marginBottom: '12px' }} />
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>
            {step === 1 ? 'Admin Panel' : 'Verify OTP'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>
            {step === 1 
              ? 'OptiKart Administration'
              : `Enter the 6-digit OTP sent to ${email}`}
          </p>
        </div>
        
        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" className="input" style={{ paddingLeft: '38px' }} />
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="input" style={{ paddingLeft: '38px' }} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg">
              {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOTPSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Enter OTP</label>
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

export default AdminLogin;
