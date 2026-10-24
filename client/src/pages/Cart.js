import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiMinus, FiPlus, FiShoppingBag } from 'react-icons/fi';
import { cart as cartApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const MAX_CART_ITEMS = 25;

const Cart = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const res = await cartApi.get();
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (quantity < 1) return;
    
    // Check cart limit
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const diff = quantity - (items.find(i => i._id === itemId)?.quantity || 0);
    
    if (totalItems + diff > MAX_CART_ITEMS) {
      toast.error(`Cart is limited to ${MAX_CART_ITEMS} items`);
      return;
    }
    
    try {
      await cartApi.updateQuantity(itemId, quantity);
      setItems(items.map(item => item._id === itemId ? { ...item, quantity } : item));
    } catch (err) {
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await cartApi.removeItem(itemId);
      setItems(items.filter(item => item._id !== itemId));
      toast.success('Item removed');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const total = items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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
            <FiShoppingBag size={64} style={{ color: 'var(--text-light)', marginBottom: '16px' }} />
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>Your cart is empty</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add items to get started</p>
            <Link to="/" className="btn btn-primary">Continue Shopping</Link>
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
          <h1 style={{ fontFamily: 'var(--font-heading)' }}>Shopping Cart ({totalItems}/{MAX_CART_ITEMS})</h1>
          <Link to="/" className="btn btn-outline">Continue Shopping</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }} className="cart-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {items.map((item) => (
              <div key={item._id} className="card" style={{ padding: '20px', display: 'flex', gap: '16px' }}>
                <img
                  src={item.product?.images?.[0] || '/placeholder.png'}
                  alt={item.product?.title}
                  style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius)' }}
                />
                <div style={{ flex: 1 }}>
                  <Link to={`/product/${item.product?._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{item.product?.title}</h3>
                  </Link>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{item.product?.brand}</p>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>₹{item.product?.price}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => removeItem(item._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                  >
                    <FiTrash2 size={18} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity - 1)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white' }}
                    >
                      <FiMinus size={14} />
                    </button>
                    <span style={{ fontSize: '16px', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item._id, item.quantity + 1)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white' }}
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="card" style={{ padding: '24px', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>Order Summary</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                <span>Subtotal ({totalItems} items)</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                <span>Shipping</span>
                <span style={{ color: 'var(--success)' }}>Free</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>₹{total.toLocaleString()}</span>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="btn btn-primary btn-block btn-lg"
                style={{ marginTop: '20px' }}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 968px) {
            .cart-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
      <Footer />
    </>
  );
};

export default Cart;
