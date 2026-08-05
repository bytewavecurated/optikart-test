import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { products } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AllBrands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await products.getBrands();
        setBrands(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>All Brands</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>Explore eyewear from top brands</p>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card skeleton" style={{ height: '100px' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
              {brands.map((brand) => {
                const name = typeof brand === 'string' ? brand : brand.name;
                const logo = typeof brand === 'object' ? brand.logo : null;
                return (
                  <Link key={name} to={`/brands/${name.toLowerCase().replace(/\s+/g, '-')}`} className="card" style={{ padding: '20px', textAlign: 'center', transition: 'box-shadow 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '100px' }}>
                    {logo && <img src={logo} alt={name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AllBrands;
