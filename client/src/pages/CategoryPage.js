import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiFilter } from 'react-icons/fi';
import { products } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';

const CategoryPage = () => {
  const { category } = useParams();
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('popularity');
  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { category, sort };
        if (selectedBrands.length > 0) params.brands = selectedBrands.join(',');
        if (priceRange !== 'all') {
          const [min, max] = priceRange.split('-').map(Number);
          if (min) params.minPrice = min;
          if (max) params.maxPrice = max;
        }
        const [prodRes, brandRes] = await Promise.all([
          products.getByCategory(category, params),
          products.getBrands(),
        ]);
        setProductsList(prodRes.data.data || []);
        if (brandRes.data.data) {
          setBrands(brandRes.data.data.map((b) => b.name || b));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [category, sort, selectedBrands, priceRange]);

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const categoryName = category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <nav style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            <Link to="/" style={{ color: 'var(--primary)' }}>Home</Link> / <span>{categoryName}</span>
          </nav>

          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>{categoryName}</h1>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', alignItems: 'start' }} className="category-grid">
            <div className="card" style={{ padding: '16px', position: 'sticky', top: '80px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><FiFilter size={14} /> Filters</h3>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Sort By</h4>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="input" style={{ fontSize: '13px', padding: '8px' }}>
                  <option value="popularity">Popularity</option>
                  <option value="priceLow">Price: Low to High</option>
                  <option value="priceHigh">Price: High to Low</option>
                  <option value="newest">Newest</option>
                  <option value="rating">Rating</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Price Range</h4>
                {[{ label: 'All', value: 'all' }, { label: 'Under ₹500', value: '0-500' }, { label: '₹500 - ₹1000', value: '500-1000' }, { label: '₹1000 - ₹2000', value: '1000-2000' }, { label: 'Above ₹2000', value: '2000-99999' }].map((r) => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="radio" name="price" value={r.value} checked={priceRange === r.value} onChange={() => setPriceRange(r.value)} style={{ accentColor: 'var(--primary)' }} />
                    {r.label}
                  </label>
                ))}
              </div>

              {brands.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Brand</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {brands.map((brand) => (
                      <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} style={{ accentColor: 'var(--primary)' }} />
                        {brand}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card" style={{ height: '280px' }}><div className="skeleton" style={{ height: '200px' }} /><div style={{ padding: '12px' }}><div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} /><div className="skeleton" style={{ height: '14px', width: '50%' }} /></div></div>
                  ))}
                </div>
              ) : productsList.length === 0 ? (
                <div className="empty-state">
                  <h3>No products in this category</h3>
                  <p>Check back later for new arrivals</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {productsList.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`@media (max-width: 768px) { .category-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default CategoryPage;
