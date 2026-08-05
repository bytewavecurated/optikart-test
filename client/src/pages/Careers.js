import React from 'react';
import { FiBriefcase, FiMapPin, FiClock, FiMail, FiHeart, FiZap, FiUsers, FiAward, FiCoffee, FiTrendingUp } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const openings = [
  { title: 'Senior Software Engineer', dept: 'Engineering', location: 'Bangalore', type: 'Full-time', experience: '3-5 years', desc: 'Build and scale our e-commerce platform using React, Node.js, and cloud technologies.' },
  { title: 'Product Manager', dept: 'Product', location: 'Bangalore', type: 'Full-time', experience: '4-6 years', desc: 'Drive product strategy and roadmap for our consumer-facing eyewear platform.' },
  { title: 'Marketing Lead', dept: 'Marketing', location: 'Mumbai', type: 'Full-time', experience: '5-7 years', desc: 'Lead brand marketing, digital campaigns, and growth initiatives across channels.' },
  { title: 'Customer Support Executive', dept: 'Support', location: 'Remote', type: 'Full-time', experience: '1-3 years', desc: 'Deliver exceptional customer experiences through chat, email, and phone support.' },
  { title: 'UI/UX Designer', dept: 'Design', location: 'Bangalore', type: 'Full-time', experience: '2-4 years', desc: 'Create intuitive and beautiful user experiences for our web and mobile platforms.' },
  { title: 'Data Analyst', dept: 'Analytics', location: 'Bangalore', type: 'Full-time', experience: '2-3 years', desc: 'Analyze business data to drive decisions on product, marketing, and operations.' },
  { title: 'Supply Chain Manager', dept: 'Operations', location: 'Delhi', type: 'Full-time', experience: '4-6 years', desc: 'Optimize our logistics and delivery network for faster, more reliable shipping.' },
  { title: 'Content Writer', dept: 'Marketing', location: 'Remote', type: 'Part-time', experience: '1-2 years', desc: 'Create engaging content for blogs, social media, and product descriptions.' },
];

const culture = [
  { icon: <FiZap size={24} />, title: 'Move Fast', desc: 'We ship quickly, iterate often, and embrace change as a constant.' },
  { icon: <FiUsers size={24} />, title: 'Customer First', desc: 'Every decision we make starts with how it impacts our customers.' },
  { icon: <FiHeart size={24} />, title: 'Empathy & Respect', desc: 'We foster an inclusive environment where every voice is heard and valued.' },
  { icon: <FiAward size={24} />, title: 'Excellence', desc: 'We hold ourselves to the highest standards in everything we do.' },
  { icon: <FiCoffee size={24} />, title: 'Work-Life Balance', desc: 'We believe rested, happy teams build better products.' },
  { icon: <FiTrendingUp size={24} />, title: 'Continuous Learning', desc: 'We invest in your growth with learning budgets and mentorship programs.' },
];

const benefits = [
  'Competitive salary with annual performance bonuses',
  'Comprehensive health insurance for you and your family',
  'Flexible working hours and remote work options',
  'Generous paid time off and holidays',
  'Learning & development budget of INR 50,000/year',
  'Stock options for early employees',
  'Free eyewear for you and discounts for family',
  'Team offsites and quarterly outings',
  'Top-of-the-line equipment and ergonomic setup',
  'Parental leave policy with 26 weeks for primary caregivers',
];

const Careers = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ background: 'var(--primary)', borderRadius: 'var(--radius-lg)', padding: '48px 32px', textAlign: 'center', marginBottom: '32px', color: '#fff' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>Join the OptiKart Team</h1>
            <p style={{ fontSize: '16px', opacity: 0.9, maxWidth: '600px', margin: '0 auto 20px' }}>Help us revolutionize how India buys eyewear. We're looking for passionate people who want to make a difference.</p>
            <a href="mailto:careers@optikart.com" className="btn btn-secondary btn-lg">View Open Positions</a>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Current Openings</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>We have {openings.length} open positions across multiple departments</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {openings.map((job, idx) => (
                <div key={idx} className="card job-card" style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>{job.title}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-light)' }}><FiBriefcase size={14} /> {job.dept}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-light)' }}><FiMapPin size={14} /> {job.location}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-light)' }}><FiClock size={14} /> {job.type}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Exp: {job.experience}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{job.desc}</p>
                  </div>
                  <a href={`mailto:careers@optikart.com?subject=Application for ${job.title}`} className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>Apply Now</a>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>Our Culture</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="culture-grid">
              {culture.map((item, idx) => (
                <div key={idx} className="card" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{item.icon}</div>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>Benefits & Perks</h2>
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }} className="benefits-grid">
                {benefits.map((benefit, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', fontWeight: 700 }}>✓</div>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'var(--primary-light)', marginBottom: '32px' }}>
            <FiMail size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Ready to Join Us?</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Send your resume to careers@optikart.com or apply directly to any open position above.</p>
            <a href="mailto:careers@optikart.com?subject=Job Application" className="btn btn-primary btn-lg">
              <FiMail /> Send Your Resume
            </a>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .culture-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .benefits-grid { grid-template-columns: 1fr !important; }
          .job-card { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .culture-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Careers;
