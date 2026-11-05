import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { deliveryPartner as deliveryApi } from '../../services/api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useAuth } from '../../contexts/AuthContext';
import { FiPackage, FiMapPin, FiDollarSign, FiCheckCircle, FiClock, FiTruck, FiLogOut, FiRefreshCw, FiNavigation, FiCreditCard, FiAlertTriangle } from 'react-icons/fi';
import { toastError } from '../../services/errors.js';

/**
 * One leg of a route. Shows an embedded map only when real coordinates exist,
 * otherwise the address text - a blank map tile is worse than none.
 */
const RouteRow = ({ kind, place }) => {
  const addr = place?.address || place?.name || 'Address pending';
  const hasCoords = Number.isFinite(place?.lat) && Number.isFinite(place?.lng);
  const embed = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${place.lng - 0.01}%2C${place.lat - 0.01}%2C${place.lng + 0.01}%2C${place.lat + 0.01}&layer=mapnik&marker=${place.lat}%2C${place.lng}`
    : null;
  const link = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`
    : null;

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, background: 'var(--bg-white)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: hasCoords ? 8 : 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.05, color: 'var(--text-secondary, #757575)' }}>{kind}</span>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary, #2874f0)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <FiMapPin size={13} /> Open map
          </a>
        )}
      </div>
      {(place?.name && place.name !== place.address) && (
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{place.name}</div>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #757575)', lineHeight: 1.4 }}>{addr}</div>
      {embed ? (
        <iframe
          title={`${kind} location map`}
          src={embed}
          loading="lazy"
          style={{ width: '100%', height: 150, border: '1px solid #eee', borderRadius: 8, marginTop: 8 }}
        />
      ) : (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-light, #999)' }}>
          No pinned location for this address yet.
        </div>
      )}
    </div>
  );
};

const DeliveryPartnerDashboard = () => {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [offers, setOffers] = useState([]);
  const [answering, setAnswering] = useState('');
  const [reporting, setReporting] = useState('');
  const [reportType, setReportType] = useState('customer_unreachable');
  const [reportNote, setReportNote] = useState('');
  const [payoutHistory, setPayoutHistory] = useState({ deliveries: [], withdrawals: [] });
  // /me carries no money, so the summary rows used to print figures the server
  // never sent. These come from /payment/earnings instead.
  const [earnings, setEarnings] = useState({ week: 0, month: 0, totalDeliveries: 0 });
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
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
  const { logout, activeRole, loading: authLoading } = useAuth();

  const fetchDashboardData = useCallback(async () => {
    try {
      const meResponse = await deliveryApi.getMe();
      /*
       * /me answers with the counters on the envelope and the person's own record
       * under `partner`, so reading only one of the two produced "Welcome, Partner"
       * and an availability switch that ignored the stored flag.
       */
      const body = meResponse.data.data || {};
      const partnerData = { ...(body.partner || {}), ...body };
      setPartner(partnerData);
      setIsOnline(partnerData.isOnline === true || partnerData.isAvailable === true);
      setLocationSharing(partnerData.locationSharing || false);

      setStats({
        todayDeliveries: partnerData.todayDeliveries || 0,
        availableBalance: partnerData.availableBalance || 0,
        canWithdrawToday: partnerData.canWithdrawToday !== false,
        totalEarnings: partnerData.totalEarnings || 0,
        pendingDeliveries: partnerData.pendingDeliveries || 0,
        completedToday: partnerData.completedToday || 0,
        weeklyEarnings: partnerData.weeklyEarnings || 0,
        monthlyEarnings: partnerData.monthlyEarnings || 0,
      });

      setActiveDeliveries(partnerData.activeDeliveries || []);

      const offersResponse = await deliveryApi.getOffers();
      setOffers(offersResponse.data.offers || []);

      const [week, month] = await Promise.all([
        deliveryApi.getEarnings('week'),
        deliveryApi.getEarnings('month')
      ]);
      // /payment/earnings answers under a `data` envelope like the rest of this
      // API, so reading the body directly would always have produced zeros.
      const wk = week.data.data || week.data;
      const mt = month.data.data || month.data;
      setPayoutHistory({ deliveries: mt.deliveries || [], withdrawals: body.partner?.withdrawals || body.withdrawals || [] });
      setEarnings({
        week: wk.totalEarnings ?? 0,
        month: mt.totalEarnings ?? 0,
        totalDeliveries: mt.totalDeliveries ?? 0
      });
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('optikart_token');
        localStorage.removeItem('optikart_role');
        navigate('/delivery-partner/login');
        return;
      }
      toastError(error, "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // The stored session is restored asynchronously, so checking the role before
    // that finishes bounced every partner back to the login page.
    if (authLoading) return;
    // Follow the session the server confirmed, not the role string in storage.
    if (activeRole !== 'deliveryPartner') {
      navigate('/delivery-partner/login');
      return;
    }
    fetchDashboardData();
  }, [activeRole, authLoading, fetchDashboardData, navigate]);

  /*
   * Availability is what puts a partner into the recommendation pool, so this
   * switch has to reach the server - it used to only repaint the button, and a
   * partner who believed they were online received no offers. The catch also
   * referenced an `error` binding that does not exist, which threw a second error
   * while handling the first.
   */
  const handleToggleOnline = async () => {
    const newStatus = !isOnline;
    setAvailabilityBusy(true);
    try {
      await deliveryApi.setAvailability(newStatus);
      setIsOnline(newStatus);
      setPartner((p) => ({ ...p, isAvailable: newStatus }));
      toast.success(newStatus ? 'You are online - you will receive nearby runs' : 'You are offline');
    } catch (e) {
      toastError(e, 'Could not change your availability');
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const respondToOffer = async (offer, decision) => {
    setAnswering(offer.orderId);
    try {
      const res = await deliveryApi.respondToOffer(offer.orderId, decision);
      toast.success(res.data.message || (decision === 'accept' ? 'Run accepted' : 'Offer declined'));
      setOffers((list) => list.filter((o) => o.orderId !== offer.orderId));
      if (decision === 'accept') fetchDashboardData();
    } catch (error) {
      toastError(error, 'That offer is no longer available');
      setOffers((list) => list.filter((o) => o.orderId !== offer.orderId));
    } finally {
      setAnswering('');
    }
  };

  /*
   * Drives the offer countdown. The interval only exists while offers are
   * outstanding, so an idle dashboard costs nothing.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!offers.length) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [offers.length]);

  /*
   * A courier needs to say "nobody answered the door" from the doorstep, not
   * phone the office and wait. The note lands on the order's delivery timeline,
   * which the operations desk already reads.
   */
  const REPORT_REASONS = [
    ['customer_unreachable', 'Customer not reachable'],
    ['wrong_address', 'Address did not match'],
    ['refused', 'Parcel refused at the door'],
    ['damaged', 'Parcel damaged'],
    ['other', 'Something else']
  ];

  const submitReport = async (delivery) => {
    setReporting(delivery.orderId);
    try {
      const res = await deliveryApi.reportIssue(delivery.orderId, reportType, reportNote);
      toast.success(res.data.message || 'Reported to the operations desk');
      setReporting('');
      setReportNote('');
      fetchDashboardData();
    } catch (error) {
      toastError(error, 'Could not send the report');
      setReporting('');
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
              toastError(error, "Failed to update location");
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
      toast.success(`Withdrawal of ₹${amount.toFixed(2)} requested successfully`);
      setWithdrawAmount('');
      setStats((prev) => ({ ...prev, totalEarnings: prev.totalEarnings - amount }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    }
    setWithdrawing(false);
  };

  const handleLogout = () => {
    // Clearing only localStorage left the partner object live in context, so the
    // storefront kept showing a signed-in session after logout.
    logout();
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

  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const statCards = [
    { label: "Today's Deliveries", value: stats.todayDeliveries ?? 0, icon: FiTruck },
    { label: 'Total Earned', value: inr(stats.totalEarnings), icon: FiDollarSign },
    { label: 'Available to Withdraw', value: inr(stats.availableBalance), icon: FiCreditCard },
    { label: 'Pending Deliveries', value: stats.pendingDeliveries ?? 0, icon: FiClock }
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
                disabled={availabilityBusy}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-xl)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isOnline ? 'var(--success)' : 'var(--danger)',
                  color: 'var(--text-white)',
                  transition: 'all 0.3s ease',
                }}
              >
                {isOnline ? 'Online' : 'Offline'}
              </button>
            </div>
            <button
              onClick={handleLogout}
              style={{ padding: '8px 16px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
            >
              <FiLogOut size={14} /> Logout
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div className="card" key={idx} style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', background: card.bg, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
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
        <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)', marginBottom: '28px', textAlign: 'center' }}>
          <FiNavigation size={32} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Optimize Your Delivery Route</h3>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary, #757575)' }}>Get AI-powered route suggestions for efficient deliveries</p>
          <button
            onClick={() => navigate('/delivery-partner/route-optimization')}
            className="btn btn-primary"
            style={{
              padding: '12px 32px',
              background: 'var(--primary)',
              color: 'var(--text-white)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
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

        {/*
            Runs offered to this partner. Each card states the pick-up, the drop,
            the distance, what the leg pays and how long is left to answer -
            nobody should have to accept a delivery they have to guess at.
        */}
        {offers.length > 0 && (
          <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', marginBottom: '24px', overflow: 'hidden', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Delivery offers for you</h2>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Answer before the timer runs out or the next partner is asked</span>
            </div>
            <div style={{ display: 'grid', gap: '12px', padding: '16px 24px' }}>
              {offers.map((o) => {
                const msLeft = o.deadline ? new Date(o.deadline).getTime() - now : null;
                const mins = msLeft === null ? null : Math.max(0, Math.floor(msLeft / 60000));
                const secs = msLeft === null ? null : Math.max(0, Math.floor((msLeft % 60000) / 1000));
                const expired = msLeft === 0;
                return (
                  <div key={o.orderId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{o.orderNumber}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Pick up:</span> {o.pickup || 'Store address pending'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drop:</span> {o.drop || 'Address pending'}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, flexWrap: 'wrap' }}>
                          <span>{o.distanceKm != null ? `${o.distanceKm} km to the store` : 'Distance varies'}</span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{inr(o.earning)} for the run</span>
                          {msLeft !== null && !expired && (
                            <span style={{ color: msLeft < 5 * 60000 ? 'var(--danger, #d93025)' : 'var(--text-secondary)' }}>
                              {mins}m {String(secs).padStart(2, '0')}s left
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => respondToOffer(o, 'decline')} disabled={answering === o.orderId} className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 13.5 }}>
                          No thanks
                        </button>
                        <button onClick={() => respondToOffer(o, 'accept')} disabled={answering === o.orderId || expired} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13.5 }}>
                          {answering === o.orderId ? 'Working...' : expired ? 'Offer expired' : 'Accept run'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }} className="delivery-dashboard-grid">
          <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
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
                        borderRadius: 'var(--radius)',
                        background: 'var(--bg-primary, #fafafa)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
                            Order {delivery.orderNumber || `#${String(delivery.orderId || '').slice(-8)}`}
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
                      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                        <RouteRow kind="Pick up" place={delivery.pickup} />
                        <RouteRow kind="Drop" place={delivery.drop} />
                      </div>
                      {/* Two actions on the same run: hand it over, or say why
                          you could not. */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleCompleteDelivery(delivery.orderId)}
                        className="btn btn-primary"
                        style={{
                          flex: '1 1 190px',
                          padding: '10px',
                          background: 'var(--primary)',
                          color: 'var(--text-white)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
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
                      <button
                        onClick={() => setReporting(reporting === delivery.orderId ? '' : delivery.orderId)}
                        className="btn btn-outline"
                        style={{ padding: '8px 12px', fontSize: 13, flex: '0 0 auto' }}
                      >
                        <FiAlertTriangle size={14} /> {reporting === delivery.orderId ? 'Close' : 'Report a problem'}
                      </button>
                      </div>
                    {reporting === delivery.orderId && (
                      <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-secondary, #fafafa)' }}>
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>What happened?</label>
                        <select
                          className="input"
                          value={reportType}
                          onChange={(e) => setReportType(e.target.value)}
                          style={{ width: '100%', marginBottom: 8, padding: '9px 10px', fontSize: 13.5 }}
                        >
                          {REPORT_REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                        </select>
                        <textarea
                          className="input"
                          rows={2}
                          value={reportNote}
                          onChange={(e) => setReportNote(e.target.value.slice(0, 400))}
                          placeholder="Anything the desk should know - door code, second attempt time, who refused"
                          style={{ width: '100%', padding: '9px 10px', fontSize: 13.5, fontFamily: 'inherit', marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Goes on the order timeline for the operations desk.</span>
                          <button
                            onClick={() => submitReport(delivery)}
                            disabled={reporting === `sending:${delivery.orderId}` || (reportType === 'other' && !reportNote.trim())}
                            className="btn btn-primary"
                            style={{ padding: '7px 14px', fontSize: 13 }}
                          >
                            {reportType === 'other' && !reportNote.trim() ? 'Add a note first' : 'Send report'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Earnings Summary</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--success-light)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary, #555)' }}>Completed today</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
                    {stats.completedToday || 0}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--brand-tint)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary, #555)' }}>Last 7 days</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand)' }}>{inr(earnings.week)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--warning-light)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary, #555)' }}>Last 30 days</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--warning)' }}>{inr(earnings.month)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--brand-tint)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Available Balance</span>
                  {/* This printed totalEarnings under the label "Available
                      Balance", so it could never agree with the withdrawal form
                      sitting next to it. */}
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>{inr(stats.availableBalance)}</span>
                </div>
              </div>
            </div>

            {/*
                Earnings a partner can audit: each finished run with its distance
                and payout, then the withdrawals that were paid out. Without this
                the only number available is a total, which cannot be checked
                against a week of work.
            */}
            <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Recent deliveries</h2>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>Last 30 days</p>
              {payoutHistory.deliveries.length === 0 ? (
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>No completed runs in this window yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr>
                        {['Order', 'Delivered', 'Distance', 'Payout'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', padding: '8px 10px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistory.deliveries.slice(0, 15).map((d, i) => (
                        <tr key={d.orderId || i}>
                          <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{d.orderNumber || String(d.orderId || '').slice(-8).toUpperCase()}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>{d.distanceKm ? `${d.distanceKm} km` : '-'}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{inr(d.fee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {payoutHistory.withdrawals.length > 0 && (
                <>
                  <h3 style={{ margin: '18px 0 8px', fontSize: 14.5, fontWeight: 700 }}>Withdrawals</h3>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                    {payoutHistory.withdrawals.slice(0, 8).map((w, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                        <span>{w.at ? new Date(w.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} {w.payoutId ? `· ${w.payoutId}` : ''}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inr(w.netPaid ?? w.amount)} <span style={{ fontWeight: 400 }}>({w.status || 'processed'})</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: 'var(--text-dark, #212121)' }}>Withdraw Funds</h2>
              <form onSubmit={handleWithdraw}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary, #555)', marginBottom: 6 }}>
                    Amount (₹)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FiDollarSign style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light, #999)' }} />
                    <input
                      className="input"
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Minimum ₹50"
                      min="50"
                      step="1"
                      max={Math.floor(stats.availableBalance || 0)}
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-light, #999)', lineHeight: 1.5 }}>
                    Available: ₹{(stats.availableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {' - '}₹3 fee per started ₹50, so ₹{withdrawAmount && Number(withdrawAmount) >= 50
                      ? Math.ceil(Number(withdrawAmount) / 50) * 3
                      : 0}
                    {' would be deducted. One withdrawal per day'}
                    {stats.canWithdrawToday === false ? ', and you have already used today\'s.' : '.'}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={withdrawing || !withdrawAmount || Number(withdrawAmount) < 50 || stats.canWithdrawToday === false}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: withdrawing || !withdrawAmount ? 'var(--border)' : 'var(--primary)',
                    color: 'var(--text-white)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
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

        <div className="card" style={{ background: 'var(--bg-white, #fff)', borderRadius: 'var(--radius)', padding: '20px 24px', boxShadow: 'var(--shadow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiMapPin size={20} style={{ color: locationSharing ? 'var(--success)' : 'var(--text-light, #999)' }} />
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
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: locationSharing ? 'var(--success)' : 'var(--border)',
              color: locationSharing ? 'var(--text-white)' : 'var(--text-secondary, #555)',
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
