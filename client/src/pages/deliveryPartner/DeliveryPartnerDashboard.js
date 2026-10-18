import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { deliveryPartner as deliveryApi } from '../../services/api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { FiPackage, FiMapPin, FiDollarSign, FiCheckCircle, FiClock, FiTruck, FiLogOut, FiRefreshCw, FiNavigation } from 'react-icons/fi';

const DeliveryPartnerDashboard = () => {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [stats, setStats] = useState({
    todayDeliveries: 0,
    totalEarnings: 0,
    pendingDeliveries: 0,
    completedToday: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0,
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async () => {
    try {
      const meResponse = await deliveryApi.getMe();
      const partnerData = meResponse.data.data;
      setPartner(partnerData);
      setIsOnline(partnerData.isOnline || false);
      setLocationSharing(partnerData.locationSharing || false);

      setStats({
        todayDeliveries: partnerData.todayDeliveries || 0,
        totalEarnings: partnerData.totalEarnings || 0,
        pendingDeliveries: partnerData.pendingDeliveries || 0,
        completedToday: partnerData.completedToday || 0,
        weeklyEarnings: partnerData.weeklyEarnings || 0,
        monthlyEarnings: partnerData.monthlyEarnings || 0,
      });

      setActiveDeliveries(partnerData.activeDeliveries || []);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('optikart_token');
        localStorage.removeItem('optikart_role');
        navigate('/delivery-partner/login');
        return;
      }
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('optikart_token');
    const role = localStorage.getItem('optikart_role');
    if (!token || role !== 'deliveryPartner') {
      navigate('/delivery-partner/login');
      return;
    }
    fetchDashboardData();
  }, [fetchDashboardData, navigate]);

  const handleToggleOnline = async () => {
    try {
      const newStatus = !isOnline;
      setIsOnline(newStatus);
      toast.success(newStatus ? 'You are now online' : 'You are now offline');
    } catch {
      toast.error('Failed to update status');
      setIsOnline(isOnline);
    }
  };

  const handleToggleLocation = async () => {
    const newStatus = !locationSharing;
    if (newStatus) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await deliveryApi.updateLocation(position.coords.latitude, position.coords.longitude);
              setLocationSharing(true);
              toast.success('Location sharing enabled');
            } catch {
              toast.error('Failed to update location');
            }
          },
          () => {
            toast.error('Location permission denied');
          }
        );
      } else {
        toast.error('Geolocation is not supported by your browser');
      }
    } else {
      setLocationSharing(false);
      toast.success('Location sharing disabled');
    }
  };

  const handleCompleteDelivery = async (orderId) => {
    try {
      await deliveryApi.completeDelivery(orderId);
      toast.success('Delivery marked as completed!');
      setActiveDeliveries((prev) => prev.filter((d) => d.orderId !== orderId));
      setStats((prev) => ({
        ...prev,
        completedToday: prev.completedToday + 1,
        pendingDeliveries: prev.pendingDeliveries - 1,
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to complete delivery');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > stats.totalEarnings) {
      toast.error('Insufficient balance');
      return;
    }

    setWithdrawing(true);
    try {
      await deliveryApi.withdraw(amount);
      toast.success(`Withdrawal of $${amount.toFixed(2)} requested successfully`);
      setWithdrawAmount('');
      setStats((prev) => ({ ...prev, totalEarnings: prev.totalEarnings - amount }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    }
    setWithdrawing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('optikart_token');
    localStorage.removeItem('optikart_role');
    toast.success('Logged out successfully');
    navigate('/delivery-partner/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary, #757575)' }}>Loading dashboard...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const statCards = [
    { label: "Today's Deliveries", value: stats.todayDeliveries, icon: FiTruck, color: 'var(--primary)', bg: '#e3f2fd' },
    { label: 'Total Earnings', value: `$${stats.totalEarnings.toFixed(2)}`, icon: FiDollarSign, color: '#4caf50', bg: '#e8f5e9' },
    { label: 'Pending Deliveries', value: stats.pendingDeliveries, icon: FiClock, color: '#ff9800', bg: '#fff3e0' },
    { label: 'Completed Today', value: stats.completedToday, icon: FiCheckCircle, color: '#2196f3', bg: '#e3f2fd' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #f5f5f5)' }}>
      <Header />

      <main className="container page-wrapper" style={{ flex: 1, padding: '24px 16px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0, color: 'var(--text-dark, #212121)' }}>
              Welcome, {partner?.name || 'Partner'}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #757575)', fontSize: '14px' }}>
              {partner?.email || ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary, #555)' }}>Status:</span>
              <button
                onClick={handleToggleOnline}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isOnline ? '#4caf50' : '#f44336',
                  color: '#fff',
                  transition: 'all 0.3s ease',
                }}
              >
                {isOnline ? 'Online' : 'Offline'}
              </button>
            </div>
            <button
              onClick={handleLogout}
              style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
            >
              <FiLogOut size={14} /> Logout
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div className="card" key={idx} style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', background: card.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light, #999)' }}>{card.label}</p>
                    <h3 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: 'var(--text-dark, #212121)' }}>{card.value}</h3>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Route Optimization Button */}
        <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '28px', textAlign: 'center' }}>
          <FiNavigation size={32} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Optimize Your Delivery Route</h3>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary, #757575)' }}>Get AI-powered route suggestions for efficient deliveries</p>
          <button
            onClick={() => navigate('/delivery-partner/route-optimization')}
            className="btn btn-primary"
            style={{
              padding: '12px 32px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FiNavigation size={16} /> Optimize Route
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }} className="delivery-dashboard-grid">
          <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Active Deliveries</h2>
              <button
                onClick={fetchDashboardData}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500 }}
              >
                <FiRefreshCw size={14} /> Refresh
              </button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {activeDeliveries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <FiPackage size={40} style={{ color: 'var(--text-light, #ccc)', marginBottom: '12px' }} />
                  <p style={{ color: 'var(--text-secondary, #757575)', margin: 0, fontSize: '14px' }}>No active deliveries right now</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                  {activeDeliveries.map((delivery) => (
                    <div
                      key={delivery.orderId}
                      style={{
                        padding: '16px',
                        border: '1px solid #eee',
                        borderRadius: '10px',
                        background: 'var(--bg-primary, #fafafa)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
                            Order #{delivery.orderId?.slice(-8) || delivery.orderId}
                          </span>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dark, #212121)', fontWeight: 500 }}>
                            {delivery.customerName}
                          </p>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-light, #999)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiMapPin size={12} /> {delivery.distance || 'N/A'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary, #757575)', lineHeight: 1.4 }}>
                        {delivery.address || 'Address not available'}
                      </p>
                      <button
                        onClick={() => handleCompleteDelivery(delivery.orderId)}
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <FiCheckCircle size={14} /> Mark Delivered
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Earnings Summary</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#e8f5e9', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary, #555)' }}>Today</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#4caf50' }}>
                    ${(stats.todayDeliveries * (partner?.deliveryCharge || 5)).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#e3f2fd', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary, #555)' }}>This Week</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#2196f3' }}>${stats.weeklyEarnings.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fff3e0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary, #555)' }}>This Month</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#ff9800' }}>${stats.monthlyEarnings.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f3e5f5', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Available Balance</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>${stats.totalEarnings.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Withdraw Funds</h2>
              <form onSubmit={handleWithdraw}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary, #555)', marginBottom: '6px' }}>
                    Amount ($)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FiDollarSign style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light, #999)' }} />
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '12px 12px 12px 36px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-light, #999)' }}>
                    Available: ${stats.totalEarnings.toFixed(2)}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={withdrawing || !withdrawAmount}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: withdrawing || !withdrawAmount ? '#bdbdbd' : 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: withdrawing || !withdrawAmount ? 'not-allowed' : 'pointer',
                  }}
                >
                  {withdrawing ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiMapPin size={20} style={{ color: locationSharing ? '#4caf50' : 'var(--text-light, #999)' }} />
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Location Sharing</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary, #757575)' }}>
                {locationSharing ? 'Your location is being shared for delivery assignments' : 'Enable to receive nearby delivery assignments'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleLocation}
            style={{
              padding: '10px 24px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: locationSharing ? '#4caf50' : '#e0e0e0',
              color: locationSharing ? '#fff' : 'var(--text-secondary, #555)',
              transition: 'all 0.3s ease',
            }}
          >
            {locationSharing ? 'Enabled' : 'Enable'}
          </button>
        </div>
      </main>

      <Footer />

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @media (max-width: 768px) {
            .delivery-dashboard-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default DeliveryPartnerDashboard;
