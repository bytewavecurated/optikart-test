import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHelpCircle, FiChevronRight, FiSearch } from 'react-icons/fi';
import { help } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

const HELP_CATEGORIES = [
  { id: 'orders', title: 'Orders & Shipping', desc: 'Track orders, delivery status, shipping info', icon: '📦' },
  { id: 'returns', title: 'Returns & Refunds', desc: 'Return policy, refund status, exchanges', icon: '🔄' },
  { id: 'payments', title: 'Payments', desc: 'Payment methods, failed payments, invoices', icon: '💳' },
  { id: 'account', title: 'Account & Profile', desc: 'Login, password, profile settings', icon: '👤' },
  { id: 'prescription', title: 'Prescription & Lenses', desc: 'Upload prescription, lens types, power details', icon: '👁️' },
  { id: 'products', title: 'Products', desc: 'Product info, sizing, brand guides', icon: '👓' },
];

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await help.getAll();
        setArticles(res.data.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchArticles();
  }, []);

  const filteredArticles = searchQuery
    ? articles.filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div style={{ background: 'var(--primary)', padding: '40px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>How can we help you?</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '24px' }}>Find answers to common questions</p>
          <div style={{ maxWidth: '500px', margin: '0 auto', position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '18px' }} />
            <input type="text" placeholder="Search for help articles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '8px', border: 'none', fontSize: '15px' }} />
          </div>
        </div>

        <div className="container" style={{ padding: '32px 16px' }}>
          {searchQuery && filteredArticles.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Search Results</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredArticles.map((article) => (
                  <Link key={article._id} to={`/help/${article.category}`} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 500 }}>{article.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>{article.excerpt}</p>
                    </div>
                    <FiChevronRight style={{ color: 'var(--text-light)' }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Browse by Category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {HELP_CATEGORIES.map((cat) => (
              <Link key={cat.id} to={`/help/${cat.id}`} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', transition: 'box-shadow 0.2s' }}>
                <span style={{ fontSize: '32px' }}>{cat.icon}</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{cat.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'var(--primary-light)' }}>
            <FiHelpCircle size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Still need help?</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Our support team is here for you</p>
            <Link to="/help/contact" className="btn btn-primary">Contact Us</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HelpCenter;
