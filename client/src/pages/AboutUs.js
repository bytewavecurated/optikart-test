import React from 'react';
import { FiUsers, FiShoppingBag, FiAward, FiHeart, FiTarget, FiEye, FiTruck, FiShield, FiHeadphones } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const stats = [
  { icon: <FiUsers size={28} />, value: '2M+', label: 'Happy Customers' },
  { icon: <FiShoppingBag size={28} />, value: '500+', label: 'Verified Sellers' },
  { icon: <FiAward size={28} />, value: '1M+', label: 'Products Sold' },
  { icon: <FiEye size={28} />, value: '50K+', label: 'Frames Available' },
];

const team = [
  { name: 'Arjun Mehta', role: 'CEO & Co-Founder', bio: 'Former eyewear industry veteran with 15+ years of experience in retail and technology.' },
  { name: 'Priya Sharma', role: 'CTO & Co-Founder', bio: 'Full-stack engineer passionate about building seamless e-commerce experiences.' },
  { name: 'Rahul Verma', role: 'Head of Product', bio: 'Product strategist focused on user-centric design and innovation in eyewear retail.' },
  { name: 'Sneha Patel', role: 'Head of Marketing', bio: 'Brand builder with expertise in digital marketing and community engagement.' },
  { name: 'Vikram Singh', role: 'Head of Operations', bio: 'Supply chain expert ensuring fast, reliable delivery across India.' },
  { name: 'Ananya Reddy', role: 'Head of Customer Success', bio: 'Dedicated to delivering exceptional support and building lasting customer relationships.' },
];

const reasons = [
  { icon: <FiShield size={24} />, title: '100% Genuine Products', desc: 'Every frame and lens is sourced directly from authorized brand partners.' },
  { icon: <FiTruck size={24} />, title: 'Fast Delivery', desc: 'Pan-India delivery with real-time tracking through our Shiprocket partnership.' },
  { icon: <FiHeadphones size={24} />, title: 'Expert Support', desc: 'Our eyewear specialists are available to help you choose the perfect pair.' },
  { icon: <FiHeart size={24} />, title: 'Hassle-Free Returns', desc: '7-day easy return policy with no questions asked.' },
];

const AboutUs = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ background: 'var(--primary)', borderRadius: 'var(--radius-lg)', padding: '48px 32px', textAlign: 'center', marginBottom: '32px', color: '#fff' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>About OptiKart</h1>
            <p style={{ fontSize: '16px', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>India's leading online destination for premium eyewear, bringing clarity and style to millions since 2020.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px' }} className="about-story-grid">
            <div className="card" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: 'var(--primary)' }}>Our Story</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '12px' }}>
                OptiKart was born from a simple observation: buying eyewear online in India was complicated, expensive, and often unreliable. Founded in 2020 by Arjun Mehta and Priya Sharma, we set out to change that by creating a platform that combines the convenience of e-commerce with the expertise of a traditional optician.
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                Today, OptiKart serves over 2 million customers across India, offering everything from prescription eyeglasses and contact lenses to premium sunglasses and computer glasses. We partner with 500+ verified sellers and 100+ top brands to bring you the widest selection at the best prices.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '24px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiTarget size={20} /></div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Our Mission</h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>To make quality eyewear accessible to every Indian by combining technology, expert guidance, and affordable pricing in a seamless online experience.</p>
              </div>
              <div className="card" style={{ padding: '24px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiEye size={20} /></div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Our Vision</h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>To become South Asia's most trusted eyewear platform, empowering millions to see the world clearly while looking their best.</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }} className="stats-grid">
            {stats.map((stat, idx) => (
              <div key={idx} className="card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>{stat.icon}</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>Meet Our Leadership</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="team-grid">
              {team.map((member, idx) => (
                <div key={idx} className="card" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: 700 }}>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{member.name}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500, marginBottom: '8px' }}>{member.role}</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: 1.6 }}>{member.bio}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>Why Choose OptiKart?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="reasons-grid">
              {reasons.map((reason, idx) => (
                <div key={idx} className="card" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{reason.icon}</div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{reason.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)', lineHeight: 1.6 }}>{reason.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .about-story-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .team-grid { grid-template-columns: 1fr !important; }
          .reasons-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .reasons-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;
