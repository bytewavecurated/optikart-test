import React, { useState, useEffect } from 'react';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { FiUpload, FiTrash2, FiEdit2, FiImage } from 'react-icons/fi';
import { toastError } from '../../services/errors.js';

const BannerManagement = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    link: '',
    discountType: 'percentage',
    discountValue: '',
    minPrice: '',
    maxPrice: '',
    startDate: '',
    endDate: '',
    isActive: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await adminApi.getBanners();
      setBanners(res.data.banners || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toastError(error, "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!imageFile && !editingBanner) {
      toast.error('Please select an image');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('subtitle', formData.subtitle);
      formDataToSend.append('link', formData.link);
      formDataToSend.append('discountType', formData.discountType);
      formDataToSend.append('discountValue', formData.discountValue);
      formDataToSend.append('minPrice', formData.minPrice);
      formDataToSend.append('maxPrice', formData.maxPrice);
      formDataToSend.append('startDate', formData.startDate);
      formDataToSend.append('endDate', formData.endDate);
      formDataToSend.append('isActive', formData.isActive);
      
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      let res;
      if (editingBanner) {
        res = await adminApi.updateBanner(editingBanner._id, formDataToSend);
        toast.success('Banner updated successfully');
      } else {
        res = await adminApi.createBanner(formDataToSend);
        toast.success('Banner created successfully');
      }

      setShowForm(false);
      setEditingBanner(null);
      setFormData({
        title: '',
        subtitle: '',
        link: '',
        discountType: 'percentage',
        discountValue: '',
        minPrice: '',
        maxPrice: '',
        startDate: '',
        endDate: '',
        isActive: true
      });
      setImageFile(null);
      setImagePreview(null);
      fetchBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      toastError(error, "Failed to save banner");
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      link: banner.linkUrl || '',
      discountType: banner.discount?.kind || 'percentage',
      discountValue: banner.discount?.value ?? '',
      minPrice: banner.discount?.minPrice || '',
      maxPrice: banner.discount?.maxPrice || '',
      startDate: banner.discount?.startDate ? new Date(banner.discount.startDate).toISOString().split('T')[0] : '',
      endDate: banner.discount?.endDate ? new Date(banner.discount.endDate).toISOString().split('T')[0] : '',
      isActive: banner.isActive !== false
    });
    setImagePreview(banner.images?.desktop?.url || '');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) {
      return;
    }

    try {
      await adminApi.deleteBanner(id);
      toast.success('Banner deleted successfully');
      fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toastError(error, "Failed to delete banner");
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Banner Management</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage homepage banners and promotional content</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <FiUpload /> Upload New Banner
          </button>
        </div>

        {/* Banner Form */}
        {showForm && (
          <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>
              {editingBanner ? 'Edit Banner' : 'Upload New Banner'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div className="input-group">
                    <label>Banner Image *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="input"
                    />
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        style={{ marginTop: '12px', maxWidth: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    )}
                  </div>

                  <div className="input-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Subtitle</label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div className="input-group">
                    <label>Link URL</label>
                    <input
                      type="text"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="input"
                      placeholder="/products?category=sunglasses"
                    />
                  </div>
                </div>

                <div>
                  <div className="input-group">
                    <label>Discount Type</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="input"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="none">No Discount</option>
                    </select>
                  </div>

                  {formData.discountType !== 'none' && (
                    <div className="input-group">
                      <label>Discount Value</label>
                      <input
                        type="number"
                        value={formData.discountValue}
                        onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                        className="input"
                        placeholder={formData.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Min Price (₹)</label>
                      <input
                        type="number"
                        value={formData.minPrice}
                        onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div className="input-group">
                      <label>Max Price (₹)</label>
                      <input
                        type="number"
                        value={formData.maxPrice}
                        onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div className="input-group">
                      <label>End Date</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingBanner ? 'Update Banner' : 'Upload Banner'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingBanner(null);
                    setFormData({
                      title: '',
                      subtitle: '',
                      link: '',
                      discountType: 'percentage',
                      discountValue: '',
                      minPrice: '',
                      maxPrice: '',
                      startDate: '',
                      endDate: '',
                      isActive: true
                    });
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Banners List */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {banners.length === 0 ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <FiImage size={64} style={{ color: 'var(--text-light)', marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No banners uploaded yet</p>
            </div>
          ) : (
            banners.map((banner) => (
              <div key={banner._id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <img
                    src={banner.images?.desktop?.url || banner.images?.mobile?.url || banner.image}
                    alt={banner.title}
                    style={{ width: '200px', height: '120px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>{banner.title}</h3>
                        {banner.subtitle && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{banner.subtitle}</p>
                        )}
                      </div>
                      <span className={`badge ${banner.isActive ? 'badge-success' : 'badge-default'}`}>
                        {banner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {banner.discountType !== 'none' && (
                      <div style={{ marginBottom: '12px' }}>
                        <span className="badge badge-warning">
                          {banner.discountType === 'percentage' 
                            ? `${banner.discountValue}% OFF`
                            : `₹${banner.discountValue} OFF`
                          }
                        </span>
                        {(banner.minPrice || banner.maxPrice) && (
                          <span style={{ marginLeft: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            {banner.minPrice && `Min: ₹${banner.minPrice}`}
                            {banner.minPrice && banner.maxPrice && ' - '}
                            {banner.maxPrice && `Max: ₹${banner.maxPrice}`}
                          </span>
                        )}
                      </div>
                    )}

                    {banner.startDate && banner.endDate && (
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Valid: {new Date(banner.startDate).toLocaleDateString()} - {new Date(banner.endDate).toLocaleDateString()}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => handleEdit(banner)} className="btn btn-sm btn-outline">
                        <FiEdit2 /> Edit
                      </button>
                      <button onClick={() => handleDelete(banner._id)} className="btn btn-sm btn-danger">
                        <FiTrash2 /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default BannerManagement;
