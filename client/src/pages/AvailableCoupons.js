import React, { useState, useEffect } from 'react';
import { FiTag, FiCopy, FiCheck } from 'react-icons/fi';
import { coupons } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const AvailableCoupons = () => {
  const [couponList, setcouponList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await coupons.getAll();
        setcouponList(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCoupons();
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Coupon code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Available Coupons</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>Save more with these exclusive offers</p>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card skeleton" style={{ height: '150px' }} />
              ))}
            </div>
          ) : couponList.length === 0 ? (
            <div className="empty-state">
              <FiTag style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>No coupons available</h3>
              <p>Check back later for new offers</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {couponList.map((coupon) => (
                <div key={coupon._id} className="card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                        {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{coupon.description || 'Special offer'}</div>
                    </div>
                    <FiTag size={24} style={{ color: 'var(--primary)', opacity: 0.3 }} />
                  </div>
                  {coupon.minOrder && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Min. order: ₹{coupon.minOrder}</div>
                  )}
                  {coupon.maxDiscount && coupon.type === 'percentage' && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Max discount: ₹{coupon.maxDiscount}</div>
                  )}
                  {coupon.validUntil && (
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '12px' }}>Valid till: {new Date(coupon.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  )}
                  <button onClick={() => handleCopy(coupon.code)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-primary)', borderRadius: '4px', border: '1px dashed var(--primary)', fontSize: '14px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                    {copiedCode === coupon.code ? <><FiCheck size={14} /> Copied!</> : <><FiCopy size={14} /> {coupon.code}</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AvailableCoupons;
