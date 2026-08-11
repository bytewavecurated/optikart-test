import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiKey } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const StaffLogin = () => {
  const [step, setStep] = useState(1); // 1: email/password, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { staffLogin, verifyStaffLoginOTP } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    const result = await staffLogin(email, password);
    setLoading(false);
    
    if (result.success) {
      if (result.requiresOTP) {
        setStep(2);
        toast.success('OTP sent to your email');
      } else if (result.token) {
        // Redirect based on staff role
        const role = result.staff?.role || 'blog_manager';
        switch(role) {
          case 'blog_manager':
            navigate('/staff/blogs');
            break;
          case 'support_agent':
            navigate('/staff/support');
            break;
          case 'product_manager':
            navigate('/staff/products');
            break;
          case 'order_manager':
            navigate('/staff/orders');
            break;
          default:
            navigate('/staff/dashboard');
        }
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
    const result = await verifyStaffLoginOTP(email, otp);
    setLoading(false);
    
    if (result.success) {
      toast.success('Staff login successful!');
      // Redirect based on staff role
      const role = result.staff?.role || 'blog_manager';
      switch(role) {
        case 'blog_manager':
          navigate('/staff/blogs');
          break;
        case 'support_agent':
          navigate('/staff/support');
          break;
        case 'product_manager':
          navigate('/staff/products');
          break;
        case 'order_manager':
          navigate('/staff/orders');
          break;
        default:
          navigate('/staff/dashboard');
      }
    } else {
      toast.error(result.message || 'OTP verification failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1b2a', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '32px', textAlign: 'center' }}>
          <FiUser size={40} style={{ color: '#fff', marginBottom: '12px' }} />
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>
            {step === 1 ? 'Staff Portal' : 'Verify OTP'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '4px' }}>
            {step === 1 
              ? 'OptiKart Staff Access'
              : `Enter the 6-digit OTP sent to ${email}`}
          </p>
        </div>
        
        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Staff email" className="input" style={{ paddingLeft: '38px' }} />
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
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-light)', marginTop: '16px' }}>
              Contact admin if you don't have access
            </p>
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

export default StaffLogin;
