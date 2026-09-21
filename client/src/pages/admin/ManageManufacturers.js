import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import toast from 'react-hot-toast';

const ManageManufacturers = () => {
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    phone: '',
    gstNumber: '',
    panNumber: '',
    address: { street: '', city: '', state: '', pincode: '' },
    brands: []
  });

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const fetchManufacturers = async () => {
    try {
      const res = await adminApi.getManufacturers();
      setManufacturers(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch manufacturers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await adminApi.createManufacturer(formData);
      toast.success('Manufacturer added successfully');
      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        companyName: '',
        phone: '',
        gstNumber: '',
        panNumber: '',
        address: { street: '', city: '', state: '', pincode: '' },
        brands: []
      });
      fetchManufacturers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add manufacturer');
    }
  };

  const handleEdit = async () => {
    try {
      await adminApi.updateManufacturer(editingManufacturer._id, formData);
      toast.success('Manufacturer updated successfully');
      setEditingManufacturer(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        companyName: '',
        phone: '',
        gstNumber: '',
        panNumber: '',
        address: { street: '', city: '', state: '', pincode: '' },
        brands: []
      });
      fetchManufacturers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update manufacturer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this manufacturer? This will also delete all their products and sellers.')) return;
    try {
      await adminApi.deleteManufacturer(id);
      toast.success('Manufacturer deleted successfully');
      fetchManufacturers();
    } catch (err) {
      toast.error('Failed to delete manufacturer');
    }
  };

  const handleBan = async (id, isBanned) => {
    try {
      await adminApi.banManufacturer(id, { isBanned, banReason: isBanned ? 'Banned by admin' : '' });
      toast.success(isBanned ? 'Manufacturer banned' : 'Manufacturer unbanned');
      fetchManufacturers();
    } catch (err) {
      toast.error('Failed to update manufacturer status');
    }
  };

  const filteredManufacturers = manufacturers.filter(mfr =>
    mfr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mfr.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mfr.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mfr.manufacturerId && mfr.manufacturerId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Manage Manufacturers</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '10px 20px',
            background: '#00bcd4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          <FiPlus /> Add Manufacturer
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9e9e9e' }} />
        <input
          type="text"
          placeholder="Search by name, email, company, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 10px 10px 40px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Manufacturer ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Company Name</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Contact Person</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#424242' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredManufacturers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#757575' }}>
                  No manufacturers found
                </td>
              </tr>
            ) : (
              filteredManufacturers.map((mfr) => (
                <tr key={mfr._id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{mfr.manufacturerId || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{mfr.companyName}</td>
                  <td style={{ padding: '12px' }}>{mfr.name}</td>
                  <td style={{ padding: '12px', color: '#757575' }}>{mfr.email}</td>
                  <td style={{ padding: '12px' }}>
                    {mfr.isBanned ? (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: '#ffebee',
                        color: '#c62828'
                      }}>
                        Banned
                      </span>
                    ) : (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: '#e8f5e9',
                        color: '#2e7d32'
                      }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setEditingManufacturer(mfr);
                          setFormData({
                            name: mfr.name,
                            email: mfr.email,
                            password: '',
                            companyName: mfr.companyName,
                            phone: mfr.phone,
                            gstNumber: mfr.gstNumber || '',
                            panNumber: mfr.panNumber || '',
                            address: mfr.address || { street: '', city: '', state: '', pincode: '' },
                            brands: mfr.brands || []
                          });
                        }}
                        style={{ padding: '6px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Edit"
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleBan(mfr._id, !mfr.isBanned)}
                        style={{ padding: '6px', background: mfr.isBanned ? '#4caf50' : '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title={mfr.isBanned ? 'Unban' : 'Ban'}
                      >
                        {mfr.isBanned ? <FiEye size={16} /> : <FiEyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(mfr._id)}
                        style={{ padding: '6px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingManufacturer) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
              {editingManufacturer ? 'Edit Manufacturer' : 'Add New Manufacturer'}
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Contact Person Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Contact person name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Company Name *</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="manufacturer@email.com"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              {!editingManufacturer && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Password"
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>GST Number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="GST number"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>PAN Number</label>
                  <input
                    type="text"
                    value={formData.panNumber}
                    onChange={(e) => setFormData({...formData, panNumber: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="PAN number"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Brands (comma separated)</label>
                <input
                  type="text"
                  value={formData.brands.join(', ')}
                  onChange={(e) => setFormData({...formData, brands: e.target.value.split(',').map(b => b.trim()).filter(b => b)})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Ray-Ban, Oakley, etc."
                />
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '16px' }}>Address</h3>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Street</label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => setFormData({...formData, address: {...formData.address, street: e.target.value}})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                  placeholder="Street address"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>City</label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="City"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>State</label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => setFormData({...formData, address: {...formData.address, state: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="State"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Pincode</label>
                  <input
                    type="text"
                    value={formData.address.pincode}
                    onChange={(e) => setFormData({...formData, address: {...formData.address, pincode: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px' }}
                    placeholder="Pincode"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={editingManufacturer ? handleEdit : handleAdd}
                style={{ flex: 1, padding: '12px', background: '#00bcd4', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                {editingManufacturer ? 'Update' : 'Add'} Manufacturer
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingManufacturer(null);
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    companyName: '',
                    phone: '',
                    gstNumber: '',
                    panNumber: '',
                    address: { street: '', city: '', state: '', pincode: '' },
                    brands: []
                  });
                }}
                style={{ flex: 1, padding: '12px', background: '#e0e0e0', color: '#212121', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageManufacturers;
