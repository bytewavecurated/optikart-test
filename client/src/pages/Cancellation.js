import React from 'react';
import { FiXCircle, FiRefreshCw, FiClock, FiAlertTriangle, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const cancelSteps = [
  { num: '1', title: 'Go to My Orders', desc: 'Log in to your OptiKart account and navigate to the "My Orders" section.' },
  { num: '2', title: 'Select the Order', desc: 'Find the order you wish to cancel and click on "View Details".' },
  { num: '3', title: 'Click Cancel Order', desc: 'Click the "Cancel Order" button. If the order hasn\'t shipped yet, cancellation is instant.' },
  { num: '4', title: 'Choose Reason', desc: 'Select a reason for cancellation from the dropdown menu.' },
  { num: '5', title: 'Confirm Cancellation', desc: 'Confirm your cancellation. You will receive a confirmation email and SMS.' },
];

const refundTimeline = [
  { method: 'UPI', time: '1-2 business days' },
  { method: 'Credit Card', time: '5-7 business days' },
  { method: 'Debit Card', time: '5-7 business days' },
  { method: 'Net Banking', time: '3-5 business days' },
  { method: 'Wallet', time: 'Instant to 24 hours' },
  { method: 'COD (Refund via UPI/Bank)', time: '3-5 business days' },
];

const Cancellation = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Cancellation & Returns</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Our cancellation policy, return process, and refund details</p>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Cancellation Policy</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>You can cancel your order at any time before it is shipped. Once the order has been dispatched, cancellation is not possible, but you can initiate a return after delivery.</p>
                <div style={{ padding: '16px', background: 'var(--warning-light)', borderRadius: 'var(--radius)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <FiAlertTriangle style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Important:</strong> Custom prescription eyewear and personalized products cannot be cancelled once processing has begun. Please verify your prescription details before placing such orders.
                  </div>
                </div>
                <ul style={{ paddingLeft: '20px', listStyle: 'disc', lineHeight: 2 }}>
                  <li>Orders can be cancelled within 2 hours of placement for instant processing.</li>
                  <li>If the order is already in "Processing" status, cancellation may take up to 24 hours.</li>
                  <li>Once the order status changes to "Shipped", it cannot be cancelled.</li>
                  <li>Full refund will be initiated to the original payment method.</li>
                  <li>COD orders can be cancelled anytime before dispatch without any charges.</li>
                </ul>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>How to Cancel an Order</h2>
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {cancelSteps.map((step) => (
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
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Refund Timeline</h2>
            <div className="card" style={{ padding: '24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.7 }}>Refunds are processed to the original payment method within the following timelines:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }} className="refund-grid">
                {refundTimeline.map((item, idx) => (
                  <div key={idx} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.method}</span>
                    <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><FiClock size={12} /> {item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Return Policy</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '16px', background: 'var(--success-light)', borderRadius: 'var(--radius)' }}>
                  <FiCheckCircle style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>7-Day Easy Returns</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Return any product within 7 days of delivery for a full refund or exchange. The product must be unused, in original packaging, with all tags intact.</p>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Return Process:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      'Log in to your account and go to "My Orders"',
                      'Select the order and click "Return/Exchange"',
                      'Choose your preferred reason for return',
                      'Select refund or exchange option',
                      'Our delivery partner will pick up the product from your address',
                      'Once verified, refund will be processed to your original payment method',
                    ].map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiArrowRight style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Non-Returnable Items</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                {[
                  'Custom prescription eyewear (unless defective or wrong prescription)',
                  'Contact lenses (once the blister pack is opened)',
                  'Products with broken seals or missing original packaging',
                  'Products damaged due to misuse after delivery',
                  'Items returned after the 7-day return window',
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiXCircle style={{ color: 'var(--danger)', flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .refund-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Cancellation;
