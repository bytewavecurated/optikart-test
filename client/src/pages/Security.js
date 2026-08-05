import React from 'react';
import { FiLock, FiShield, FiServer, FiCheckCircle, FiEye, FiCreditCard, FiKey } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const securityFeatures = [
  { icon: <FiLock size={24} />, title: '256-bit SSL Encryption', desc: 'All data transmitted between your browser and our servers is encrypted using 256-bit SSL/TLS encryption, the same standard used by banks and financial institutions.' },
  { icon: <FiShield size={24} />, title: 'PCI-DSS Level 1 Compliance', desc: 'Our payment processing meets the highest level of PCI Data Security Standards, ensuring your card information is handled with maximum security.' },
  { icon: <FiKey size={24} />, title: 'Two-Factor Authentication', desc: 'All online payments require OTP verification or biometric authentication, adding an extra layer of security to every transaction.' },
  { icon: <FiServer size={24} />, title: 'Secure Infrastructure', desc: 'Our servers are hosted in ISO 27001 certified data centers with 24/7 monitoring, firewall protection, and regular security audits.' },
  { icon: <FiEye size={24} />, title: 'Fraud Detection System', desc: 'AI-powered fraud detection monitors all transactions in real-time to identify and prevent suspicious activities before they occur.' },
  { icon: <FiCreditCard size={24} />, title: 'Tokenized Payments', desc: 'We never store your actual card numbers. All payment data is tokenized through our PCI-compliant payment gateway Razorpay.' },
];

const Security = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Security</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>How we protect your data and ensure safe transactions</p>

          <div style={{ marginBottom: '40px' }}>
            <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'var(--primary-light)' }}>
              <FiShield size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>Your Security is Our Priority</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
                At OptiKart, we employ industry-leading security measures to protect your personal information, financial data, and privacy. We continuously invest in security infrastructure to keep your data safe.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Data Protection Measures</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="security-grid">
              {securityFeatures.map((feature, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>{feature.icon}</div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{feature.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Secure Payment Processing</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>All payments on OptiKart are processed through <strong>Razorpay</strong>, one of India's most trusted payment gateways. Here's how we ensure payment security:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }} className="payment-security-grid">
                  {[
                    'Card details are never stored on our servers',
                    'All transactions use HTTPS with TLS 1.3 encryption',
                    '3D Secure authentication for card payments',
                    'Real-time fraud monitoring and prevention',
                    'Automatic session timeout after inactivity',
                    'Regular third-party security audits and penetration testing',
                    'Compliance with RBI payment data storage guidelines',
                    'End-to-end encryption for UPI and net banking transactions',
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                      <FiCheckCircle style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Privacy Practices Overview</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>We are committed to protecting your privacy. Here are our key privacy practices:</p>
                <ul style={{ paddingLeft: '20px', listStyle: 'disc', lineHeight: 2.2 }}>
                  <li>We collect only the data necessary to provide our services.</li>
                  <li>Your personal data is never sold to third parties.</li>
                  <li>Data is stored in encrypted databases with restricted access.</li>
                  <li>We use cookies only for essential functionality and analytics.</li>
                  <li>You can request data deletion at any time by contacting our privacy team.</li>
                  <li>We comply with the IT Act 2000 and the upcoming DPDP Act 2023.</li>
                </ul>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>How We Protect Your Data</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="protection-grid">
                {[
                  { title: 'Access Control', desc: 'Role-based access ensures only authorized personnel can access sensitive data, with all access logged and audited.' },
                  { title: 'Data Encryption', desc: 'All data at rest is encrypted using AES-256 encryption. Data in transit is protected with TLS 1.3.' },
                  { title: 'Regular Backups', desc: 'Automated daily backups with geo-redundant storage ensure your data is never lost.' },
                  { title: 'Incident Response', desc: '24/7 security monitoring with a dedicated incident response team ready to address any threats.' },
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: '20px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
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
          .security-grid { grid-template-columns: 1fr !important; }
          .payment-security-grid { grid-template-columns: 1fr !important; }
          .protection-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Security;
