import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPackage, FiUsers, FiPlus, FiUpload, FiLogOut, FiEdit, FiTrash2, FiEye, FiCamera, FiX } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { toastError } from '../../services/errors.js';

const ManufacturerDashboard = () => {
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSeller, setShowAddSeller] = useState(false);
  const [editingSeller, setEditingSeller] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({ companyName: '', phone: '', gstNumber: '', brands: [] });
  const [brandDraft, setBrandDraft] = useState('');
  const [showBulkSellerUpload, setShowBulkSellerUpload] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    category: 'sunglasses',
    kidsType: '',
    brand: '',
    images: [''],
    colors: [],
    sizes: [],
    stock: 0,
    gender: 'unisex',
    frameSize: '',
    frameShape: '',
    frameType: '',
    frameMaterial: '',
    frameColor: '',
    frameWidth: '',
    frameWeight: '',
    dimensions: '',
    modelNumber: '',
    productCode: '',
    warranty: '',
    subGender: '',
    ageGroup: '',
    poweredOptionsAvailable: false,
    prescriptionLensTypes: [],
    returnWindowDays: 7
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

  // Track unsaved changes
  /*
   * The old check compared a handful of fields against a hardcoded snapshot and
   * counted the form dirty the moment it opened, because defaults such as
   * category='sunglasses' and returnWindowDays=7 are not the empty string it
   * tested for - which meant every navigation away raised a leave-page dialog.
   * Dirty state is now tracked explicitly: set when the maker edits anything,
   * cleared on open, save or cancel.
   */
  /*
   * The guard used to compare a few fields against hardcoded empty strings, but
   * the form now has meaningful defaults (category, return window, ...), so it
   * considered the form dirty the instant it opened and raised a leave-page
   * dialog on every navigation. Compare against the pristine form instead.
   */
  const pristineProduct = useRef(newProduct);

  const MAX_PRODUCT_IMAGES = 10;
  const imageInputRef = useRef(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState('');

  const currentImages = () => (newProduct.images || []).filter((u) => String(u || '').trim());
  const setImageList = (list) => setNewProduct((p) => ({ ...p, images: list.length ? list : [''] }));

  const handleImageFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;

    const room = MAX_PRODUCT_IMAGES - currentImages().length;
    if (room <= 0) {
      toast.error(`A product can carry at most ${MAX_PRODUCT_IMAGES} images`);
      return;
    }
    const usable = picked.filter((file) => file.type.startsWith('image/'));
    if (!usable.length) {
      toast.error('Only image files can be uploaded');
      return;
    }
    if (usable.length > room) toast(`Adding ${room} of ${picked.length} selected photos (limit ${MAX_PRODUCT_IMAGES})`);

    const fd = new FormData();
    usable.slice(0, room).forEach((file) => fd.append('images', file));

    setUploadingImages(true);
    try {
      const res = await api.post('/manufacturer/products/upload-images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const urls = res.data.urls || [];
      setImageList([...currentImages(), ...urls]);
      if (res.data.rejected?.length) toast.error(res.data.rejected.join('; '));
      if (urls.length) toast.success(`${urls.length} image${urls.length === 1 ? '' : 's'} added`);
    } catch (err) {
      toastError(err, 'Image upload failed');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeProductImage = (idx) => {
    const next = currentImages();
    next.splice(idx, 1);
    setImageList(next);
  };

  const addImageUrl = () => {
    const url = imageUrlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\/\S+$/.test(url)) {
      toast.error('Enter the full link, starting with http:// or https://');
      return;
    }
    if (currentImages().length >= MAX_PRODUCT_IMAGES) {
      toast.error(`A product can carry at most ${MAX_PRODUCT_IMAGES} images`);
      return;
    }
    setImageList([...currentImages(), url]);
    setImageUrlDraft('');
  };
  const pristineSeller = useRef(newSeller);

  const formsDirty = useMemo(() => {
    const diff = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
    // newSeller holds nested objects; compare the same shape twice.
    return diff(newProduct, pristineProduct.current) || diff(newSeller, pristineSeller.current);
  }, [newProduct, newSeller]);

  useEffect(() => {
    setHasUnsavedChanges(formsDirty);
  }, [formsDirty]);


  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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


  const openProfile = async () => {
    try {
      const res = await api.get('/manufacturer/profile');
      const m = res.data.data || {};
      setProfile({
        companyName: m.companyName || '',
        phone: m.phone || '',
        gstNumber: m.gstNumber || '',
        brands: m.brands || []
      });
      setShowProfile(true);
    } catch (err) {
      toastError(err, 'Could not load your company profile');
    }
  };

  const addBrand = () => {
    const value = brandDraft.trim();
    if (!value) return;
    if (profile.brands.some((b) => b.toLowerCase() === value.toLowerCase())) {
      toast.error('That brand is already added');
      return;
    }
    setProfile((p) => ({ ...p, brands: [...p.brands, value] }));
    setBrandDraft('');
  };

  const removeBrand = (name) => {
    setProfile((p) => ({ ...p, brands: p.brands.filter((b) => b !== name) }));
  };

  const saveProfile = async () => {
    if (!profile.companyName.trim()) { toast.error('Company name is required'); return; }
    if (profile.brands.length === 0) { toast.error('Keep at least one brand'); return; }
    try {
      await api.put('/manufacturer/profile', profile);
      toast.success('Profile updated');
      setShowProfile(false);
    } catch (err) {
      toastError(err, 'Could not save profile');
    }
  };

  const toggleSellerBan = async (seller) => {
    try {
      if (seller.isBanned) {
        await api.post(`/manufacturer/sellers/${seller._id}/unban`, {});
        toast.success(`${seller.storeName || seller.name} reinstated`);
      } else {
        const reason = window.prompt('Reason for blocking this seller?') || 'Blocked by manufacturer';
        await api.post(`/manufacturer/sellers/${seller._id}/ban`, { reason });
        toast.success(`${seller.storeName || seller.name} blocked`);
      }
      fetchSellers();
    } catch (err) {
      toastError(err, 'Could not update seller status');
    }
  };

  const deleteSeller = async (seller) => {
    if (!window.confirm(`Remove ${seller.storeName || seller.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/manufacturer/sellers/${seller._id}`);
      toast.success('Seller removed');
      fetchSellers();
    } catch (err) {
      toastError(err, 'Could not remove seller');
    }
  };

  const saveSeller = async () => {
    try {
      if (editingSeller) {
        await api.put(`/manufacturer/sellers/${editingSeller._id}`, {
          name: newSeller.name, phone: newSeller.phone, storeName: newSeller.storeName,
          storeAddress: newSeller.storeAddress
        });
        toast.success('Seller updated');
      } else {
        await handleAddSeller();
      }
      setShowAddSeller(false);
      pristineSeller.current = newSeller;
      setEditingSeller(null);
      fetchSellers();
    } catch (err) {
      toastError(err, 'Could not save seller');
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
      toastError(error, "Failed to discontinue product");
    }
  };

  const handleRecontinue = async (productId) => {
    try {
      await api.post(`/manufacturer/products/${productId}/recontinue`);
      toast.success('Product re-continued successfully');
      fetchProducts();
    } catch (error) {
      toastError(error, "Failed to re-continue product");
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
        toastError(error, "Failed to upload products");
      }
    }
  };

  const EYEWEAR_CATS = ['sunglasses', 'eyeglasses', 'readingglasses', 'sportseyewear', 'kids'];

  /**
   * Mirrors what the API and the schema require so the maker sees the whole
   * list in one go instead of one error per save.
   */
  const validateProductForm = () => {
    const isEyewear = EYEWEAR_CATS.includes(newProduct.category);
    const missing = [];
    if (!newProduct.title.trim()) missing.push('title');
    if (!newProduct.description.trim()) missing.push('description');
    if (!newProduct.price || Number(newProduct.price) <= 0) missing.push('price');
    if (!newProduct.brand.trim()) missing.push('brand name');
    if (!newProduct.modelNumber.trim()) missing.push('model number');
    if (!newProduct.productCode.trim()) missing.push('product id / SKU code');
    if (!(newProduct.images || []).some((i) => i.trim())) missing.push('at least one image (link or upload)');
    if (isEyewear) {
      if (!newProduct.frameShape) missing.push('frame shape / face shape');
      if (!newProduct.frameType) missing.push('frame type');
      if (!newProduct.frameMaterial) missing.push('frame material');
      if (!newProduct.gender && newProduct.category !== 'kids') missing.push('gender');
      if (!String(newProduct.frameSize).trim()) missing.push('frame size (type it, e.g. 54-16-135)');
      if (!newProduct.frameWidth) missing.push('frame width (mm)');
      if (!newProduct.frameWeight) missing.push('frame weight (g)');
      if (!newProduct.dimensions.trim()) missing.push('frame dimensions (W x H x bridge x temple)');
      if (!newProduct.frameColor) missing.push('frame colour');
      if (newProduct.category === 'kids' || newProduct.gender === 'kids') {
        if (!newProduct.subGender) missing.push('boys / girls');
        if (!newProduct.ageGroup) missing.push('age group');
      }
    }
    if (newProduct.poweredOptionsAvailable && newProduct.prescriptionLensTypes.length === 0) {
      missing.push('prescription lens types offered');
    }
    return missing;
  };

  const handleAddProduct = async () => {
    const missing = validateProductForm();
    if (missing.length) {
      toast.error(`Add the required details first: ${missing.join(', ')}`, { duration: 9000 });
      return;
    }
    try {
      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        images: newProduct.images.filter(img => img.trim() !== ''),
        frameShape: newProduct.frameShape,
        frameType: newProduct.frameType,
        frameMaterial: newProduct.frameMaterial,
        frameColor: newProduct.frameColor,
        frameWidth: Number(newProduct.frameWidth) || undefined,
        frameWeight: Number(newProduct.frameWeight) || undefined,
        dimensions: (() => {
          const parts = String(newProduct.dimensions).split(/\s*[x\u00D7,]\s*/).filter(Boolean).map(Number);
          return { width: parts[0], height: parts[1], bridge: parts[2], temple: parts[3] };
        })(),
        modelNumber: newProduct.modelNumber,
        productCode: newProduct.productCode,
        warranty: newProduct.warranty,
        subGender: newProduct.subGender || undefined,
        ageGroup: newProduct.ageGroup || undefined,
        poweredOptionsAvailable: !!newProduct.poweredOptionsAvailable,
        prescriptionLensTypes: newProduct.poweredOptionsAvailable ? newProduct.prescriptionLensTypes : [],
        returnWindowDays: Number(newProduct.returnWindowDays)
      };
      
      // If category is kids, set the actual category based on kidsType
      if (newProduct.category === 'kids' && newProduct.kidsType) {
        productData.category = newProduct.kidsType;
        productData.gender = 'kids';
      }
      
      await api.post('/manufacturer/products', productData);
      toast.success('Product added successfully');
      setShowAddProduct(false);
      const blankProduct = {
        title: '',
        description: '',
        price: '',
        category: 'sunglasses',
        kidsType: '',
        brand: '',
        images: [''],
        colors: [],
        sizes: [],
        stock: 0,
        gender: 'unisex',
        frameSize: 'medium'
      };
      // Snapshot what is actually rendered next. Keeping the submitted values as
      // the "pristine" copy made the form look dirty the instant it emptied, so
      // the leave-page warning fired on the following product.
      setNewProduct(blankProduct);
      pristineProduct.current = blankProduct;
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
        toastError(error, "Failed to upload sellers");
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-white)', boxShadow: 'var(--shadow-sm)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Manufacturer Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            {manufacturer?.companyName} | ID: {manufacturer?.manufacturerId}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>{manufacturer?.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{manufacturer?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--brand-tint)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Total Products</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{products.filter(p => !p.isDiscontinued).length}</h3>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--success-light)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <FiUsers size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Total Sellers</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{sellers.length}</h3>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--warning-light)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Discontinued</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{products.filter(p => p.isDiscontinued).length}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>Products</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ padding: '10px 20px', background: 'var(--success)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiUpload /> Bulk Upload
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
              </label>
              <button
                onClick={() => setShowAddProduct(true)}
                style={{ padding: '10px 20px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiPlus /> Add Product
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No products yet. Add your first product!</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Product</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Brand</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Price</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {product.images?.[0] && (
                            <img src={product.images[0]} alt={product.title} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                          )}
                          <span style={{ fontWeight: '500' }}>{product.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>{product.brand}</td>
                      <td style={{ padding: '12px' }}>₹{product.price}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius)',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: product.isDiscontinued ? 'var(--danger-light)' : 'var(--success-light)',
                          color: product.isDiscontinued ? 'var(--danger)' : 'var(--success)'
                        }}>
                          {product.isDiscontinued ? 'Discontinued' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button style={{ padding: '6px', background: 'var(--brand)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
                            <FiEye size={16} />
                          </button>
                          <button style={{ padding: '6px', background: 'var(--warning)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
                            <FiEdit size={16} />
                          </button>
                          {product.isDiscontinued ? (
                            <button 
                              onClick={() => handleRecontinue(product._id)}
                              style={{ padding: '6px', background: 'var(--success)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}
                            >
                              Re-continue
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleDiscontinue(product._id)}
                              style={{ padding: '6px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}
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
        <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>Your Sellers</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowBulkSellerUpload(true)}
                style={{ padding: '10px 20px', background: 'var(--success)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiUpload /> Bulk Upload
              </button>
              <button
                onClick={() => setShowAddSeller(true)}
                style={{ padding: '10px 20px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiPlus /> Add Seller
              </button>
              <button
                onClick={openProfile}
                style={{ padding: '10px 20px', background: 'var(--bg-white)', color: 'var(--text-primary)', border: '1px solid #d2d7de', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiEdit size={16} /> Company & brands
              </button>
            </div>
          </div>

          {sellers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No sellers yet. Add your first seller!</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Seller</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Store Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-primary)' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((seller) => (
                    <tr key={seller._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{seller.name}</td>
                      <td style={{ padding: '12px' }}>{seller.storeName}</td>
                      <td style={{ padding: '12px' }}>{seller.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 'var(--radius)',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: seller.isBanned ? 'var(--danger-light)' : 'var(--success-light)',
                          color: seller.isBanned ? 'var(--danger)' : 'var(--success)'
                        }}>
                          {seller.isBanned ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => { setEditingSeller(seller); setNewSeller({ ...newSeller, name: seller.name || '', phone: seller.phone || '', storeName: seller.storeName || '', storeAddress: { ...(seller.storeAddress || {}), street: seller.storeAddress?.street || '', city: seller.storeAddress?.city || '', state: seller.storeAddress?.state || '', pincode: seller.storeAddress?.pincode || '' } }); setShowAddSeller(true); }}
                          title="Edit seller details"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', marginRight: 8 }}
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          onClick={() => toggleSellerBan(seller)}
                          title={seller.isBanned ? 'Reinstate seller' : 'Block seller'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: seller.isBanned ? 'var(--success)' : 'var(--danger)', marginRight: 8 }}
                        >
                          {seller.isBanned ? 'Reinstate' : 'Block'}
                        </button>
                        <button
                          onClick={() => deleteSeller(seller)}
                          title="Remove seller"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <FiTrash2 size={16} />
                        </button>
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
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Add New Product</h2>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Product Title *</label>
                <input
                  type="text"
                  value={newProduct.title}
                  onChange={(e) => setNewProduct({...newProduct, title: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                  placeholder="Enter product title"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Description *</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', minHeight: '100px' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="₹0.00"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Stock *</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Category *</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value, kidsType: e.target.value === 'kids' ? '' : undefined})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Brand name"
                  />
                </div>
              </div>

              {newProduct.category === 'kids' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Kids Product Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setNewProduct({...newProduct, kidsType: 'eyeglasses'})}
                      style={{
                        padding: '12px',
                        border: newProduct.kidsType === 'eyeglasses' ? '2px solid var(--brand)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: newProduct.kidsType === 'eyeglasses' ? 'var(--brand-tint)' : 'var(--bg-white)',
                        cursor: 'pointer',
                        fontWeight: newProduct.kidsType === 'eyeglasses' ? '600' : '400',
                        color: newProduct.kidsType === 'eyeglasses' ? 'var(--brand)' : 'var(--text-primary)'
                      }}
                    >
                      Eyeglasses
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProduct({...newProduct, kidsType: 'sunglasses'})}
                      style={{
                        padding: '12px',
                        border: newProduct.kidsType === 'sunglasses' ? '2px solid var(--brand)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: newProduct.kidsType === 'sunglasses' ? 'var(--brand-tint)' : 'var(--bg-white)',
                        cursor: 'pointer',
                        fontWeight: newProduct.kidsType === 'sunglasses' ? '600' : '400',
                        color: newProduct.kidsType === 'sunglasses' ? 'var(--brand)' : 'var(--text-primary)'
                      }}
                    >
                      Sunglasses
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Gender</label>
                  <select
                    value={newProduct.gender}
                    onChange={(e) => setNewProduct({...newProduct, gender: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="extra-large">Extra Large</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  Product images
                  <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 12.5 }}>
                    {' '}- from this device, up to {MAX_PRODUCT_IMAGES} per product
                  </span>
                </label>

                {/*
                  Pictures are uploaded as soon as they are chosen, so the previews
                  show the copy we actually serve and a rejected file is reported
                  while the manufacturer is still on the form rather than after the
                  product has been created with a dead link.
                */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleImageFiles}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImages || currentImages().length >= MAX_PRODUCT_IMAGES}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <FiCamera size={16} /> {uploadingImages ? 'Uploading...' : 'Add photos'}
                  </button>
                  {currentImages().length > 0 && (
                    <button type="button" className="btn btn-outline" onClick={() => setImageList([])}>Clear all</button>
                  )}
                </div>

                {currentImages().length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10, marginTop: 12 }}>
                    {currentImages().map((url, idx) => (
                      <div key={`${url}-${idx}`} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                        <img src={url} alt={`Product image ${idx + 1}`} style={{ width: '100%', height: 92, objectFit: 'cover', display: 'block' }} />
                        {idx === 0 && (
                          <span style={{ position: 'absolute', left: 0, bottom: 0, background: 'var(--brand)', color: 'var(--text-white)', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderTopRightRadius: 8 }}>
                            COVER
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove image ${idx + 1}`}
                          onClick={() => removeProductImage(idx)}
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: 'var(--text-white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <FiX size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input
                    type="text"
                    value={imageUrlDraft}
                    onChange={(e) => setImageUrlDraft(e.target.value)}
                    placeholder="...or paste an image link"
                    style={{ flex: 1, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13.5 }}
                  />
                  <button type="button" className="btn btn-outline" onClick={addImageUrl}>Add link</button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Colors (comma separated)</label>
                <input
                  type="text"
                  value={newProduct.colors.join(', ')}
                  onChange={(e) => setNewProduct({...newProduct, colors: e.target.value.split(',').map(c => c.trim())})}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                  placeholder="Black, Brown, Gold"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Sizes (comma separated)</label>
                <input
                  type="text"
                  value={newProduct.sizes.join(', ')}
                  onChange={(e) => setNewProduct({...newProduct, sizes: e.target.value.split(',').map(s => s.trim())})}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                  placeholder="Small, Medium, Large"
                />
              </div>
            </div>

              {/* Attributes every maker must supply: the storefront facets, the
                  filter rails and the routing all read these fields. */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 6 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Frame specification</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame shape / face shape *</label>
                    <select className="input" value={newProduct.frameShape} onChange={(e) => setNewProduct({ ...newProduct, frameShape: e.target.value })}>
                      <option value="">Select</option>
                      {['Rectangle','Cat Eye','Oval','Aviator','Geometric','Round','Square','Wayfarer','Browline','Oversized','Wraparound'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame type *</label>
                    <select className="input" value={newProduct.frameType} onChange={(e) => setNewProduct({ ...newProduct, frameType: e.target.value })}>
                      <option value="">Select</option>{['Full Rim','Half Rim','Rimless'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame material *</label>
                    <select className="input" value={newProduct.frameMaterial} onChange={(e) => setNewProduct({ ...newProduct, frameMaterial: e.target.value })}>
                      <option value="">Select</option>{['Acetate','Metal','Polycarbonate','Stainless Steel','TR90','Titanium','Plastic','Wood'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame colour *</label>
                    <input className="input" value={newProduct.frameColor} onChange={(e) => setNewProduct({ ...newProduct, frameColor: e.target.value })} placeholder="Tortoise" /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame size * <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>(type it)</span></label>
                    <input className="input" value={newProduct.frameSize} onChange={(e) => setNewProduct({ ...newProduct, frameSize: e.target.value })} placeholder="54-16-135" /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame width (mm) *</label>
                    <input className="input" type="number" value={newProduct.frameWidth} onChange={(e) => setNewProduct({ ...newProduct, frameWidth: e.target.value })} placeholder="135" /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Frame weight (g) *</label>
                    <input className="input" type="number" step="0.1" value={newProduct.frameWeight} onChange={(e) => setNewProduct({ ...newProduct, frameWeight: e.target.value })} placeholder="24.5" /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Dimensions (W x H x bridge x temple) *</label>
                    <input className="input" value={newProduct.dimensions} onChange={(e) => setNewProduct({ ...newProduct, dimensions: e.target.value })} placeholder="135 x 50 x 14 x 135" /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Model number *</label>
                    <input className="input" value={newProduct.modelNumber} onChange={(e) => setNewProduct({ ...newProduct, modelNumber: e.target.value })} placeholder="RB3025 001" /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Product ID *</label>
                    <input className="input" value={newProduct.productCode} onChange={(e) => setNewProduct({ ...newProduct, productCode: e.target.value })} placeholder="RB-3025-001-58" /></div>
                  {(newProduct.category === 'kids') && (
                    <>
                      <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Boys / girls *</label>
                        <select className="input" value={newProduct.subGender} onChange={(e) => setNewProduct({ ...newProduct, subGender: e.target.value })}>
                          <option value="">Select</option><option value="boys">Boys</option><option value="girls">Girls</option>
                        </select></div>
                      <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Age group *</label>
                        <select className="input" value={newProduct.ageGroup} onChange={(e) => setNewProduct({ ...newProduct, ageGroup: e.target.value })}>
                          <option value="">Select</option>{['0-3','3-6','6-9','9-12','12-15'].map((v) => <option key={v} value={v}>{v} years</option>)}
                        </select></div>
                    </>
                  )}
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Return window (days) *</label>
                    <input className="input" type="number" min="0" max="60" value={newProduct.returnWindowDays} onChange={(e) => setNewProduct({ ...newProduct, returnWindowDays: e.target.value })} /></div>
                  <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Warranty</label>
                    <input className="input" value={newProduct.warranty} onChange={(e) => setNewProduct({ ...newProduct, warranty: e.target.value })} placeholder="1 year manufacturer warranty" /></div>
                </div>

                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={newProduct.poweredOptionsAvailable} onChange={(e) => setNewProduct({ ...newProduct, poweredOptionsAvailable: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--brand)' }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>Can be made with prescription lenses</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                      Only sellers who switch this on will receive powered orders, and buyers of powered sunglasses see "Choose lenses" instead of "Buy now".
                    </span>
                  </span>
                </label>
                {newProduct.poweredOptionsAvailable && (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                    {['single-vision','bifocal','progressive','reading'].map((v) => {
                      const on = newProduct.prescriptionLensTypes.includes(v);
                      return (
                        <label key={v} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                          <input type="checkbox" checked={on} style={{ accentColor: 'var(--brand)' }}
                            onChange={() => setNewProduct({ ...newProduct, prescriptionLensTypes: on ? newProduct.prescriptionLensTypes.filter((x) => x !== v) : [...newProduct.prescriptionLensTypes, v] })} />
                          {v.replace('-', ' ')}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>


            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleAddProduct}
                style={{ flex: 1, padding: '12px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}
              >
                Add Product
              </button>
              <button
                onClick={() => setShowAddProduct(false)}
                style={{ flex: 1, padding: '12px', background: 'var(--border)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,17,20,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
          <div style={{ background: 'var(--bg-white)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Company &amp; brands</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Company name *</label>
              <input className="input" value={profile.companyName} onChange={(e) => setProfile({ ...profile, companyName: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Phone *</label>
                <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>GST number</label>
                <input className="input" value={profile.gstNumber} onChange={(e) => setProfile({ ...profile, gstNumber: e.target.value })} />
              </div>
            </div>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Brands you manufacture</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {profile.brands.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-light)' }}>No brands yet - add at least one before submitting products.</span>
              )}
              {profile.brands.map((b) => (
                <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'var(--bg-subtle)', fontSize: 13, fontWeight: 600 }}>
                  {b}
                  <button onClick={() => removeBrand(b)} title={`Remove ${b}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, lineHeight: 1, padding: 0 }}>
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="Add a brand and press Enter"
                value={brandDraft}
                onChange={(e) => setBrandDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand(); } }}
              />
              <button onClick={addBrand} className="btn btn-outline">Add</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', margin: '8px 0 18px' }}>
              Sellers you create can only list products under the brands you add here.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowProfile(false)} className="btn btn-outline">Cancel</button>
              <button onClick={saveProfile} className="btn btn-primary">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Seller Modal */}
      {showAddSeller && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '32px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
              {editingSeller ? `Edit ${editingSeller.storeName || editingSeller.name || 'Seller'}` : 'Add New Seller'}
            </h2>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Seller Name *</label>
                  <input
                    type="text"
                    value={newSeller.name}
                    onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Email *</label>
                  <input
                    type="email"
                    value={newSeller.email}
                    onChange={(e) => setNewSeller({...newSeller, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="+91 9876543210"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Store Name *</label>
                  <input
                    type="text"
                    value={newSeller.storeName}
                    onChange={(e) => setNewSeller({...newSeller, storeName: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>City</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.city}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, city: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="City"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>State</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.state}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, state: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="State"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Pincode</label>
                  <input
                    type="text"
                    value={newSeller.storeAddress.pincode}
                    onChange={(e) => setNewSeller({...newSeller, storeAddress: {...newSeller.storeAddress, pincode: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="GST number"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>PAN Number *</label>
                  <input
                    type="text"
                    value={newSeller.panNumber}
                    onChange={(e) => setNewSeller({...newSeller, panNumber: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
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
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Account number"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>IFSC Code *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.ifscCode}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, ifscCode: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="IFSC code"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Bank Name *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.bankName}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, bankName: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Bank name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Branch Name *</label>
                  <input
                    type="text"
                    value={newSeller.bankDetails.branchName}
                    onChange={(e) => setNewSeller({...newSeller, bankDetails: {...newSeller.bankDetails, branchName: e.target.value}})}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                    placeholder="Branch name"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={editingSeller ? saveSeller : handleAddSeller}
                style={{ flex: 1, padding: '12px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}
              >
                Add Seller
              </button>
              <button
                onClick={() => setShowAddSeller(false)}
                style={{ flex: 1, padding: '12px', background: 'var(--border)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}
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
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '32px', maxWidth: '600px', width: '90%' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Bulk Upload Sellers</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Upload an Excel/CSV file with the following columns:
              </p>
              <ul style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.8', paddingLeft: '20px' }}>
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
              <p style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '16px', fontWeight: '500' }}>
                Note: Password will be auto-generated and sent to each seller's email.
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', padding: '40px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleBulkSellerUpload}
                  style={{ display: 'none' }}
                />
                <FiUpload size={48} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Click to upload Excel/CSV file</p>
              </label>
            </div>

            <button
              onClick={() => setShowBulkSellerUpload(false)}
              style={{ width: '100%', padding: '12px', background: 'var(--border)', color: 'var(--text-primary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}
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
