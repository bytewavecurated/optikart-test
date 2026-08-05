import React, { useState } from 'react';
import { FiAlertTriangle, FiSend, FiFileText, FiLink, FiMail, FiUser } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const infringementTypes = [
  'Copyright Infringement',
  'Trademark Infringement',
  'Patent Infringement',
  'Counterfeit Product',
  'Design Infringement',
  'Other IP Violation',
];

const guidelines = [
  { title: 'Copyright Infringement', desc: 'Unauthorized use of copyrighted images, product descriptions, or content belonging to another party.' },
  { title: 'Trademark Infringement', desc: 'Use of registered brand names, logos, or trademarks without authorization from the trademark owner.' },
  { title: 'Counterfeit Products', desc: 'Selling or listing products that imitate branded products with the intent to deceive consumers.' },
  { title: 'Patent Infringement', desc: 'Use of patented technology, designs, or processes without permission from the patent holder.' },
];

const ReportInfringement = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: '',
    brand: '',
    description: '',
    urls: '',
    evidence: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    window.location.href = `mailto:ip@optikart.com?subject=IP Infringement Report - ${formData.type}&body=Name: ${formData.name}%0AEmail: ${formData.email}%0AType: ${formData.type}%0ADescription: ${formData.description}%0AURLs: ${formData.urls}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Report IP Infringement</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Use this form to report intellectual property violations on OptiKart</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="report-grid">
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>What Constitutes Infringement?</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {guidelines.map((item, idx) => (
                    <div key={idx} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <FiAlertTriangle style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{item.title}</h4>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: '20px', background: 'var(--primary-light)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Need Help?</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>If you're unsure whether your case qualifies as IP infringement, contact our legal team for guidance.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiMail size={14} style={{ color: 'var(--primary)' }} /> ip@optikart.com</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiFileText size={14} style={{ color: 'var(--primary)' }} /> Include supporting documents for faster resolution</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Report Form</h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="input-group">
                  <label><FiUser style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Full Name *</label>
                  <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your full name" required />
                </div>
                <div className="input-group">
                  <label><FiMail style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Email Address *</label>
                  <input className="input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" required />
                </div>
                <div className="input-group">
                  <label>Phone Number</label>
                  <input className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" />
                </div>
                <div className="input-group">
                  <label>Type of Infringement *</label>
                  <select className="input" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} required>
                    <option value="">Select type...</option>
                    {infringementTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Brand / IP Owner Name</label>
                  <input className="input" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="Name of the brand or IP owner" />
                </div>
                <div className="input-group">
                  <label><FiLink style={{ verticalAlign: 'middle', marginRight: '4px' }} /> URLs of Infringing Content *</label>
                  <textarea className="input" rows={3} value={formData.urls} onChange={(e) => setFormData({ ...formData, urls: e.target.value })} placeholder="Paste the URLs of the infringing product pages or content (one per line)" required />
                </div>
                <div className="input-group">
                  <label>Description *</label>
                  <textarea className="input" rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Provide detailed information about the infringement, including registration numbers if applicable" required />
                </div>
                <div className="input-group">
                  <label>Supporting Evidence</label>
                  <textarea className="input" rows={3} value={formData.evidence} onChange={(e) => setFormData({ ...formData, evidence: e.target.value })} placeholder="Describe any supporting evidence you can provide (registration certificates, original product links, etc.)" />
                </div>
                <button type="submit" className="btn btn-primary btn-lg btn-block"><FiSend /> Submit Report</button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .report-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default ReportInfringement;
