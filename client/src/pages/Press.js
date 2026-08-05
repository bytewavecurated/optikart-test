import React from 'react';
import { FiCalendar, FiExternalLink, FiMail, FiPhone, FiDownload, FiStar } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const pressReleases = [
  { date: 'June 15, 2026', title: 'OptiKart Crosses 2 Million Customer Milestone', desc: 'OptiKart announces reaching the 2 million registered customer mark, cementing its position as India\'s leading online eyewear platform.', tag: 'Milestone' },
  { date: 'May 2, 2026', title: 'OptiKart Launches AI-Powered Virtual Try-On 2.0', desc: 'New virtual try-on technology uses advanced facial mapping for hyper-realistic previews of eyewear frames.', tag: 'Product' },
  { date: 'March 20, 2026', title: 'OptiKart Partners with Ray-Ban for Exclusive Online Collection', desc: 'Strategic partnership brings exclusive Ray-Ban frames to OptiKart customers with special launch pricing.', tag: 'Partnership' },
  { date: 'January 10, 2026', title: 'OptiKart Raises INR 150 Crore in Series B Funding', desc: 'Funding led by Sequoia Capital India will accelerate technology development and expand delivery network.', tag: 'Funding' },
  { date: 'November 5, 2025', title: 'OptiKart Expands to Tier-2 and Tier-3 Cities', desc: 'New logistics partnerships enable same-week delivery to over 500 additional cities across India.', tag: 'Expansion' },
  { date: 'August 18, 2025', title: 'OptiKart Wins Best E-Commerce Startup at India Retail Awards', desc: 'Recognized for innovation in eyewear retail, customer experience, and technology-driven approach.', tag: 'Award' },
];

const mediaCoverage = [
  { outlet: 'Economic Times', title: 'How OptiKart is Disrupting the INR 30,000 Crore Indian Eyewear Market', url: '#' },
  { outlet: 'YourStory', title: 'From Garage to 2M Users: The OptiKart Journey', url: '#' },
  { outlet: 'Inc42', title: 'OptiKart\'s Virtual Try-On is Changing How India Buys Glasses', url: '#' },
  { outlet: 'Mint', title: 'Why Investors Are Betting Big on Online Eyewear', url: '#' },
  { outlet: 'TechCrunch', title: 'Indian Eyewear Startup OptiKart Brings AI to Glasses Shopping', url: '#' },
];

const Press = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ background: 'var(--primary)', borderRadius: 'var(--radius-lg)', padding: '48px 32px', textAlign: 'center', marginBottom: '32px', color: '#fff' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>Press & Media</h1>
            <p style={{ fontSize: '16px', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>Latest news, media coverage, and brand resources for journalists and partners.</p>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Press Releases</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pressReleases.map((release, idx) => (
                <div key={idx} className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-light)' }}><FiCalendar size={14} /> {release.date}</span>
                        <span className="badge badge-primary">{release.tag}</span>
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>{release.title}</h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{release.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Media Coverage</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }} className="media-grid">
              {mediaCoverage.map((item, idx) => (
                <div key={idx} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>{item.outlet}</p>
                    <h4 style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.5 }}>{item.title}</h4>
                  </div>
                  <FiExternalLink style={{ color: 'var(--text-light)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Brand Assets</h2>
            <div className="card" style={{ padding: '32px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.7 }}>Access official OptiKart resources for editorial use. Please follow our brand guidelines when using our assets. For high-resolution logos or specific imagery, contact our press team.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="assets-grid">
                {[
                  { icon: <FiStar size={24} />, title: 'Company Fact Sheet', desc: 'Key milestones, team size, and company overview' },
                  { icon: <FiDownload size={24} />, title: 'Brand Guidelines', desc: 'Typography, colors, and logo usage rules' },
                  { icon: <FiCalendar size={24} />, title: 'Media Kit', desc: 'Press release templates and event information' },
                ].map((asset, idx) => (
                  <div key={idx} style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>{asset.icon}</div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{asset.title}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '12px' }}>{asset.desc}</p>
                    <button className="btn btn-outline btn-sm"><FiDownload size={14} /> Download</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '32px', background: 'var(--primary-light)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>Press Contact</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiMail style={{ color: 'var(--primary)' }} />
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>Email</p>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>press@optikart.com</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiPhone style={{ color: 'var(--primary)' }} />
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>Phone</p>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>+91 80-1234-5678</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .media-grid { grid-template-columns: 1fr !important; }
          .assets-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Press;
