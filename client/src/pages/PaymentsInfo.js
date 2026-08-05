import React from 'react';
import { FiCreditCard, FiSmartphone, FiLock, FiCheckCircle, FiDollarSign, FiShield, FiHelpCircle } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const paymentMethods = [
  { icon: <FiCreditCard size={24} />, title: 'Credit / Debit Cards', desc: 'Visa, Mastercard, RuPay, American Express accepted. All cards are processed through secure PCI-DSS compliant gateways.', methods: ['Visa', 'Mastercard', 'RuPay', 'Amex'] },
  { icon: <FiSmartphone size={24} />, title: 'UPI', desc: 'Pay instantly using any UPI app including Google Pay, PhonePe, Paytm, and BHIM UPI.', methods: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM'] },
  { icon: <FiDollarSign size={24} />, title: 'Net Banking', desc: 'Direct bank transfer from all major Indian banks with real-time confirmation.', methods: ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Yes Bank'] },
  { icon: <FiLock size={24} />, title: 'Wallets', desc: 'Pay using popular digital wallets for quick and convenient checkout.', methods: ['Paytm Wallet', 'Amazon Pay', 'Mobikwik', 'FreeCharge'] },
  { icon: <FiCheckCircle size={24} />, title: 'Cash on Delivery', desc: 'Pay in cash when your order is delivered. Available for orders up to INR 10,000.', methods: ['COD'] },
  { icon: <FiCreditCard size={24} />, title: 'EMI Options', desc: 'Convert your purchase into easy monthly installments with no-cost EMI options available.', methods: ['No Cost EMI', 'Standard EMI'] },
];

const steps = [
  { num: '1', title: 'Add to Cart', desc: 'Browse and add your favorite eyewear to the cart.' },
  { num: '2', title: 'Proceed to Checkout', desc: 'Review your order and enter delivery details.' },
  { num: '3', title: 'Choose Payment Method', desc: 'Select from cards, UPI, net banking, wallets, or COD.' },
  { num: '4', title: 'Complete Payment', desc: 'Enter payment details and confirm your order.' },
  { num: '5', title: 'Order Confirmed', desc: 'Receive order confirmation via email and SMS.' },
];

const faqs = [
  { q: 'Is it safe to use my credit/debit card on OptiKart?', a: 'Yes. All card transactions are processed through Razorpay, a PCI-DSS Level 1 certified payment gateway. Your card details are encrypted using 256-bit SSL encryption and are never stored on our servers.' },
  { q: 'What is the Razorpay payment gateway?', a: 'Razorpay is India\'s leading payment gateway that processes payments securely for millions of transactions daily. It supports all major payment methods and is trusted by top e-commerce platforms.' },
  { q: 'What happens if my payment fails?', a: 'If your payment fails, the amount will be refunded to your source account within 5-7 business days. You can retry the payment or choose a different payment method.' },
  { q: 'Can I pay in installments (EMI)?', a: 'Yes, we offer no-cost EMI on select credit cards and standard EMI options on most cards. EMI options are displayed at checkout for eligible orders above INR 3,000.' },
  { q: 'Is Cash on Delivery available for all products?', a: 'COD is available for most products with order values up to INR 10,000. Some premium products and custom prescription orders may require advance payment.' },
  { q: 'Do you accept international cards?', a: 'Currently, we accept Visa and Mastercard international cards. However, the billing address must be in India. We plan to expand international payment options soon.' },
];

const PaymentsInfo = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Payment Information</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Everything you need to know about payments on OptiKart</p>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Accepted Payment Methods</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="payment-grid">
              {paymentMethods.map((method, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{method.icon}</div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{method.title}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>{method.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {method.methods.map((m) => (
                      <span key={m} className="badge badge-primary">{m}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>How Payment Works</h2>
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {steps.map((step) => (
                  <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{step.num}</div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>{step.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Payment Security</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="security-grid">
                {[
                  { icon: <FiLock size={20} />, title: '256-bit SSL Encryption', desc: 'All data transmitted between your browser and our servers is encrypted with industry-standard SSL.' },
                  { icon: <FiShield size={20} />, title: 'PCI-DSS Compliant', desc: 'Our payment processor meets the highest security standards set by the Payment Card Industry.' },
                  { icon: <FiSmartphone size={20} />, title: 'Two-Factor Authentication', desc: 'All UPI and card payments require OTP or biometric verification for added security.' },
                  { icon: <FiCheckCircle size={20} />, title: 'Razorpay Secured', desc: 'Payments processed through Razorpay, trusted by 50M+ merchants across India.' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{item.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}><FiHelpCircle style={{ verticalAlign: 'middle', marginRight: '8px' }} />Transaction FAQs</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {faqs.map((faq, idx) => (
                <div key={idx} className="card" style={{ padding: '20px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{faq.q}</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .payment-grid { grid-template-columns: 1fr !important; }
          .security-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default PaymentsInfo;
