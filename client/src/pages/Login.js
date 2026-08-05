import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiKey } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const Login = () => {
  const [step, setStep] = useState(1); // 1: email/password, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { login, verifyLoginOTP } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!validate()) return;
      setLoading(true);
      const result = await login(email, password);
      setLoading(false);
      
      if (result.success) {
        if (result.requiresOTP) {
          setStep(2);
          toast.success('OTP sent to your email');
        } else if (result.token) {
          navigate('/');
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
    const result = await verifyLoginOTP(email, otp);
    setLoading(false);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      toast.error(result.message || 'OTP verification failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--bg-white)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '420px', overflow: 'hidden' }}
        >
          <div style={{ background: 'var(--primary)', padding: '24px 32px' }}>
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>
              {step === 1 ? 'Login' : 'Verify OTP'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>
              {step === 1 
                ? 'Get access to your Orders, Wishlist and Recommendations'
                : `Enter the 6-digit OTP sent to ${email}`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <FiMail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={`input ${errors.email ? 'input-error' : ''}`}
                    style={{ paddingLeft: '38px' }}
                  />
                </div>
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <FiLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`input ${errors.password ? 'input-error' : ''}`}
                    style={{ paddingLeft: '38px', paddingRight: '38px' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', cursor: 'pointer' }}>
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginBottom: '16px' }}>
                {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Login'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create Account</Link>
              </p>
              <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Are you a seller?{' '}
                <Link to="/seller/login" style={{ color: 'var(--secondary)', fontWeight: 600 }}>Seller Login</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleOTPSubmit} style={{ padding: '32px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Enter OTP</label>
                <div style={{ position: 'relative' }}>
                  <FiKey style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
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

              <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginBottom: '16px' }}>
                {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Verify & Login'}
              </button>

              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="btn btn-outline btn-block"
                style={{ marginBottom: '16px' }}
              >
                Back to Login
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-light)' }}>
                Didn't receive OTP?{' '}
                <button 
                  type="button" 
                  onClick={() => toast.success('OTP resent to your email')}
                  style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Resend OTP
                </button>
              </p>
            </form>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
