import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orders as ordersApi, returns as returnsApi } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { FiPackage, FiCalendar, FiAlertCircle, FiUpload, FiCheckCircle } from 'react-icons/fi';

const CustomerReturnPortal = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reason, setReason] = useState('');
  // 'return' refunds, 'exchange' replaces - only offered where every selected
  // line is exchangeable, since a seller can disable it per product listing.
  const [requestType, setRequestType] = useState('return');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, [orderId]);

  const checkEligibility = async () => {
    try {
      setLoading(true);
      const res = await returnsApi.checkEligibility(orderId);

      if (res.data.success) {
        setEligibility(res.data);
        setOrder(res.data.order);
      } else {
        toast.error(res.data.message || 'Order not eligible for return');
        setEligibility(res.data);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      toast.error('Failed to check return eligibility');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (productId, quantity) => {
    const existing = selectedItems.find(item => item.productId === productId);
    if (existing) {
      setSelectedItems(selectedItems.filter(item => item.productId !== productId));
    } else {
      setSelectedItems([...selectedItems, { productId, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (productId, quantity) => {
    setSelectedItems(selectedItems.map(item =>
      item.productId === productId ? { ...item, quantity } : item
    ));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setImages([...images, ...files]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    if (!reason) {
      toast.error('Please select a return reason');
      return;
    }

    try {
      setSubmitting(true);

      // Create return request
      const returnData = {
        orderId,
        items: selectedItems,
        reason,
        description,
        type: requestType
      };

      const res = await returnsApi.create(returnData);

      if (res.data.success) {
        toast.success('Return request created successfully');

        // Upload images if any
        if (images.length > 0) {
          const formData = new FormData();
          images.forEach(img => formData.append('images', img));

          await returnsApi.uploadImages(res.data.returnRequest._id, formData);
          toast.success('Images uploaded successfully');
        }

        navigate('/my-returns');
      } else {
        toast.error(res.data.message || 'Failed to create return request');
      }
    } catch (error) {
      console.error('Error creating return:', error);
      toast.error('Failed to create return request');
    } finally {
      setSubmitting(false);
    }
  };

  // An exchange is only offered when every selected line allows one; a seller can
  // turn exchange off per product listing.
  const exchangeBlocked = (eligibility?.lineWindows || [])
    .filter((l) => (selectedItems || []).some((sel) => String(sel.productId || sel.product) === String(l.product)))
    .some((l) => l.exchangeable === false);

  if (loading) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Checking return eligibility...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!eligibility || !eligibility.eligible) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <FiAlertCircle size={64} color="var(--danger)" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Return Not Eligible</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {eligibility?.message || 'This order is not eligible for return'}
            </p>
            {eligibility?.daysSinceDelivery && (
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Days since delivery: {eligibility.daysSinceDelivery} / {eligibility.returnWindowDays}
                {Array.isArray(eligibility.lineWindows) && eligibility.lineWindows.length > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    {eligibility.lineWindows.filter((l) => l.returnable).map((l, i) => (
                      <div key={l.product || i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {l.returnWindowDays === 0 ? 'Final sale' : `${Math.max(0, l.returnWindowDays - (eligibility.daysSinceDelivery || 0))} day(s) left`}
                          {l.exchangeable ? '' : ' - no exchange'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </p>
            )}
            <button onClick={() => navigate('/orders')} className="btn btn-primary">
              Back to Orders
            </button>
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
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Return Items</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Order #{order.orderNumber}</p>
        </div>

        {/* Eligibility Info */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <FiCheckCircle size={24} color="var(--success)" />
            <div>
              <div style={{ fontWeight: 600 }}>Return Eligible</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {eligibility.daysRemaining} days remaining in return window
              </div>
            </div>
          </div>
        </div>

        {/* Select Items */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Select Items to Return</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {eligibility.items.map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <input
                  type="checkbox"
                  checked={selectedItems.some(si => si.productId === item.product._id)}
                  onChange={() => handleItemSelect(item.product._id, item.quantity)}
                  style={{ width: '20px', height: '20px' }}
                />
                <img
                  src={item.product.images?.[0] || '/placeholder.svg'}
                  alt={item.product.title}
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.product.title}</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Quantity: {item.quantity} · Price: ₹{item.price}
                  </div>
                </div>
                {selectedItems.some(si => si.productId === item.product._id) && (
                  <div>
                    <label style={{ fontSize: '14px', marginRight: '8px' }}>Return Qty:</label>
                    <input
                      type="number"
                      min="1"
                      max={item.quantity}
                      value={selectedItems.find(si => si.productId === item.product._id)?.quantity || 1}
                      onChange={(e) => handleQuantityChange(item.product._id, parseInt(e.target.value))}
                      className="input"
                      style={{ width: '80px' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Return Reason */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Return Reason</h3>
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ marginBottom: '16px' }}
          >
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--text-secondary)', marginBottom: 8 }}>
              What would you like to do?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { value: 'return', title: 'Return for refund', desc: 'Send the item back and be refunded to the original payment method.' },
                { value: 'exchange', title: 'Exchange', desc: 'Swap for another size or colour of the same product.' }
              ].map((opt) => {
                const disabled = opt.value === 'exchange' && exchangeBlocked;
                return (
                  <label
                    key={opt.value}
                    title={disabled ? 'One or more selected items cannot be exchanged' : ''}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: `1px solid ${requestType === opt.value ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 10, background: requestType === opt.value ? 'var(--brand-tint)' : 'var(--bg-white)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
                  >
                    <input
                      type="radio"
                      name="requestType"
                      value={opt.value}
                      checked={requestType === opt.value}
                      disabled={disabled}
                      onChange={() => setRequestType(opt.value)}
                      style={{ marginTop: 3, accentColor: 'var(--brand)' }}
                    />
                    <span>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{opt.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{opt.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
            <option value="">Select a reason</option>
            <option value="Defective product">Defective product</option>
            <option value="Wrong item received">Wrong item received</option>
            <option value="Not as described">Not as described</option>
            <option value="Size/fit issue">Size/fit issue</option>
            <option value="Changed mind">Changed mind</option>
            <option value="Better price available">Better price available</option>
            <option value="Other">Other</option>
          </select>

          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            Description (Optional)
          </label>
          <textarea
            className="input"
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide additional details about your return..."
          />
        </div>

        {/* Upload Images */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Upload Images (Optional)</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Upload up to 5 images showing the product condition
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            style={{ marginBottom: '16px' }}
          />
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {images.map((img, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <img
                    src={URL.createObjectURL(img)}
                    alt={`Upload ${index + 1}`}
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                  />
                  <button
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {submitting ? 'Submitting...' : 'Submit Return Request'}
          </button>
          <button
            onClick={() => navigate('/orders')}
            className="btn btn-outline"
          >
            Cancel
          </button>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default CustomerReturnPortal;
