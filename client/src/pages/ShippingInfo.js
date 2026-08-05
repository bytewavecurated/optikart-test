import React from 'react';
import { FiTruck, FiMapPin, FiClock, FiPackage, FiCheckCircle, FiInfo } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const timelines = [
  { region: 'Metro Cities', cities: 'Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad', delivery: '2-4 business days', icon: '🏙️' },
  { region: 'Tier-2 Cities', cities: 'Jaipur, Lucknow, Chandigarh, Pune, Ahmedabad, Coimbatore', delivery: '4-6 business days', icon: '🏘️' },
  { region: 'Tier-3 Cities & Towns', cities: 'All other cities and towns across India', delivery: '6-8 business days', icon: '🏡' },
  { region: 'Remote / North-East', cities: 'North-East states, J&K, Ladakh, and remote areas', delivery: '8-12 business days', icon: '🏔️' },
];

const shippingPartners = [
  { name: 'Shiprocket', desc: 'Primary logistics partner handling pan-India delivery with real-time tracking.', coverage: '29,000+ pin codes across India' },
  { name: 'Delhivery', desc: 'Express delivery partner for metro cities with same-day and next-day options.', coverage: '18,000+ pin codes' },
  { name: 'Blue Dart', desc: 'Premium delivery partner for high-value and fragile eyewear shipments.', coverage: '35,000+ pin codes' },
];

const ShippingInfo = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Shipping Information</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Delivery details, shipping charges, and tracking information</p>

          <div style={{ marginBottom: '40px' }}>
            <div className="card" style={{ padding: '24px', background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <FiInfo style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Shipping Charges</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '8px' }}>
                    OptiKart charges a flat <strong>INR 16 platform fee</strong> on all orders. Additionally, standard Shiprocket delivery charges apply based on the weight and destination of your order.
                  </p>
                  <ul style={{ paddingLeft: '20px', listStyle: 'disc', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 2 }}>
                    <li>Platform handling fee: <strong>INR 16</strong> (flat, on all orders)</li>
                    <li>Shiprocket delivery charges: <strong>INR 40 - 120</strong> (based on weight & destination)</li>
                    <li>Orders above <strong>INR 999</strong>: Free delivery (platform fee of INR 16 still applies)</li>
                    <li>Express delivery (metro cities): Additional <strong>INR 50</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Shipping Partners</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="partners-grid">
              {shippingPartners.map((partner, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FiTruck size={20} /></div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{partner.name}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>{partner.desc}</p>
                  <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>Coverage: {partner.coverage}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Delivery Timelines</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {timelines.map((item, idx) => (
                <div key={idx} className="card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '32px' }}>{item.icon}</span>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{item.region}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{item.cities}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--success-light)', borderRadius: 'var(--radius)', color: 'var(--success)', fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>
                    <FiClock size={14} /> {item.delivery}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Order Tracking</h2>
            <div className="card" style={{ padding: '24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>
                Once your order is shipped, you'll receive a tracking ID via email and SMS. You can track your order in real-time through the following methods:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="tracking-grid">
                {[
                  { icon: <FiPackage size={20} />, title: 'My Orders Page', desc: 'Track all your orders from your OptiKart account dashboard.' },
                  { icon: <FiMapPin size={20} />, title: 'Tracking Link', desc: 'Click the tracking link in your shipping confirmation email.' },
                  { icon: <FiCheckCircle size={20} />, title: 'SMS Updates', desc: 'Receive automatic SMS updates at each delivery milestone.' },
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--primary)', marginBottom: '8px' }}>{item.icon}</div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{item.title}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Important Shipping Notes</h2>
            <ul style={{ paddingLeft: '20px', listStyle: 'disc', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 2.2 }}>
              <li>Orders placed before 2:00 PM are processed the same day (Mon-Sat).</li>
              <li>Custom prescription orders may take an additional 2-3 days for lens fitting.</li>
              <li>Delivery timelines are estimates and may vary during festivals or sales.</li>
              <li>We deliver to all 29 states and 8 union territories of India.</li>
              <li>For bulk orders (10+ items), please contact us for special shipping arrangements.</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .partners-grid { grid-template-columns: 1fr !important; }
          .tracking-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default ShippingInfo;
