import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { products } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';

const BrandPage = () => {
  const { brand } = useParams();
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('popularity');

  const brandName = brand.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await products.getAll({ brand: brandName, sort });
        setProductsList(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [brand, brandName, sort]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <nav style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            <Link to="/" style={{ color: 'var(--primary)' }}>Home</Link> / <Link to="/brands" style={{ color: 'var(--primary)' }}>Brands</Link> / <span>{brandName}</span>
          </nav>

          <div style={{ background: 'var(--bg-white)', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--shadow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{brandName}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-light)', marginTop: '4px' }}>{productsList.length} products available</p>
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="input" style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}>
              <option value="popularity">Popularity</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card" style={{ height: '280px' }}><div className="skeleton" style={{ height: '200px' }} /><div style={{ padding: '12px' }}><div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} /><div className="skeleton" style={{ height: '14px', width: '50%' }} /></div></div>
              ))}
            </div>
          ) : productsList.length === 0 ? (
            <div className="empty-state"><h3>No products from {brandName}</h3><p>Check back later</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {productsList.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BrandPage;
