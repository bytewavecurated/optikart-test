import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiLink, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { banners } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const BannerManagement = () => {
  const [bannerList, setBannerList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    order: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await banners.getAll();
      if (response.data.success) {
        setBannerList(response.data.banners);
      }
    } catch (error) {
      toast.error('Failed to fetch banners');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.imageUrl || !formData.linkUrl) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (editingBanner) {
        await banners.update(editingBanner._id, formData);
        toast.success('Banner updated successfully');
      } else {
        await banners.create(formData);
        toast.success('Banner created successfully');
      }
      setShowForm(false);
      setEditingBanner(null);
      setFormData({ title: '', imageUrl: '', linkUrl: '', order: 0, isActive: true });
      fetchBanners();
    } catch (error) {
      toast.error('Failed to save banner');
      console.error(error);
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      order: banner.order,
      isActive: banner.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;

    try {
      await banners.delete(id);
      toast.success('Banner deleted successfully');
      fetchBanners();
    } catch (error) {
      toast.error('Failed to delete banner');
      console.error(error);
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      await banners.update(banner._id, { ...banner, isActive: !banner.isActive });
      toast.success(`Banner ${banner.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchBanners();
    } catch (error) {
      toast.error('Failed to update banner status');
      console.error(error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Banner Management</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingBanner(null);
              setFormData({ title: '', imageUrl: '', linkUrl: '', order: 0, isActive: true });
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiPlus /> Add Banner
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              {editingBanner ? 'Edit Banner' : 'Add New Banner'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group">
                <label>Title *</label>
                <input
                  className="input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Banner title"
                />
              </div>
              <div className="input-group">
                <label>Image URL *</label>
                <input
                  className="input"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="input-group">
                <label>Link URL *</label>
                <input
                  className="input"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  placeholder="/sale/summer or https://example.com"
                />
              </div>
              <div className="input-group">
                <label>Order (Display Priority)</label>
                <input
                  className="input"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Active (Show on homepage)
                </label>
              </div>
              {formData.imageUrl && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Preview:</label>
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      toast.error('Invalid image URL');
                    }}
                  />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={handleSave} className="btn btn-primary">
                {editingBanner ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingBanner(null);
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : bannerList.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <FiImage style={{ fontSize: '48px', color: 'var(--text-light)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No Banners Yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Click "Add Banner" to create your first homepage banner</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {bannerList.map((banner) => (
              <div key={banner._id} className="card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  style={{ width: '200px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect fill="%23ddd" width="200" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                  }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{banner.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <FiLink size={12} style={{ marginRight: '4px' }} />
                    {banner.linkUrl}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                    Order: {banner.order} | Status: {banner.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleToggleActive(banner)}
                    className="btn btn-outline btn-sm"
                    title={banner.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {banner.isActive ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                  </button>
                  <button onClick={() => handleEdit(banner)} className="btn btn-outline btn-sm">
                    <FiEdit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(banner._id)} className="btn btn-danger btn-sm">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BannerManagement;
