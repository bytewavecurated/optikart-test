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
  const [showBulkSellerUpload, setShowBulkSellerUpload] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    category: 'sunglasses',
    brand: '',
    images: [''],
    colors: [],
    sizes: [],
    stock: 0,
    gender: 'unisex',
    frameSize: 'medium'
  });
  const [newSeller, setNewSeller] = useState({
    name: '',
    email: '',
    phone: '',
    storeName: '',
    storeAddress: { street: '', city: '', state: '', pincode: '' },
    manufacturerCode: '',
    gstNumber: '',
    panNumber: '',
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branchName: ''
    }
  });
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

  const handleAddProduct = async () => {
    try {
      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        images: newProduct.images.filter(img => img.trim() !== '')
      };
      
      await api.post('/manufacturer/products', productData);
      toast.success('Product added successfully');
      setShowAddProduct(false);
      setNewProduct({
        title: '',
        description: '',
        price: '',
        category: 'sunglasses',
        brand: '',
        images: [''],
        colors: [],
        sizes: [],
        stock: 0,
        gender: 'unisex',
        frameSize: 'medium'
      });
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add product');
    }
  };

  const handleAddSeller = async () => {
    try {
      await api.post('/manufacturer/sellers', newSeller);
      toast.success('Seller added successfully. Credentials sent to their email.');
      setShowAddSeller(false);
      setNewSeller({
        name: '',
        email: '',
        phone: '',
        storeName: '',
        storeAddress: { street: '', city: '', state: '', pincode: '' },
        manufacturerCode: '',
        gstNumber: '',
        panNumber: '',
        bankDetails: {
          accountNumber: '',
          ifscCode: '',
          bankName: '',
          branchName: ''
        }
      });
      fetchSellers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add seller');
    }
  };

  const handleBulkSellerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/manufacturer/sellers/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(response.data.message);
      setShowBulkSellerUpload(false);
      fetchSellers();
    } catch (error) {
      if (error.response?.data?.errors) {
        toast.error(`Validation errors: ${error.response.data.errors.join(', ')}`);
      } else {
        toast.error('Failed to upload sellers');
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
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowBulkSellerUpload(true)}
                style={{ padding: '10px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiUpload /> Bulk Upload
              </button>
              <button
                onClick={() => setShowAddSeller(true)}
                style={{ padding: '10px 20px', background: '#f5576c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiPlus /> Add Seller
              </button>
            </div>
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

      {/* Add Product Modal */}
      {showAddProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Add New Product</h2>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Product Title *</label>
                <input
                  type="text"
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({...newProduct, title: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Enter product title"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Description *</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', minHeight: '100px' }}
                  placeholder="Enter product description"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Price *</label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="₹0.00"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Stock *</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Category *</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  >
                    <option value="sunglasses">Sunglasses</option>
                    <option value="eyeglasses">Eyeglasses</option>
                    <option value="contactlenses">Contact Lenses</option>
                    <option value="readingglasses">Reading Glasses</option>
                    <option value="sportseyewear">Sports Eyewear</option>
                    <option value="kids">Kids</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Brand *</label>
                  <input
                    type="text"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({...newProduct, brand: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Brand name"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Gender</label>
                  <select
                    value={newProduct.gender}
                    onChange={(e) => setNewProduct({...newProduct, gender: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  >
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="unisex">Unisex</option>
                    <option value="kids">Kids</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Frame Size</label>
                  <select
                    value={newProduct.frameSize}
                    onChange={(e) => setNewProduct({...newProduct, frameSize: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="extra-large">Extra Large</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Image URLs (one per line)</label>
                <textarea
                  value={newProduct.images.join('\n')}
                  onChange={(e) => setNewProduct({...newProduct, images: e.target.value.split('\n')})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', minHeight: '80px' }}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Colors (comma separated)</label>
                <input
                  type="text"
                  value={newProduct.colors.join(', ')}
                  onChange={(e) => setNewProduct({...newProduct, colors: e.target.value.split(',').map(c => c.trim())})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Black, Brown, Gold"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Sizes (comma separated)</label>
                <input
                  type="text"
                  value={newProduct.sizes.join(', ')}
                  onChange={(e) => setNewProduct({...newProduct, sizes: e.target.value.split(',').map(s => s.trim())})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Small, Medium, Large"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleAddProduct}
                style={{ flex: 1, padding: '12px', background: '#f5576c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Add Product
              </button>
              <button
                onClick={() => setShowAddProduct(false)}
                style={{ flex: 1, padding: '12px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Seller Modal */}
      {showAddSeller && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Add New Seller</h2>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Seller Name *</label>
                  <input
                    type="text"
                    value={newSeller.name}
                    onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Email *</label>
                  <input
                    type="email"
                    value={newSeller.email}
                    onChange={(e) => setNewSeller({...newSeller, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="seller@email.com"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Phone *</label>
                  <input
                    type="tel"
                    value={newSeller.phone}
                    onChange={(e) => setNewSeller({...newSeller, phone: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="+91 9876543210"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Store Name *</label>
                  <input
                    type="text"
                    value={newSeller.storeName}
                    onChange={(e) => setNewSeller({...newSeller, storeName: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Store name"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Manufacturer Code *</label>
                <input
                  type="text"
                  value={newSeller.manufacturerCode}
                  onChange={(e) => setNewSeller({...newSeller, manufacturerCode: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Unique code from manufacturer"
                />
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '16px' }}>Store Address</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Street</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.street}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, street: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>City</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.city}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, city: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="City"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>State</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.state}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, state: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="State"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Pincode</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.pincode}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, pincode: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Pincode"
                  />
                </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '16px' }}>Tax Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>GST Number *</label>
                  <input
                    type="text"
                    value={newSeller.gstNumber}
                    onChange={(e) => setNewSeller({...newSeller, gstNumber: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="GST number"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>PAN Number *</label>
                  <input
                    type="text"
                    value={newSeller.panNumber}
                    onChange={(e) => setNewSeller({...newSeller, panNumber: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="PAN number"
                  />
                </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '16px' }}>Bank Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Account Number *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.accountNumber}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, accountNumber: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Account number"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>IFSC Code *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.ifscCode}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, ifscCode: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="IFSC code"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Bank Name *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.bankName}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, bankName: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Bank name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Branch Name *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.branchName}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, branchName: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Branch name"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleAddSeller}
                style={{ flex: 1, padding: '12px', background: '#f5576c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Add Seller
              </button>
              <button
                onClick={() => setShowAddSeller(false)}
                style={{ flex: 1, padding: '12px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Seller Upload Modal */}
      {showBulkSellerUpload && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '600px', width: '90%' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Bulk Upload Sellers</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', color: '#757575', marginBottom: '16px' }}>
                Upload an Excel/CSV file with the following columns:
              </p>
              <ul style={{ fontSize: '13px', color: '#424242', lineHeight: '1.8', paddingLeft: '20px' }}>
                <li>name - Seller's full name</li>
                <li>email - Seller's email address</li>
                <li>phone - Phone number</li>
                <li>storeName - Store name</li>
                <li>manufacturerCode - Unique code from manufacturer</li>
                <li>gstNumber - GST number</li>
                <li>panNumber - PAN number</li>
                <li>accountNumber - Bank account number</li>
                <li>ifscCode - Bank IFSC code</li>
                <li>bankName - Bank name</li>
                <li>branchName - Branch name</li>
                <li>street, city, state, pincode - Store address (optional)</li>
              </ul>
              <p style={{ fontSize: '13px', color: '#f5576c', marginTop: '16px', fontWeight: '500' }}>
                Note: Password will be auto-generated and sent to each seller's email.
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', padding: '40px', border: '2px dashed #e0e0e0', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleBulkSellerUpload}
                  style={{ display: 'none' }}
                />
                <FiUpload size={48} style={{ color: '#757575', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', color: '#757575', margin: 0 }}>Click to upload Excel/CSV file</p>
              </label>
            </div>

            <button
              onClick={() => setShowBulkSellerUpload(false)}
              style={{ width: '100%', padding: '12px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
