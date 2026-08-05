import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMinus, FiPlus, FiX, FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Cart = () => {
  const { items, subtotal, deliveryCharges, total, totalItems, updateQuantity, removeFromCart, DELIVERY_CHARGE_PER_ITEM } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <div className="container page-wrapper">
            <div className="empty-state">
              <FiShoppingBag style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>Your cart is empty</h3>
              <p>Add items to it now.</p>
              <Link to="/" className="btn btn-primary btn-lg">Shop Now</Link>
            </div>
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
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>My Cart ({totalItems})</h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '16px', alignItems: 'start' }} className="cart-grid">
            <div className="card">
              {items.map((item, index) => (
                <motion.div
                  key={`${item.product._id}-${index}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', padding: '16px 20px', borderBottom: '1px solid var(--border-light)', gap: '16px' }}
                >
                  <Link to={`/product/${item.product._id}`} style={{ flexShrink: 0 }}>
                    <img
                      src={item.product.images?.[0] || '/placeholder-glasses.png'}
                      alt={item.product.name}
                      style={{ width: '112px', height: '112px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                    />
                  </Link>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Link to={`/product/${item.product._id}`} style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.product.name}
                    </Link>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>{item.product.brand}</span>
                    {item.variant && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                        {item.variant.label || `Power: ${item.variant.power}`}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700 }}>₹{item.product.price}</span>
                      {item.product.originalPrice && (
                        <span className="price-original" style={{ fontSize: '13px' }}>₹{item.product.originalPrice}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <button onClick={() => updateQuantity(index, item.quantity - 1)} disabled={item.quantity <= 1} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', cursor: 'pointer', borderRight: '1px solid var(--border)' }}>
                          <FiMinus size={12} />
                        </button>
                        <span style={{ width: '40px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(index, item.quantity + 1)} disabled={item.quantity >= 10} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', cursor: 'pointer', borderLeft: '1px solid var(--border)' }}>
                          <FiPlus size={12} />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(index)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', background: 'none' }}>
                        <FiTrash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '80px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700 }}>₹{item.product.price * item.quantity}</span>
                  </div>
                </motion.div>
              ))}

              <div style={{ padding: '16px 20px', background: 'var(--bg-primary)' }}>
                <Link to="/" style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 600 }}>Continue Shopping</Link>
              </div>
            </div>

            <div className="card" style={{ position: 'sticky', top: '80px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-dark)' }}>
                <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase' }}>Price Details</h3>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Price ({totalItems} items)</span>
                  <span>₹{subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Delivery Charges</span>
                  <span>₹{deliveryCharges}</span>
                </div>
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
                  <span>Total Amount</span>
                  <span>₹{total}</span>
                </div>
                <div className="divider" />
                <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 500 }}>
                  You'll save ₹{(items.reduce((sum, item) => sum + ((item.product.originalPrice || item.product.price) - item.product.price) * item.quantity), 0)} on this order
                </p>
              </div>
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => navigate('/checkout')} className="btn btn-primary btn-block btn-lg">
                  Place Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .cart-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Cart;
