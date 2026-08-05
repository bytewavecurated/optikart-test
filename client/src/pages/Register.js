import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiPhone, FiEye, FiEyeOff } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Enter a valid email';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(formData.phone)) newErrors.phone = 'Enter a valid 10-digit phone number';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { confirmPassword, ...submitData } = formData;
    const result = await register(submitData);
    setLoading(false);
    if (result.success) {
      navigate('/');
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
            <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>Create Account</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>Sign up and start shopping for eyewear</p>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <FiUser style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter your full name" className={`input ${errors.name ? 'input-error' : ''}`} style={{ paddingLeft: '38px' }} />
              </div>
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" className={`input ${errors.email ? 'input-error' : ''}`} style={{ paddingLeft: '38px' }} />
              </div>
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <FiPhone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="10-digit mobile number" className={`input ${errors.phone ? 'input-error' : ''}`} style={{ paddingLeft: '38px' }} />
              </div>
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} placeholder="Create a password" className={`input ${errors.password ? 'input-error' : ''}`} style={{ paddingLeft: '38px', paddingRight: '38px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', cursor: 'pointer' }}>
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '16px' }} />
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm your password" className={`input ${errors.confirmPassword ? 'input-error' : ''}`} style={{ paddingLeft: '38px' }} />
              </div>
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginBottom: '16px' }}>
              {loading ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login</Link>
            </p>
          </form>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default Register;
