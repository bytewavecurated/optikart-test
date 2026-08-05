import React from 'react';
import { FiFeather, FiFileText, FiRepeat, FiGlobe, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const EPRCompliance = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>EPR Compliance</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Extended Producer Responsibility compliance and environmental commitments</p>

          <div style={{ marginBottom: '40px' }}>
            <div className="card" style={{ padding: '32px', background: 'var(--success-light)', border: '1px solid var(--success)', textAlign: 'center' }}>
              <FiFeather size={40} style={{ color: 'var(--success)', marginBottom: '12px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Our Environmental Commitment</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
                OptiKart is committed to environmental sustainability and complies with all Extended Producer Responsibility (EPR) regulations under the E-Waste (Management) Rules, 2016 and Plastic Waste Management Rules, 2016.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>EPR Registration Details</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="epr-grid">
                {[
                  { label: 'EPR Registration Number (Plastic)', value: 'EPR-PW-2023-KA-04567' },
                  { label: 'EPR Registration Number (E-Waste)', value: 'EPR-EW-2023-KA-01234' },
                  { label: 'CPCB Registration Valid Until', value: 'March 31, 2027' },
                  { label: 'State Pollution Control Board', value: 'Karnataka State Pollution Control Board' },
                  { label: 'PRO (Producer Responsibility Organization)', value: 'GreenCycle India Pvt. Ltd.' },
                  { label: 'Annual Return Filing Status', value: 'Compliant - FY 2025-26 filed' },
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</p>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Environmental Commitments</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="commitments-grid">
              {[
                { icon: <FiRepeat size={24} />, title: 'Plastic Waste Management', desc: 'We ensure 100% of plastic packaging waste generated through our operations is collected back and recycled. Our packaging uses recycled and recyclable materials wherever possible.' },
                { icon: <FiFeather size={24} />, title: 'Eco-Friendly Packaging', desc: 'We have transitioned to biodegradable and recyclable packaging materials. Our cardboard boxes are made from 80% recycled content and all plastic wraps are being phased out.' },
                { icon: <FiGlobe size={24} />, title: 'Carbon Footprint Reduction', desc: 'We are working towards carbon-neutral delivery by 2028 through route optimization, electric vehicle partnerships, and carbon offset programs.' },
                { icon: <FiCheckCircle size={24} />, title: 'Waste Collection Targets', desc: 'We exceed the annual plastic waste collection targets set by CPCB. In FY 2025-26, we collected and recycled 125% of our target plastic waste volume.' },
              ].map((item, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{item.title}</h3>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Recycling Information</h2>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>OptiKart is committed to responsible waste management. Here's how you can participate in our recycling initiatives:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }} className="recycling-grid">
                  {[
                    { title: 'Return Old Eyewear', desc: 'Drop off your old glasses and frames at any of our partner collection points. We ensure they are properly recycled.' },
                    { title: 'Packaging Return', desc: 'You can return packaging materials to our delivery partner during your next delivery for recycling.' },
                    { title: 'Contact Lens Recycling', desc: 'Used contact lenses and blister packs can be sent back to us through our specialized recycling program.' },
                    { title: 'E-Waste Disposal', desc: 'Electronic components from smart glasses or UV testing devices can be returned for proper e-waste processing.' },
                  ].map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{item.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Compliance Documents</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { name: 'EPR Authorization Letter - Plastic Waste (FY 2025-26)', type: 'PDF' },
                  { name: 'EPR Authorization Letter - E-Waste (FY 2025-26)', type: 'PDF' },
                  { name: 'Annual Return Filing - Plastic Waste Management', type: 'PDF' },
                  { name: 'CPCB Registration Certificate', type: 'PDF' },
                  { name: 'Producer Responsibility Organization Agreement', type: 'PDF' },
                ].map((doc, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FiFileText style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{doc.name}</span>
                    </div>
                    <span className="badge badge-primary">{doc.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '24px', background: 'var(--primary-light)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <FiAlertTriangle style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Contact for EPR Queries</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  For any questions regarding our EPR compliance, recycling programs, or environmental initiatives, please contact:<br />
                  <strong>Email:</strong> sustainability@optikart.com<br />
                  <strong>Phone:</strong> +91 80-4567-8901<br />
                  <strong>Address:</strong> Sustainability Department, OptiKart Technologies Pvt. Ltd., Bangalore - 560038
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .epr-grid { grid-template-columns: 1fr !important; }
          .commitments-grid { grid-template-columns: 1fr !important; }
          .recycling-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default EPRCompliance;
