import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiHeart, FiShoppingCart, FiStar, FiArrowRight } from 'react-icons/fi';
import { products as productsApi, manufacturers as manufacturersApi } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, manufacturersRes] = await Promise.all([
        productsApi.getAll({ limit: 50 }),
        manufacturersApi.getAll()
      ]);
      setProducts(productsRes.data.data || []);
      setManufacturers(manufacturersRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Products', icon: '👓' },
    { id: 'sunglasses', name: 'Sunglasses', icon: '🕶️' },
    { id: 'eyeglasses', name: 'Eyeglasses', icon: '👓' },
    { id: 'contactlenses', name: 'Contact Lenses', icon: '👁️' },
    { id: 'readingglasses', name: 'Reading Glasses', icon: '📖' }
  ];

  const frameShapes = ['Rectangle', 'Cat Eye', 'Oval', 'Aviator', 'Round', 'Wayfarer', 'Geometric', 'Square'];
  const frameTypes = ['Full Rim', 'Half Rim', 'Rimless'];
  const materials = ['Acetate', 'Metal', 'Polycarbonate', 'Stainless Steel', 'TR90', 'Titanium'];

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner"></div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      
      {/* Hero Section */}
      <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', padding: '60px 0', color: 'white', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', marginBottom: '16px' }}>
            India's #1 Eyewear Destination
          </h1>
          <p style={{ fontSize: '20px', marginBottom: '32px', opacity: 0.9 }}>
            Shop sunglasses, eyeglasses, contact lenses and more
          </p>
          <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} size={20} />
            <input
              type="text"
              placeholder="Search for products, brands and more..."
              className="input"
              style={{ paddingLeft: '48px', fontSize: '16px', height: '56px' }}
            />
          </div>
        </div>
      </div>

      <div className="container page-wrapper">
        {/* Categories */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Shop by Category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="card"
                style={{
                  padding: '24px',
                  cursor: 'pointer',
                  border: selectedCategory === cat.id ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>{cat.icon}</div>
                <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)' }}>{cat.name}</h3>
              </button>
            ))}
          </div>
        </div>

        {/* Frame Shapes */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Shop by Frame Shape</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {frameShapes.map((shape) => (
              <Link key={shape} to={`/products?frameShape=${shape.toLowerCase().replace(' ', '-')}`} className="card" style={{ padding: '20px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)' }}>{shape}</h3>
              </Link>
            ))}
          </div>
        </div>

        {/* Frame Types */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Shop by Frame Type</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {frameTypes.map((type) => (
              <Link key={type} to={`/products?frameType=${type.toLowerCase().replace(' ', '-')}`} className="card" style={{ padding: '24px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)' }}>{type}</h3>
              </Link>
            ))}
          </div>
        </div>

        {/* Materials */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Shop by Material</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {materials.map((material) => (
              <Link key={material} to={`/products?material=${material.toLowerCase().replace(' ', '-')}`} className="card" style={{ padding: '20px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)' }}>{material}</h3>
              </Link>
            ))}
          </div>
        </div>

        {/* Brands */}
        {manufacturers.length > 0 && (
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Shop by Brand</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {manufacturers.slice(0, 8).map((manufacturer) => (
                <Link key={manufacturer._id} to={`/products?brand=${manufacturer.brandName}`} className="card" style={{ padding: '24px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)' }}>{manufacturer.brandName}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{manufacturer.productCount || 0} products</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Products */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)' }}>
              {selectedCategory === 'all' ? 'All Products' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <Link to={`/products?category=${selectedCategory}`} className="btn btn-outline">
              View All <FiArrowRight size={16} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {filteredProducts.slice(0, 12).map((product) => (
              <Link key={product._id} to={`/product/${product._id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <img
                  src={product.images?.[0] || '/placeholder.png'}
                  alt={product.title}
                  style={{ width: '100%', height: '280px', objectFit: 'cover' }}
                />
                <div style={{ padding: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{product.brand}</p>
                  <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{product.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiStar size={14} style={{ color: 'var(--warning)' }} fill="var(--warning)" />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{product.rating || 0}</span>
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>({product.reviewCount || 0} reviews)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>₹{product.price}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span style={{ fontSize: '14px', color: 'var(--text-light)', textDecoration: 'line-through' }}>₹{product.originalPrice}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Home;
