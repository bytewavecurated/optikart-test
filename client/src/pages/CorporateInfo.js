import React from 'react';
import { FiMapPin, FiGlobe, FiUsers, FiShield, FiFileText, FiBriefcase } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const leadership = [
  { name: 'Arjun Mehta', title: 'Chief Executive Officer & Co-Founder', bio: 'IIT Bombay alumnus with 15+ years in retail technology. Previously VP of Engineering at LensKart.' },
  { name: 'Priya Sharma', title: 'Chief Technology Officer & Co-Founder', bio: 'Ex-Google engineer. Expert in scalable e-commerce systems and AI/ML applications.' },
  { name: 'Rahul Verma', title: 'Chief Product Officer', bio: '10+ years in product management. Former Head of Product at Myntra.' },
  { name: 'Kavita Nair', title: 'Chief Financial Officer', bio: 'CA with 12+ years in finance. Previously CFO at a leading D2C brand.' },
  { name: 'Vikram Singh', title: 'Chief Operating Officer', bio: 'Supply chain expert. Built logistics networks at Delhivery and Flipkart.' },
  { name: 'Sneha Patel', title: 'Chief Marketing Officer', bio: 'Brand strategist with experience at Amazon India and Swiggy.' },
];

const offices = [
  { city: 'Bangalore (Headquarters)', address: 'OptiKart Technologies Pvt. Ltd., 4th Floor, Prestige Tower, 100 Feet Road, Indiranagar, Bangalore - 560038, Karnataka', phone: '+91 80-4567-8900' },
  { city: 'Mumbai (Regional Office)', address: 'OptiKart Technologies Pvt. Ltd., 12th Floor, Nariman Bhavan, Nariman Point, Mumbai - 400021, Maharashtra', phone: '+91 22-4567-8900' },
  { city: 'Delhi NCR (Regional Office)', address: 'OptiKart Technologies Pvt. Ltd., 8th Floor, Cyber City Tower, Sector 24, Gurugram - 122002, Haryana', phone: '+91 124-456-7890' },
];

const CorporateInfo = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Corporate Information</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Official company details, leadership, and governance information</p>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Company Registration Details</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="reg-grid">
                {[
                  { label: 'Company Name', value: 'OptiKart Technologies Private Limited' },
                  { label: 'CIN', value: 'U72200KA2020PTC134567' },
                  { label: 'GSTIN', value: '29AABCO1234A1Z5' },
                  { label: 'PAN', value: 'AABCO1234A' },
                  { label: 'Incorporation Date', value: 'March 15, 2020' },
                  { label: 'Registered Office', value: 'Bangalore, Karnataka, India' },
                  { label: 'Authorized Capital', value: 'INR 10,00,00,000' },
                  { label: 'Paid-up Capital', value: 'INR 5,25,00,000' },
                  { label: 'ROC', value: 'ROC Bangalore' },
                  { label: 'Industry Classification', value: 'E-Commerce / Retail Eyewear' },
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</p>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Leadership Team</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="leader-grid">
              {leadership.map((person, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                      {person.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600 }}>{person.name}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>{person.title}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{person.bio}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Office Locations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="office-grid">
              {offices.map((office, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <FiMapPin style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: 600 }}>{office.city}</h4>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>{office.address}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Phone: {office.phone}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Corporate Governance</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { icon: <FiShield size={20} />, title: 'Board of Directors', desc: 'Our board comprises 5 directors including 2 independent directors, ensuring balanced governance and strategic oversight.' },
                  { icon: <FiFileText size={20} />, title: 'Audit Committee', desc: 'Committed to financial transparency with quarterly audits by M/s. Deloitte Haskins & Sells, a Big Four accounting firm.' },
                  { icon: <FiUsers size={20} />, title: 'Nomination & Remuneration Committee', desc: 'Ensures fair compensation practices and identifies suitable board candidates aligned with company values.' },
                  { icon: <FiGlobe size={20} />, title: 'CSR Committee', desc: 'Oversees corporate social responsibility initiatives focused on eye health awareness and education in underserved communities.' },
                  { icon: <FiBriefcase size={20} />, title: 'Compliance & Ethics', desc: 'We maintain strict adherence to all regulatory requirements including the Companies Act 2013, SEBI guidelines, and IT Act 2000.' },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{item.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
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
          .reg-grid { grid-template-columns: 1fr !important; }
          .leader-grid { grid-template-columns: 1fr !important; }
          .office-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default CorporateInfo;
