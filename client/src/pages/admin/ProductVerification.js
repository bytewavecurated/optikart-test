import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiFilter, FiSearch } from 'react-icons/fi';
import { toastError } from '../../services/errors.js';

const ProductVerification = () => {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brand: '', category: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [action, setAction] = useState(null); // 'verify' or 'reject'
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, statsRes] = await Promise.all([
        adminApi.getPendingProducts(filters),
        adminApi.getVerificationStats()
      ]);

      if (productsRes.data.success) {
        setProducts(productsRes.data.products);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toastError(error, "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const res = await adminApi.verifyProduct(selectedProduct._id, { notes });
      if (res.data.success) {
        toast.success('Product verified successfully');
        setSelectedProduct(null);
        setAction(null);
        setNotes('');
        fetchData();
      } else {
        toast.error(res.data.error || 'Failed to verify product');
      }
    } catch (error) {
      toastError(error, "Failed to verify product");
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      const res = await adminApi.rejectProduct(selectedProduct._id, { reason });
      if (res.data.success) {
        toast.success('Product marked for correction');
        setSelectedProduct(null);
        setAction(null);
        setReason('');
        fetchData();
      } else {
        toast.error(res.data.error || 'Failed to reject product');
      }
    } catch (error) {
      toastError(error, "Failed to reject product");
    }
  };

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
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)' }}>Product Verification</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review and verify manufacturer products</p>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pending</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--warning)' }}>{stats.pending}</div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Verified</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)' }}>{stats.verified}</div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Needs Correction</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--danger)' }}>{stats.data_incorrect}</div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Products</div>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{stats.total}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                <FiSearch style={{ marginRight: '4px' }} /> Brand
              </label>
              <input
                type="text"
                className="input"
                placeholder="Search by brand..."
                value={filters.brand}
                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                <FiFilter style={{ marginRight: '4px' }} /> Category
              </label>
              <select
                className="input"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All Categories</option>
                <option value="sunglasses">Sunglasses</option>
                <option value="eyeglasses">Eyeglasses</option>
                <option value="contactlenses">Contact Lenses</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products List */}
        {products.length === 0 ? (
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No pending products for verification</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {products.map((product) => (
              <div key={product._id} className="card">
                <img
                  src={product.images?.[0] || '/placeholder.png'}
                  alt={product.title}
                  style={{ width: '100%', height: '250px', objectFit: 'cover' }}
                />
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
                    {product.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Brand: {product.brand}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Category: {product.category}
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)', marginBottom: '16px' }}>
                    ₹{product.price}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => { setSelectedProduct(product); setAction('verify'); }}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <FiCheck size={14} /> Verify
                    </button>
                    <button
                      onClick={() => { setSelectedProduct(product); setAction('reject'); }}
                      className="btn btn-danger btn-sm"
                      style={{ flex: 1 }}
                    >
                      <FiX size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verification Modal */}
        {action === 'verify' && selectedProduct && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ padding: '24px', maxWidth: '500px', width: '90%' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Verify Product</h3>
              <p style={{ marginBottom: '16px' }}>Are you sure you want to verify "{selectedProduct.title}"?</p>
              <div className="input-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="input"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleVerify} className="btn btn-primary" style={{ flex: 1 }}>
                  Verify Product
                </button>
                <button onClick={() => { setAction(null); setSelectedProduct(null); }} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {action === 'reject' && selectedProduct && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ padding: '24px', maxWidth: '500px', width: '90%' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Reject Product</h3>
              <p style={{ marginBottom: '16px' }}>Please provide a reason for rejecting "{selectedProduct.title}":</p>
              <div className="input-group">
                <label>Reason *</label>
                <textarea
                  className="input"
                  rows="4"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Incorrect price, missing images, wrong category..."
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleReject} className="btn btn-danger" style={{ flex: 1 }}>
                  Reject Product
                </button>
                <button onClick={() => { setAction(null); setSelectedProduct(null); }} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default ProductVerification;
