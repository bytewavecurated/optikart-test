import React, { useState } from 'react';
import { FiMail, FiPhone, FiMapPin, FiSend, FiClock } from 'react-icons/fi';
import { help } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const ContactUs = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill required fields');
      return;
    }
    setLoading(true);
    try {
      await help.contact(formData);
      toast.success('Message sent successfully! We will get back to you soon.');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Contact Us</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>We'd love to hear from you</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="contact-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: <FiPhone size={20} />, title: 'Phone', info: '1800-123-4567', sub: 'Toll free, Mon-Sat 9am-9pm' },
                { icon: <FiMail size={20} />, title: 'Email', info: 'support@optikart.in', sub: 'We reply within 24 hours' },
                { icon: <FiMapPin size={20} />, title: 'Office', info: 'Mumbai, Maharashtra, India', sub: 'Headquarters' },
                { icon: <FiClock size={20} />, title: 'Business Hours', info: 'Mon - Sat: 9:00 AM - 9:00 PM', sub: 'Sunday: Closed' },
              ].map((item, idx) => (
                <div key={idx} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600 }}>{item.title}</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{item.info}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Send us a message</h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group"><label>Name *</label><input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your name" /></div>
                  <div className="input-group"><label>Email *</label><input className="input" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Your email" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="input-group"><label>Phone</label><input className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Your phone" /></div>
                  <div className="input-group"><label>Subject</label><input className="input" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="Subject" /></div>
                </div>
                <div className="input-group"><label>Message *</label><textarea className="input" rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="How can we help?" /></div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-lg"><FiSend /> {loading ? 'Sending...' : 'Send Message'}</button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`@media (max-width: 768px) { .contact-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default ContactUs;
