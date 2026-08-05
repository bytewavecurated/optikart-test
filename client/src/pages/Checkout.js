import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin, FiCreditCard, FiCheck } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { orders, payment, coupons } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const Checkout = () => {
  const { items, subtotal, deliveryCharges, discount, total, coupon, clearCart, removeCoupon, applyCoupon } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [address, setAddress] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    addressLine: user?.address?.addressLine || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    pincode: user?.address?.pincode || '',
  });

  const [paymentMethod, setPaymentMethod] = useState('online');

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await coupons.validate(couponCode.trim());
      applyCoupon(res.data.data);
      toast.success('Coupon applied!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    if (!address.fullName || !address.phone || !address.addressLine || !address.city || !address.state || !address.pincode) {
      toast.error('Please fill all address fields');
      return;
    }
    if (!/^\d{6}$/.test(address.pincode)) {
      toast.error('Enter a valid 6-digit pincode');
      return;
    }
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    setProcessing(true);
    try {
      if (paymentMethod === 'online') {
        const orderRes = await payment.createOrder({ amount: total, items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity, variant: i.variant })) });
        const { orderId, amount, currency } = orderRes.data.data;
        const options = { key: orderRes.data.data.razorpayKeyId, amount, currency, name: 'OptiKart', order_id: orderId, handler: async (response) => {
          try {
            await payment.verify({ razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature, orderData: { address, items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity, variant: i.variant })), couponCode: coupon?.code, paymentMethod: 'online' } });
            toast.success('Order placed successfully!');
            clearCart();
            navigate('/orders');
          } catch (err) {
            toast.error('Payment verification failed');
          }
        }, prefill: { name: address.fullName, contact: address.phone }, theme: { color: '#2874f0' } };
        if (window.Razorpay) {
          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          toast.error('Payment gateway not loaded');
        }
      } else {
        await orders.create({ address, items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity, variant: i.variant })), couponCode: coupon?.code, paymentMethod: 'cod' });
        toast.success('Order placed successfully!');
        clearCart();
        navigate('/orders');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, background: 'var(--bg-primary)' }}>
        <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '16px', background: '#fff', borderRadius: '8px' }}>
            {[{ num: 1, label: 'Address' }, { num: 2, label: 'Payment' }, { num: 3, label: 'Summary' }].map((s, idx) => (
              <React.Fragment key={s.num}>
                {idx > 0 && <div style={{ flex: 1, height: '2px', background: step >= s.num ? 'var(--primary)' : 'var(--border)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: step >= s.num ? 'var(--primary)' : 'var(--border)', color: step >= s.num ? '#fff' : 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                    {step > s.num ? <FiCheck /> : s.num}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: step === s.num ? 600 : 400, color: step >= s.num ? 'var(--primary)' : 'var(--text-light)' }}>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '16px', alignItems: 'start' }} className="checkout-grid">
            <div>
              {step === 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><FiMapPin /> Delivery Address</h2>
                  <form onSubmit={handleAddressSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                      <label>Full Name</label>
                      <input className="input" value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} placeholder="Enter full name" />
                    </div>
                    <div className="input-group">
                      <label>Phone Number</label>
                      <input className="input" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder="10-digit number" />
                    </div>
                    <div className="input-group">
                      <label>Pincode</label>
                      <input className="input" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} placeholder="6-digit pincode" />
                    </div>
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                      <label>Address</label>
                      <textarea className="input" rows={3} value={address.addressLine} onChange={(e) => setAddress({ ...address, addressLine: e.target.value })} placeholder="House no., building, street, area" />
                    </div>
                    <div className="input-group">
                      <label>City</label>
                      <input className="input" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" />
                    </div>
                    <div className="input-group">
                      <label>State</label>
                      <input className="input" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="State" />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <button type="submit" className="btn btn-primary btn-lg">Deliver Here</button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><FiCreditCard /> Payment Method</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[{ id: 'online', label: 'Online Payment', desc: 'UPI, Cards, Net Banking, Wallets' }, { id: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives' }].map((method) => (
                      <label key={method.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: `2px solid ${paymentMethod === method.id ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', background: paymentMethod === method.id ? 'var(--primary-light)' : '#fff' }}>
                        <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} style={{ accentColor: 'var(--primary)' }} />
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 500 }}>{method.label}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{method.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button onClick={() => setStep(1)} className="btn btn-outline">Back</button>
                    <button onClick={() => setStep(3)} className="btn btn-primary">Continue</button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Order Summary</h2>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Delivering to:</div>
                    <div style={{ fontSize: '14px' }}>{address.fullName}, {address.addressLine}, {address.city}, {address.state} - {address.pincode}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Phone: {address.phone}</div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    {items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: '14px' }}>
                        <span>{item.product.name} x{item.quantity}</span>
                        <span style={{ fontWeight: 600 }}>₹{item.product.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button onClick={() => setStep(2)} className="btn btn-outline">Back</button>
                    <button onClick={handlePlaceOrder} disabled={processing} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                      {processing ? <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : `Pay ₹${total}`}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="card" style={{ position: 'sticky', top: '80px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-dark)' }}>
                <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase' }}>Price Details</h3>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Subtotal ({items.length} items)</span>
                  <span>₹{subtotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Delivery Charges</span>
                  <span>₹{deliveryCharges}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--success)' }}>
                    <span>Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>
              {!coupon && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="input" placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} style={{ flex: 1, fontSize: '13px' }} />
                    <button onClick={handleApplyCoupon} disabled={applyingCoupon} className="btn btn-primary btn-sm">
                      {applyingCoupon ? '...' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}
              {coupon && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--success)' }}>Coupon: {coupon.code} applied</span>
                  <button onClick={() => { removeCoupon(); setCouponCode(''); }} style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', background: 'none' }}>Remove</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
          form { grid-template-columns: 1fr !important; }
          form > div { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
};

export default Checkout;
