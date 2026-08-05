import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiSearch, FiFilter, FiGrid, FiList } from 'react-icons/fi';
import { products } from '../services/api';
import { useUserBehavior } from '../contexts/UserBehaviorContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('relevance');
  const [priceRange, setPriceRange] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const { addSearchQuery } = useUserBehavior();

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      
      // Track search query
      if (query) {
        addSearchQuery(query);
      }
      
      try {
        const params = { q: query, sort };
        if (priceRange !== 'all') {
          const [min, max] = priceRange.split('-').map(Number);
          if (min) params.minPrice = min;
          if (max) params.maxPrice = max;
        }
        const res = await products.getAll(params);
        setResults(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, sort, priceRange]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 600 }}>
                {query ? `Search results for "${query}"` : 'All Products'}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>{total} products found</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="input" style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}>
                <option value="relevance">Relevance</option>
                <option value="priceLow">Price: Low to High</option>
                <option value="priceHigh">Price: High to Low</option>
                <option value="newest">Newest First</option>
                <option value="rating">Top Rated</option>
                <option value="popularity">Popularity</option>
              </select>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '8px', background: viewMode === 'grid' ? 'var(--primary-light)' : '#fff', borderRadius: '4px', border: `1px solid ${viewMode === 'grid' ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer' }}><FiGrid size={16} /></button>
                <button onClick={() => setViewMode('list')} style={{ padding: '8px', background: viewMode === 'list' ? 'var(--primary-light)' : '#fff', borderRadius: '4px', border: `1px solid ${viewMode === 'list' ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer' }}><FiList size={16} /></button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[{ label: 'All Prices', value: 'all' }, { label: 'Under ₹500', value: '0-500' }, { label: '₹500 - ₹1000', value: '500-1000' }, { label: '₹1000 - ₹2000', value: '1000-2000' }, { label: 'Above ₹2000', value: '2000-99999' }].map((range) => (
              <button key={range.value} onClick={() => setPriceRange(range.value)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', border: `1px solid ${priceRange === range.value ? 'var(--primary)' : 'var(--border)'}`, background: priceRange === range.value ? 'var(--primary-light)' : '#fff', color: priceRange === range.value ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                {range.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card" style={{ height: '280px' }}>
                  <div className="skeleton" style={{ height: '200px' }} />
                  <div style={{ padding: '12px' }}><div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} /><div className="skeleton" style={{ height: '14px', width: '50%' }} /></div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <FiSearch style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>No products found</h3>
              <p>Try adjusting your search or filters</p>
              <Link to="/" className="btn btn-primary">Browse All Products</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr', gap: '16px' }}>
              {results.map((product) => (
                <ProductCard key={product._id} product={product} listView={viewMode === 'list'} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchResults;
