import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiX, FiPlus, FiShoppingCart, FiStar, FiCheck } from 'react-icons/fi';
import { products } from '../services/api';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const ProductCompare = () => {
  const location = useLocation();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [compareProducts, setCompareProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Get product IDs from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const productIds = params.get('products')?.split(',') || [];
    
    if (productIds.length > 0) {
      loadProducts(productIds);
    }
  }, [location.search]);

  const loadProducts = async (productIds) => {
    try {
      const loadedProducts = [];
      for (const id of productIds) {
        const res = await products.getById(id);
        if (res.data.success) {
          loadedProducts.push(res.data.data);
        }
      }
      setCompareProducts(loadedProducts);
    } catch (err) {
      toast.error('Failed to load products');
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await products.getAll({ search: query, limit: 10 });
      setSearchResults(res.data.data || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const addProduct = (product) => {
    if (compareProducts.length >= 4) {
      toast.error('Maximum 4 products can be compared');
      return;
    }

    if (compareProducts.find(p => p._id === product._id)) {
      toast.error('Product already in comparison');
      return;
    }

    setCompareProducts([...compareProducts, product]);
    setSearchQuery('');
    setSearchResults([]);
    toast.success('Product added to comparison');
  };

  const removeProduct = (productId) => {
    setCompareProducts(compareProducts.filter(p => p._id !== productId));
    toast.success('Product removed from comparison');
  };

  const handleAddToCart = (product) => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to cart');
      return;
    }
    addToCart(product);
  };

  const getSpecValue = (product, spec) => {
    switch (spec) {
      case 'brand': return product.brand || 'N/A';
      case 'category': return product.category || 'N/A';
      case 'frameShape': return product.frameShape || 'N/A';
      case 'frameColor': return product.frameColor || 'N/A';
      case 'lensType': return product.lensType || 'N/A';
      case 'gender': return product.gender || 'N/A';
      case 'frameSize': return product.frameSize || 'N/A';
      case 'material': return product.material?.join(', ') || 'N/A';
      case 'weight': return product.weight ? `${product.weight}g` : 'N/A';
      case 'warranty': return product.warranty || 'N/A';
      case 'rating': return product.rating ? `${product.rating.toFixed(1)} (${product.totalRatings || 0} reviews)` : 'No ratings';
      default: return 'N/A';
    }
  };

  const specs = [
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'frameShape', label: 'Frame Shape' },
    { key: 'frameColor', label: 'Frame Color' },
    { key: 'lensType', label: 'Lens Type' },
    { key: 'gender', label: 'Gender' },
    { key: 'frameSize', label: 'Frame Size' },
    { key: 'material', label: 'Material' },
    { key: 'weight', label: 'Weight' },
    { key: 'warranty', label: 'Warranty' },
    { key: 'rating', label: 'Rating' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Compare Products</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>
            Compare up to 4 products side by side
          </p>

          {/* Search and Add Products */}
          {compareProducts.length < 4 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ position: 'relative', maxWidth: '500px' }}>
                <input
                  type="text"
                  placeholder="Search products to add..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="input"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                {searching && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <div className="spinner" style={{ width: '20px', height: '20px' }} />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {searchResults.map(product => (
                    <div
                      key={product._id}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => addProduct(product)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <img
                        src={product.images?.[0] || '/placeholder-glasses.png'}
                        alt={product.name}
                        style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '4px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{product.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{product.brand}</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginTop: '4px' }}>
                          ₹{product.price?.toLocaleString()}
                        </div>
                      </div>
                      <FiPlus size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comparison Table */}
          {compareProducts.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <FiCheck size={64} style={{ color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No Products to Compare</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Search and add products to compare them side by side
              </p>
              <Link to="/products" className="btn btn-primary">Browse Products</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-primary)' }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, width: '150px' }}>
                      Feature
                    </th>
                    {compareProducts.map(product => (
                      <th key={product._id} style={{ padding: '16px', textAlign: 'center', minWidth: '200px' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => removeProduct(product._id)}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              background: 'var(--danger)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <FiX size={14} />
                          </button>
                          <img
                            src={product.images?.[0] || '/placeholder-glasses.png'}
                            alt={product.name}
                            style={{ width: '120px', height: '120px', objectFit: 'contain', marginBottom: '12px' }}
                          />
                          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{product.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '8px' }}>{product.brand}</div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>
                            ₹{product.price?.toLocaleString()}
                          </div>
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="btn btn-primary btn-sm"
                            style={{ width: '100%' }}
                          >
                            <FiShoppingCart size={14} /> Add to Cart
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {specs.map(spec => (
                    <tr key={spec.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {spec.label}
                      </td>
                      {compareProducts.map(product => (
                        <td key={product._id} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px' }}>
                          {getSpecValue(product, spec.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductCompare;
