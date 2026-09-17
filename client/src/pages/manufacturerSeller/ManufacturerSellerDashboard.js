import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPackage, FiToggleLeft, FiToggleRight, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ManufacturerSellerDashboard = () => {
  const [availableProducts, setAvailableProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { manufacturerSeller, manufacturerSellerLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAvailableProducts();
    fetchMyProducts();
  }, []);

  const fetchAvailableProducts = async () => {
    try {
      const response = await api.get('/manufacturer-seller/available-products');
      setAvailableProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching available products:', error);
    }
  };

  const fetchMyProducts = async () => {
    try {
      const response = await api.get('/manufacturer-seller/products');
      setMyProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching my products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    manufacturerSellerLogout();
    navigate('/manufacturer-seller/login');
  };

  const handleToggleProduct = async (productId, productData) => {
    const isInInventory = myProducts.some(p => p.manufacturerProduct === productId);

    try {
      if (isInInventory) {
        await api.post(`/manufacturer-seller/products/${productId}/toggle`, {});
        toast.success('Product removed from inventory');
      } else {
        await api.post(`/manufacturer-seller/products/${productId}/toggle`, {
          price: productData.price,
          stock: 100,
          colors: productData.colors,
          sizes: productData.sizes
        });
        toast.success('Product added to inventory');
      }
      fetchMyProducts();
    } catch (error) {
      toast.error('Failed to toggle product');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const myProductIds = myProducts.map(p => p.manufacturerProduct);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#212121' }}>My Inventory</h1>
          <p style={{ margin: '4px 0 0', color: '#757575', fontSize: '14px' }}>
            {manufacturerSeller?.storeName} | ID: {manufacturerSeller?.manufacturerSellerId}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#212121' }}>{manufacturerSeller?.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#757575' }}>{manufacturerSeller?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e3f2fd', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2196f3' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>Available Products</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{availableProducts.length}</h3>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#e8f5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#757575' }}>My Products</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#212121' }}>{myProducts.length}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Available Products from Manufacturer */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: '#212121' }}>
            Available Products from Manufacturer
          </h2>

          {availableProducts.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#757575', padding: '40px' }}>No products available from your manufacturer yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {availableProducts.map((product) => {
                const isInInventory = myProductIds.includes(product._id);
                
                return (
                  <div key={product._id} style={{ background: '#f9f9f9', borderRadius: '12px', padding: '16px', border: isInInventory ? '2px solid #4caf50' : '2px solid #e0e0e0' }}>
                    {product.images?.[0] && (
                      <img 
                        src={product.images[0]} 
                        alt={product.title} 
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} 
                      />
                    )}
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#212121' }}>{product.title}</h3>
                    <p style={{ fontSize: '14px', color: '#757575', marginBottom: '8px' }}>Brand: {product.brand}</p>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#212121', marginBottom: '12px' }}>₹{product.price}</p>
                    <p style={{ fontSize: '12px', color: '#757575', marginBottom: '16px' }}>
                      Colors: {product.colors?.map(c => c.name).join(', ') || 'N/A'}
                    </p>
                    <p style={{ fontSize: '12px', color: '#757575', marginBottom: '16px' }}>
                      Sizes: {product.sizes?.join(', ') || 'N/A'}
                    </p>
                    <button
                      onClick={() => handleToggleProduct(product._id, product)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: isInInventory ? '#f44336' : '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontWeight: '600'
                      }}
                    >
                      {isInInventory ? (
                        <>
                          <FiToggleRight size={20} /> Remove from Inventory
                        </>
                      ) : (
                        <>
                          <FiToggleLeft size={20} /> Add to Inventory
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
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

export default ManufacturerSellerDashboard;
