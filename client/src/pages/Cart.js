import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiMinus, FiPlus, FiShoppingBag } from 'react-icons/fi';
import { useCart, lineKey } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import BackButton from '../components/BackButton';

const Cart = () => {
  const { isAuthenticated } = useAuth();
  const {
    items,
    removeFromCart,
    updateQuantity: updateQuantityCtx,
    MAX_ITEMS: CTX_MAX,
    linePrice,
    isSelected,
    toggleSelected,
    selectAll,
    clearSelection,
    selectedDelivery,
    selectedCount,
    selectedSubtotal,
    selectedTotal,
    discount,
    coupon
  } = useCart();
  const MAX_CART_ITEMS = CTX_MAX || 25;
  const navigate = useNavigate();

  // The cart lives in CartContext (shared with the header badge and checkout),
  // so this page reads and mutates that single source of truth.
  const indexById = (id) => items.findIndex((it) => it.product?._id === id);

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return;
    const idx = indexById(productId);
    if (idx < 0) return;

    const totalUnits = items.reduce((sum, it) => sum + it.quantity, 0);
    const diff = quantity - items[idx].quantity;
    if (totalUnits + diff > MAX_CART_ITEMS) {
      toast.error(`Cart is limited to ${MAX_CART_ITEMS} items`);
      return;
    }
    updateQuantityCtx(idx, quantity);
  };

  const removeItem = (productId) => {
    const idx = indexById(productId);
    if (idx < 0) return;
    removeFromCart(idx);
    toast.success('Item removed');
  };

  // legacy total retained for the empty-state copy only
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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
          <BackButton />
          <h1 style={{ fontFamily: 'var(--font-heading)' }}>Shopping Cart ({totalItems}/{MAX_CART_ITEMS})</h1>
          <Link to="/" className="btn btn-outline">Continue Shopping</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }} className="cart-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={items.every((it) => isSelected(it))}
                  indeterminate={items.some((it) => isSelected(it)) && !items.every((it) => isSelected(it))}
                  onChange={() => (items.every((it) => isSelected(it)) ? clearSelection() : selectAll())}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                />
                Select all
              </label>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {selectedCount} of {totalItems} item{totalItems === 1 ? '' : 's'} selected
              </span>
            </div>
            {items.map((item) => (
              <div key={item._id} className="card" style={{ padding: '20px', display: 'flex', gap: '14px', opacity: isSelected(item) ? 1 : 0.55 }}>
                <label title="Include this item in the order" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isSelected(item)}
                    onChange={() => toggleSelected(item)}
                    style={{ width: 18, height: 18, accentColor: 'var(--brand)', cursor: 'pointer' }}
                  />
                </label>
                <img
                  src={item.product?.images?.[0] || '/assets/face-1.svg'}
                  alt={item.product?.title}
                  style={{ width: '120px', height: '120px', objectFit: 'contain', background: 'var(--bg-subtle)', borderRadius: 'var(--radius)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/product/${item.product?._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{item.product?.title}</h3>
                  </Link>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{item.product?.brand}</p>
                  {item.variant && (item.variant.color || item.variant.size) && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      {[item.variant.color, item.variant.size].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  {item.lensConfig && (
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Lens: {[item.lensConfig.lensType, item.lensConfig.lensPackage, item.lensConfig.coating].filter(Boolean).join(' / ') || 'custom'}
                    </p>
                  )}
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>
                    ₹{linePrice(item).toLocaleString('en-IN')}
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {' '}x {item.quantity} = ₹{(linePrice(item) * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
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
                <span>Subtotal ({selectedCount} selected)</span>
                <span>₹{Math.round(selectedSubtotal).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                <span>Platform fee</span>
                <span>{selectedDelivery === 0 ? 'Free' : `₹${selectedDelivery.toLocaleString('en-IN')}`}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: 14, color: 'var(--success)' }}>
                  <span>Coupon{coupon?.code ? ` (${coupon.code})` : ''}</span>
                  <span>- ₹{Math.round(discount).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary)' }}>₹{Math.round(selectedTotal).toLocaleString('en-IN')}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '10px 0 0' }}>
                Unselected items stay in your cart and are not charged.
              </p>
              <button
                onClick={() => {
                  if (selectedCount === 0) { toast.error('Select at least one item to check out'); return; }
                  navigate('/checkout', { state: { selectedKeys: items.filter(isSelected).map(lineKey) } });
                }}
                disabled={selectedCount === 0}
                className="btn btn-primary btn-block btn-lg"
                style={{ marginTop: '20px', opacity: selectedCount === 0 ? 0.6 : 1, cursor: selectedCount === 0 ? 'not-allowed' : 'pointer' }}
              >
                Proceed to Checkout ({selectedCount})
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
