import React from 'react';
import { FiRefreshCw, FiCheckCircle, FiXCircle, FiArrowRight, FiClock, FiPackage, FiAlertTriangle } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const conditions = [
  { text: 'Product must be unused and in original condition', valid: true },
  { text: 'Original packaging, boxes, and tags must be intact', valid: true },
  { text: 'All accessories (case, cloth, kit) must be included', valid: true },
  { text: 'Return request within 7 days of delivery', valid: true },
  { text: 'Product with manufacturing defects', valid: true },
  { text: 'Opened contact lens blister packs', valid: false },
  { text: 'Custom prescription eyewear (unless defective)', valid: false },
  { text: 'Products damaged due to misuse after delivery', valid: false },
  { text: 'Return request after 7-day window', valid: false },
];

const returnSteps = [
  { num: '1', title: 'Login to Your Account', desc: 'Access your OptiKart account and go to "My Orders" section.' },
  { num: '2', title: 'Select the Product', desc: 'Find the order containing the product you want to return.' },
  { num: '3', title: 'Click Return/Exchange', desc: 'Click the "Return" or "Exchange" button next to the product.' },
  { num: '4', title: 'Choose Reason', desc: 'Select the reason for return from the dropdown options.' },
  { num: '5', title: 'Select Refund or Exchange', desc: 'Choose whether you want a refund to your original payment method or an exchange.' },
  { num: '6', title: 'Schedule Pickup', desc: 'Our delivery partner will pick up the product from your address within 2-3 days.' },
  { num: '7', title: 'Verification & Refund', desc: 'Once the product is verified at our facility, your refund will be processed.' },
];

const ReturnPolicy = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Return Policy</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Our comprehensive return and exchange policy</p>

          <div style={{ marginBottom: '40px' }}>
            <div className="card" style={{ padding: '32px', background: 'var(--success-light)', border: '1px solid var(--success)', textAlign: 'center' }}>
              <FiRefreshCw size={40} style={{ color: 'var(--success)', marginBottom: '12px' }} />
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>7-Day Easy Returns</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>Not satisfied with your purchase? Return any product within 7 days of delivery for a full refund or exchange. No questions asked.</p>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Return Conditions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="conditions-grid">
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--success)' }}>Eligible for Return</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {conditions.filter(c => c.valid).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiCheckCircle style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--danger)' }}>Not Eligible for Return</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {conditions.filter(c => !c.valid).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiXCircle style={{ color: 'var(--danger)', flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>How to Initiate a Return</h2>
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {returnSteps.map((step) => (
                  <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{step.num}</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>{step.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Refund Process</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>Once we receive and verify your returned product, the refund will be initiated to your original payment method. Here's what to expect:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }} className="refund-methods-grid">
                  {[
                    { method: 'UPI / Wallet', time: '1-2 business days', icon: <FiClock size={16} /> },
                    { method: 'Credit / Debit Card', time: '5-7 business days', icon: <FiClock size={16} /> },
                    { method: 'Net Banking', time: '3-5 business days', icon: <FiClock size={16} /> },
                  ].map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                      <div style={{ color: 'var(--primary)', marginBottom: '8px' }}>{item.icon}</div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{item.method}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 500 }}>{item.time}</p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '16px', background: 'var(--warning-light)', borderRadius: 'var(--radius)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <FiAlertTriangle style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Note:</strong> For COD orders, refund will be processed via UPI to the phone number registered with your account, or via bank transfer if you provide your account details.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Exchange Policy</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>Want a different frame or size instead of a refund? Here's how exchanges work:</p>
                <ul style={{ paddingLeft: '20px', listStyle: 'disc', lineHeight: 2.2 }}>
                  <li>Select "Exchange" instead of "Refund" during the return process.</li>
                  <li>Choose the new product you'd like (same or different frame/lens).</li>
                  <li>If the new product costs more, you'll pay the difference. If less, the balance is refunded.</li>
                  <li>The exchanged product ships once we receive and verify the original product.</li>
                  <li>Exchange is subject to product availability.</li>
                  <li>Only one exchange is allowed per product.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .conditions-grid { grid-template-columns: 1fr !important; }
          .refund-methods-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default ReturnPolicy;
