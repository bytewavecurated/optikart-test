import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiShoppingCart, FiHeart } from 'react-icons/fi';
import { wishlist as wishlistApi, cart as cartApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { wishlistItemsOf } from '../services/apiResponse.js';

const MAX_WISHLIST_LOGGED_IN = 30;
const MAX_WISHLIST_GUEST = 3;

const Wishlist = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Guests keep a small local wishlist; only members have a server list.
    if (isAuthenticated) fetchWishlist();
    else setLoading(false);
  }, [isAuthenticated]);

  const fetchWishlist = async () => {
    try {
      const res = await wishlistApi.get();
      setItems(wishlistItemsOf(res.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (productId) => {
    try {
      await wishlistApi.remove(productId);
      setItems(items.filter(item => item.product._id !== productId));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const moveToCart = async (productId) => {
    try {
      await cartApi.add(productId, 1);
      await wishlistApi.remove(productId);
      setItems(items.filter(item => item.product._id !== productId));
      toast.success('Moved to cart');
    } catch (err) {
      toast.error('Failed to move to cart');
    }
  };

  const maxItems = isAuthenticated ? MAX_WISHLIST_LOGGED_IN : MAX_WISHLIST_GUEST;

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

  if (items.length === 0) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <FiHeart size={64} style={{ color: 'var(--text-light)', marginBottom: '16px' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>Your wishlist is empty</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Save items you love for later</p>
            <Link to="/" className="btn btn-primary">Start Shopping</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)' }}>My Wishlist ({items.length}/{maxItems})</h1>
            {!isAuthenticated && (
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Guest wishlist limited to {MAX_WISHLIST_GUEST} items. <Link to="/login" style={{ color: 'var(--primary)' }}>Login</Link> for up to {MAX_WISHLIST_LOGGED_IN} items.
              </p>
            )}
          </div>
          <Link to="/" className="btn btn-outline">Continue Shopping</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {items.map((item) => (
            <div key={item._id} className="card">
              <Link to={`/product/${item.product._id}`}>
                <img
                  src={item.product.images?.[0] || '/placeholder.png'}
                  alt={item.product.title}
                  style={{ width: '100%', height: '280px', objectFit: 'cover' }}
                />
              </Link>
              <div style={{ padding: '16px' }}>
                <Link to={`/product/${item.product._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{item.product.title}</h3>
                </Link>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{item.product.brand}</p>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginBottom: '16px' }}>
                  ₹{item.product.price}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => moveToCart(item.product._id)}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <FiShoppingCart size={14} /> Move to Cart
                  </button>
                  <button
                    onClick={() => removeItem(item.product._id)}
                    className="btn btn-outline btn-sm"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Wishlist;
