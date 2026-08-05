import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart, FiShoppingCart } from 'react-icons/fi';
import { wishlist } from '../services/api';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const Wishlist = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const res = await wishlist.get();
        setItems(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated) fetchWishlist();
    else setLoading(false);
  }, [isAuthenticated]);

  const handleRemove = async (productId) => {
    try {
      await wishlist.remove(productId);
      setItems(items.filter((item) => item.product?._id !== productId));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const handleMoveToCart = (product) => {
    addToCart(product);
    handleRemove(product._id);
    toast.success('Moved to cart');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper">
          <div className="empty-state">
            <FiHeart style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
            <h3>Please login to view wishlist</h3>
            <Link to="/login" className="btn btn-primary">Login</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>My Wishlist ({items.length})</h1>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner spinner-lg" /></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <FiHeart style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>Your wishlist is empty</h3>
              <p>Save items you like for later</p>
              <Link to="/" className="btn btn-primary">Explore Products</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {items.map((item) => {
                const product = item.product || item;
                return (
                  <div key={product._id} className="card" style={{ overflow: 'hidden' }}>
                    <Link to={`/product/${product._id}`}>
                      <img src={product.images?.[0] || '/placeholder-glasses.png'} alt={product.name} style={{ width: '100%', height: '200px', objectFit: 'contain', background: '#fafafa' }} />
                    </Link>
                    <div style={{ padding: '12px' }}>
                      <Link to={`/product/${product._id}`} style={{ fontSize: '14px', fontWeight: 500, display: 'block', marginBottom: '4px' }} className="truncate">{product.name}</Link>
                      <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '8px' }}>{product.brand}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700 }}>₹{product.price}</span>
                        {product.originalPrice && <span className="price-original" style={{ fontSize: '12px' }}>₹{product.originalPrice}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleMoveToCart(product)} className="btn btn-primary btn-sm" style={{ flex: 1 }}><FiShoppingCart size={12} /> Add to Cart</button>
                        <button onClick={() => handleRemove(product._id)} className="btn btn-outline btn-sm"><FiHeart size={12} /></button>
                      </div>
                    </div>
                  </div>
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

export default Wishlist;
