import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { help } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

const HelpCategory = () => {
  const { category } = useParams();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await help.getByCategory(category);
        setArticles(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [category]);

  const categoryName = category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <nav style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            <Link to="/help" style={{ color: 'var(--primary)' }}>Help Center</Link> / <span>{categoryName}</span>
          </nav>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>{categoryName}</h1>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : articles.length === 0 ? (
            <div className="empty-state"><h3>No articles in this category</h3><p>Check back later</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {articles.map((article) => (
                <div key={article._id} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 500 }}>{article.title}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>{article.excerpt}</p>
                  </div>
                  <FiChevronRight style={{ color: 'var(--text-light)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HelpCategory;
