import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiMapPin, FiEdit2, FiTrash2, FiPlus, FiPackage, FiHeart, FiLogOut, FiFileText, FiCheck } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const UserProfile = () => {
  const { user, isAuthenticated, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    isDefault: false
  });

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
    }
  }, [isAuthenticated]);

  const fetchAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const res = await auth.getAddresses();
      if (res.data.success) {
        setAddresses(res.data.addresses || []);
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSaveProfile = async () => {
    const result = await updateProfile({
      name: formData.name,
      phone: formData.phone,
    });
    if (result.success) {
      setEditing(false);
      toast.success('Profile updated!');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSaveAddress = async () => {
    if (!addressForm.street || !addressForm.city || !addressForm.state || !addressForm.pincode || !addressForm.phone) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (editingAddressId) {
        const res = await auth.updateAddress(editingAddressId, addressForm);
        if (res.data.success) {
          setAddresses(res.data.addresses || []);
          toast.success('Address updated!');
        }
      } else {
        const res = await auth.addAddress(addressForm);
        if (res.data.success) {
          setAddresses(res.data.addresses || []);
          toast.success('Address added!');
        }
      }
      resetAddressForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      const res = await auth.deleteAddress(addressId);
      if (res.data.success) {
        setAddresses(res.data.addresses || []);
        toast.success('Address deleted');
      }
    } catch (err) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const res = await auth.updateAddress(addressId, { isDefault: true });
      if (res.data.success) {
        setAddresses(res.data.addresses || []);
        toast.success('Default address updated');
      }
    } catch (err) {
      toast.error('Failed to update default address');
    }
  };

  const handleEditAddress = (addr) => {
    setEditingAddressId(addr._id);
    setAddressForm({
      name: addr.name || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      phone: addr.phone || '',
      isDefault: addr.isDefault || false
    });
    setShowAddressForm(true);
  };

  const resetAddressForm = () => {
    setAddressForm({ name: '', street: '', city: '', state: '', pincode: '', phone: '', isDefault: false });
    setEditingAddressId(null);
    setShowAddressForm(false);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper">
          <div className="empty-state">
            <FiUser style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
            <h3>Please login to view profile</h3>
            <Link to="/login" className="btn btn-primary">Login</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const menuItems = [
    { icon: <FiUser />, label: 'Profile', key: 'profile' },
    { icon: <FiMapPin />, label: 'Saved Addresses', key: 'addresses' },
    { icon: <FiPackage />, label: 'My Orders', path: '/orders' },
    { icon: <FiHeart />, label: 'Wishlist', path: '/wishlist' },
    { icon: <FiFileText />, label: 'Prescriptions', path: '/prescription' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '16px', alignItems: 'start' }} className="profile-grid">
            {/* Sidebar */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{user?.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{user?.email}</p>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {menuItems.map((item) => (
                  item.path ? (
                    <Link key={item.path} to={item.path} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '4px', fontSize: '14px', color: 'var(--text-primary)', textDecoration: 'none', transition: 'background 0.2s' }}>
                      {item.icon} {item.label}
                    </Link>
                  ) : (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '4px', fontSize: '14px',
                        color: activeTab === item.key ? 'var(--primary)' : 'var(--text-primary)',
                        background: activeTab === item.key ? 'var(--primary-light, #e3f0ff)' : 'transparent',
                        fontWeight: activeTab === item.key ? 600 : 400,
                        cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%'
                      }}
                    >
                      {item.icon} {item.label}
                    </button>
                  )
                ))}
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '4px', fontSize: '14px', color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <FiLogOut /> Logout
                </button>
              </nav>
            </div>

            {/* Main Content */}
            <div>
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Profile Information</h2>
                    {!editing && (
                      <button onClick={() => setEditing(true)} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FiEdit2 size={14} /> Edit</button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="profile-form-grid">
                    <div className="input-group">
                      <label><FiUser size={14} style={{ marginRight: '6px' }} />Full Name</label>
                      <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={!editing} />
                    </div>
                    <div className="input-group">
                      <label><FiMail size={14} style={{ marginRight: '6px' }} />Email</label>
                      <input className="input" value={formData.email} disabled style={{ background: 'var(--bg-primary)' }} />
                    </div>
                    <div className="input-group">
                      <label><FiPhone size={14} style={{ marginRight: '6px' }} />Phone</label>
                      <input className="input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={!editing} />
                    </div>
                  </div>

                  {editing && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <button onClick={handleSaveProfile} className="btn btn-primary">Save Changes</button>
                      <button onClick={() => setEditing(false)} className="btn btn-outline">Cancel</button>
                    </div>
                  )}
                </div>
              )}

              {/* Addresses Tab */}
              {activeTab === 'addresses' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Saved Addresses</h2>
                    {!showAddressForm && (
                      <button onClick={() => setShowAddressForm(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiPlus size={14} /> Add Address
                      </button>
                    )}
                  </div>

                  {/* Address Form */}
                  {showAddressForm && (
                    <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
                        {editingAddressId ? 'Edit Address' : 'Add New Address'}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="address-form-grid">
                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label>Recipient Name</label>
                          <input className="input" value={addressForm.name} onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })} placeholder={user?.name || 'Full Name'} />
                        </div>
                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label>Phone Number *</label>
                          <input className="input" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} placeholder="10-digit number" />
                        </div>
                        <div className="input-group" style={{ marginBottom: '12px', gridColumn: 'span 2' }}>
                          <label>Street Address *</label>
                          <textarea className="input" rows={2} value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} placeholder="House no., Street, Area" />
                        </div>
                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label>City *</label>
                          <input className="input" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} placeholder="City" />
                        </div>
                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label>State *</label>
                          <input className="input" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} placeholder="State" />
                        </div>
                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label>Pincode *</label>
                          <input className="input" value={addressForm.pincode} onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })} placeholder="6-digit pincode" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <input type="checkbox" id="defaultAddr" checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                          <label htmlFor="defaultAddr" style={{ fontSize: '13px', cursor: 'pointer' }}>Set as default address</label>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button onClick={handleSaveAddress} className="btn btn-primary btn-sm">Save</button>
                        <button onClick={resetAddressForm} className="btn btn-outline btn-sm">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Addresses List */}
                  {loadingAddresses ? (
                    <div style={{ textAlign: 'center', padding: '30px' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </div>
                  ) : addresses.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {addresses.map((addr) => (
                        <div key={addr._id} style={{ padding: '16px', border: `1px solid ${addr.isDefault ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', position: 'relative', background: addr.isDefault ? 'var(--primary-light, #f0f6ff)' : '#fff' }}>
                          {addr.isDefault && (
                            <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 8px', background: 'var(--primary)', color: '#fff', borderRadius: '3px', textTransform: 'uppercase' }}>Default</span>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{addr.name || user?.name}</p>
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {addr.street}<br />
                                {addr.city}, {addr.state} - {addr.pincode}
                              </p>
                              <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
                                <FiPhone size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{addr.phone}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              <button onClick={() => handleEditAddress(addr)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                <FiEdit2 size={12} /> Edit
                              </button>
                              <button onClick={() => handleDeleteAddress(addr._id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: '#fff', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--danger)' }}>
                                <FiTrash2 size={12} /> Delete
                              </button>
                              {!addr.isDefault && (
                                <button onClick={() => handleSetDefault(addr._id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: '#fff', border: '1px solid var(--primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--primary)' }}>
                                  <FiCheck size={12} /> Default
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !showAddressForm ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <FiMapPin style={{ fontSize: '40px', color: 'var(--text-light)', marginBottom: '12px' }} />
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>No saved addresses yet</p>
                      <button onClick={() => setShowAddressForm(true)} className="btn btn-primary btn-sm">Add Your First Address</button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr !important; }
          .profile-form-grid { grid-template-columns: 1fr !important; }
          .address-form-grid { grid-template-columns: 1fr !important; }
          .address-form-grid > div[style*="grid-column: span 2"] { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
};

export default UserProfile;
