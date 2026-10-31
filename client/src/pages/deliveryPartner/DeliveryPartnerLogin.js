import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { deliveryPartner as deliveryApi } from '../../services/api';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiKey, FiTruck } from 'react-icons/fi';
import { toastError } from '../../services/errors.js';
import Logo from '../../components/Logo';

const DeliveryPartnerLogin = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [errors, setErrors] = useState({});
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
      try {
        const response = await deliveryApi.login(email, password);
        const data = response.data;

        if (data.success) {
          if (data.requiresOTP) {
            setPartnerId(data.partnerId);
            setStep(2);
            toast.success('OTP sent to your email');
          } else if (data.token) {
            localStorage.setItem('optikart_token', data.token);
            localStorage.setItem('optikart_role', 'deliveryPartner');
            toast.success('Login successful!');
            navigate('/delivery-partner/dashboard');
          }
        } else {
          toast.error(data.message || 'Login failed');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await deliveryApi.verifyOTP(partnerId, otp);
      const data = response.data;

      if (data.success && data.token) {
        localStorage.setItem('optikart_token', data.token);
        localStorage.setItem('optikart_role', 'deliveryPartner');
        toast.success('Login successful!');
        navigate('/delivery-partner/dashboard');
      } else {
        toast.error(data.message || 'OTP verification failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '20px' }}>
      <div style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: '420px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--bg-dark)', padding: '26px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Logo variant="onDark" size={22} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '4px 0 0' }}>
            {step === 1 ? 'Delivery Partner Login' : `Enter OTP sent to ${email}`}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary, #555)', marginBottom: '6px' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light, #999)', fontSize: '16px' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              {errors.email && <span style={{ color: '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary, #555)', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light, #999)', fontSize: '16px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`input ${errors.password ? 'input-error' : ''}`}
                  style={{ width: '100%', padding: '12px 40px 12px 40px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light, #999)', padding: 0 }}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <span style={{ color: '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.password}</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block btn-lg"
              style={{ width: '100%', padding: '14px', background: loading ? '#9e9e9e' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary, #757575)', margin: 0 }}>
              <Link to="/" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Back to Home</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleOTPSubmit} style={{ padding: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary, #555)', marginBottom: '6px' }}>Enter OTP</label>
              <div style={{ position: 'relative' }}>
                <FiKey style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light, #999)', fontSize: '16px' }} />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  className="input"
                  style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '18px', fontWeight: 600, letterSpacing: '8px', boxSizing: 'border-box' }}
                  maxLength={6}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block btn-lg"
              style={{ width: '100%', padding: '14px', background: loading ? '#9e9e9e' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setOtp(''); }}
              className="btn btn-outline btn-block"
              style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}
            >
              Back to Login
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-light, #999)', margin: 0 }}>
              Didn't receive OTP?{' '}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deliveryApi.login(email, password);
                    toast.success('OTP resent to your email');
                  } catch {
                    toastError(error, "Failed to resend OTP");
                  }
                }}
                style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px' }}
              >
                Resend OTP
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default DeliveryPartnerLogin;
