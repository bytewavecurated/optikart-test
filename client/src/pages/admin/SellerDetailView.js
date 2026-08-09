import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiCalendar, FiPackage, FiShoppingBag, FiDollarSign, FiMapPin, FiTrash2, FiShield, FiEye, FiEyeOff, FiStar, FiCheckCircle } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const SellerDetailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerDetails();
  }, [id]);

  const fetchSellerDetails = async () => {
    try {
      const [sellerRes, productsRes, ordersRes] = await Promise.all([
        adminApi.getSellerById(id),
        adminApi.getSellerProducts(id),
        adminApi.getSellerOrders(id)
      ]);
      setSeller(sellerRes.data.data);
      setProducts(productsRes.data.data || []);
      setOrders(ordersRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load seller details');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!window.confirm('Are you sure you want to verify this seller?')) return;
    try {
      await adminApi.verifySeller(id, true);
      toast.success('Seller verified successfully');
      fetchSellerDetails();
    } catch (err) {
      toast.error('Failed to verify seller');
    }
  };

  const handleBan = async (banType) => {
    const action = banType === 'ban' ? 'ban' : banType === 'shadow' ? 'shadow ban' : 'unban';
    if (!window.confirm(`Are you sure you want to ${action} this seller?`)) return;
    
    try {
      await adminApi.banSeller(id, { 
        isBanned: banType === 'ban',
        isShadowBanned: banType === 'shadow',
        banReason: banType !== 'unban' ? 'Banned by admin' : ''
      });
      toast.success(`Seller ${action}ned successfully`);
      fetchSellerDetails();
    } catch (err) {
      toast.error('Failed to update seller status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this seller and all their products? This cannot be undone.')) return;
    try {
      await adminApi.deleteSeller(id);
      toast.success('Seller deleted successfully');
      navigate('/admin/sellers');
    } catch (err) {
      toast.error('Failed to delete seller');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner spinner-lg" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!seller) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <div className="container page-wrapper" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h2>Seller not found</h2>
            <button onClick={() => navigate('/admin/sellers')} className="btn btn-primary" style={{ marginTop: '20px' }}>
              Back to Sellers
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const completedOrders = orders.filter(o => o.orderStatus === 'delivered').length;
  const avgRating = seller.rating || 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <button onClick={() => navigate('/admin/sellers')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
            <FiArrowLeft /> Back to Sellers
          </button>

          {/* Seller Info Card */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--secondary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>
                  {(seller.storeName || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{seller.storeName}</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Seller ID: {seller.sellerId || seller._id}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {seller.isVerified && (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiCheckCircle size={12} /> Verified
                      </span>
                    )}
                    {avgRating > 0 && (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#fff3e0', color: '#e65100', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiStar size={12} /> {avgRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!seller.isVerified && (
                  <button onClick={handleVerify} className="btn btn-primary btn-sm" style={{ fontSize: '12px' }}>
                    <FiCheckCircle size={14} /> Verify
                  </button>
                )}
                {!seller.isBanned && !seller.isShadowBanned && (
                  <>
                    <button onClick={() => handleBan('shadow')} className="btn btn-outline btn-sm" style={{ fontSize: '12px' }}>
                      <FiEyeOff size={14} /> Shadow Ban
                    </button>
                    <button onClick={() => handleBan('ban')} className="btn btn-danger btn-sm" style={{ fontSize: '12px' }}>
                      <FiShield size={14} /> Ban Seller
                    </button>
                  </>
                )}
                {(seller.isBanned || seller.isShadowBanned) && (
                  <button onClick={() => handleBan('unban')} className="btn btn-primary btn-sm" style={{ fontSize: '12px' }}>
                    <FiEye size={14} /> Unban Seller
                  </button>
                )}
                <button onClick={handleDelete} className="btn btn-danger btn-sm" style={{ fontSize: '12px' }}>
                  <FiTrash2 size={14} /> Delete
                </button>
              </div>
            </div>

            {seller.isBanned && (
              <div style={{ background: '#ffebee', border: '1px solid #ef5350', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ color: '#c62828', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>⚠️ Seller is Banned</p>
                <p style={{ color: '#c62828', fontSize: '12px' }}>Reason: {seller.banReason || 'No reason provided'}</p>
                <p style={{ color: '#c62828', fontSize: '12px' }}>Banned on: {new Date(seller.bannedAt).toLocaleDateString()}</p>
              </div>
            )}

            {seller.isShadowBanned && !seller.isBanned && (
              <div style={{ background: '#fff3e0', border: '1px solid #ff9800', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
                <p style={{ color: '#e65100', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>⚠️ Seller is Shadow Banned</p>
                <p style={{ color: '#e65100', fontSize: '12px' }}>Seller can still access the platform but with limited visibility</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Owner Name</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiUser size={14} /> {seller.name}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Email</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiMail size={14} /> {seller.email}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Phone</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPhone size={14} /> {seller.phone}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Joined</p>
                <p style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiCalendar size={14} /> {new Date(seller.createdAt).toLocaleDateString()}
                </p>
              </div>
              {seller.gstNumber && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>GST Number</p>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{seller.gstNumber}</p>
                </div>
              )}
              {seller.panNumber && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>PAN Number</p>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{seller.panNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Total Products</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{products.length}</p>
                </div>
                <FiShoppingBag size={32} style={{ color: 'var(--primary)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Total Orders</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</p>
                </div>
                <FiPackage size={32} style={{ color: 'var(--primary)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Total Revenue</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>₹{totalRevenue.toLocaleString()}</p>
                </div>
                <FiDollarSign size={32} style={{ color: 'var(--success)', opacity: 0.3 }} />
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Completed Orders</p>
                  <p style={{ fontSize: '24px', fontWeight: 700 }}>{completedOrders}</p>
                </div>
                <FiCheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.3 }} />
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Products ({products.length})</h3>
            {products.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>No products found</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                      {['Product', 'Category', 'Price', 'Stock', 'Status'].map(h => (
                        <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 10).map(product => (
                      <tr key={product._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 500 }}>{product.title}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{product.category}</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600 }}>₹{product.price?.toLocaleString()}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{product.stock || 0}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 600,
                            background: product.isActive ? '#e8f5e9' : '#ffebee',
                            color: product.isActive ? '#2e7d32' : '#c62828'
                          }}>
                            {product.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length > 10 && (
                  <p style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--text-light)' }}>
                    Showing 10 of {products.length} products
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Orders Table */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Recent Orders ({orders.length})</h3>
            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>No orders found</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                      {['Order ID', 'Customer', 'Date', 'Items', 'Amount', 'Status'].map(h => (
                        <th key={h} style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map(order => (
                      <tr key={order._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 500 }}>#{order.orderNumber || order._id.slice(-6)}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{order.user?.name || 'N/A'}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px', fontSize: '13px' }}>{order.items?.length || 0} items</td>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: 600 }}>₹{order.totalAmount?.toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px', 
                            fontWeight: 600,
                            background: order.orderStatus === 'delivered' ? '#e8f5e9' : order.orderStatus === 'cancelled' ? '#ffebee' : '#fff3e0',
                            color: order.orderStatus === 'delivered' ? '#2e7d32' : order.orderStatus === 'cancelled' ? '#c62828' : '#e65100'
                          }}>
                            {order.orderStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length > 10 && (
                  <p style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: 'var(--text-light)' }}>
                    Showing 10 of {orders.length} orders
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerDetailView;
