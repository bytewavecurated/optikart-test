import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPackage, FiUsers, FiPlus, FiUpload, FiLogOut, FiEdit, FiTrash2, FiEye } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ManufacturerDashboard = () => {
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSeller, setShowAddSeller] = useState(false);
  const { manufacturer, manufacturerLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    fetchSellers();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/manufacturer/products');
      setProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const response = await api.get('/manufacturer/sellers');
      setSellers(response.data.sellers);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const handleLogout = () => {
    manufacturerLogout();
    navigate('/manufacturer/login');
  };

  const handleDiscontinue = async (productId) => {
    if (!window.confirm('Are you sure you want to discontinue this product? It will be removed from all seller dashboards.')) {
      return;
    }

    try {
      await api.post(`/manufacturer/products/${productId}/discontinue`);
      toast.success('Product discontinued successfully');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to discontinue product');
    }
  };

  const handleRecontinue = async (productId) => {
    try {
      await api.post(`/manufacturer/products/${productId}/recontinue`);
      toast.success('Product re-continued successfully');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to re-continue product');
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/manufacturer/products/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message);
      fetchProducts();
    } catch (error) {
      if (error.response?.data?.errors) {
        toast.error(`Validation errors: ${error.response.data.errors.join(', ')}`);
      } else {
        toast.error('Failed to upload products');
      }
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #f5576c', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#212121' }}>Manufacturer Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#757575', fontSize: '14px' }}>
            {manufacturer?.companyName} | ID: {manufacturer?.manufacturerId}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#212121' }}>{manufacturer?.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#757575' }}>{manufacturer?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#fce4ec', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5576c' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Total Products</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{products.filter(p => !p.isDiscontinued).length}</h3>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50' }}>
                <FiUsers size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Total Sellers</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{sellers.length}</h3>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#fff3e0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9800' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Discontinued</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{products.filter(p => p.isDiscontinued).length}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#212121' }}>Products</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ padding: '10px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiUpload /> Bulk Upload
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
              </label>
              <button
                onClick={() => setShowAddProduct(true)}
                style={{ padding: '10px 20px', background: '#f5576c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiPlus /> Add Product
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#757575', padding: '40px' }}>No products yet. Add your first product!</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Product</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Brand</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Price</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {product.images?.[0] && (
                            <img src={product.images[0]} alt={product.title} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />
                          )}
                          <span style={{ fontWeight: '500' }}>{product.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>{product.brand}</td>
                      <td style={{ padding: '12px' }}>₹{product.price}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: product.isDiscontinued ? '#ffebee' : '#e8f5e9',
                          color: product.isDiscontinued ? '#f44336' : '#4caf50'
                        }}>
                          {product.isDiscontinued ? 'Discontinued' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button style={{ padding: '6px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            <FiEye size={16} />
                          </button>
                          <button style={{ padding: '6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            <FiEdit size={16} />
                          </button>
                          {product.isDiscontinued ? (
                            <button 
                              onClick={() => handleRecontinue(product._id)}
                              style={{ padding: '6px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Re-continue
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleDiscontinue(product._id)}
                              style={{ padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sellers Section */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: '#212121' }}>Your Sellers</h2>
            <button
              onClick={() => setShowAddSeller(true)}
              style={{ padding: '10px 20px', background: '#f5576c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiPlus /> Add Seller
            </button>
          </div>

          {sellers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#757575', padding: '40px' }}>No sellers yet. Add your first seller!</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Seller</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Store Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#424242' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((seller) => (
                    <tr key={seller._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{seller.name}</td>
                      <td style={{ padding: '12px' }}>{seller.storeName}</td>
                      <td style={{ padding: '12px' }}>{seller.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: seller.isBanned ? '#ffebee' : '#e8f5e9',
                          color: seller.isBanned ? '#f44336' : '#4caf50'
                        }}>
                          {seller.isBanned ? 'Banned' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ManufacturerDashboard;
