import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag, FiX, FiFilter, FiLayers } from 'react-icons/fi';
import { products as productsApi, seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

const SellerProducts = () => {
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [stockFilter, setStockFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', brand: '', category: 'sunglasses', price: '', originalPrice: '', description: '', stock: '', gender: 'unisex', frameSize: 'medium', isReturnable: true, isExchangeable: true });
  const [variants, setVariants] = useState([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantForm, setVariantForm] = useState({ color: '', size: '', gender: 'unisex', price: '', stock: '', sku: '' });
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerProduct, setOfferProduct] = useState(null);
  const [offerData, setOfferData] = useState({ type: 'none', percentage: '' });
  const [offerLoading, setOfferLoading] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await productsApi.getAll({ seller: true, limit: 500 });
      setProductsList(listOf(res.data));
    } catch (error) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.brand) { toast.error('Fill required fields'); return; }
    try {
      const payload = { ...formData, variants };
      if (editingProduct) {
        await productsApi.update(editingProduct._id, payload);
        toast.success('Product updated');
      } else {
        await productsApi.create(payload);
        toast.success('Product created');
      }
      setShowForm(false);
      setEditingProduct(null);
      setFormData({ name: '', brand: '', category: 'sunglasses', price: '', originalPrice: '', description: '', stock: '', gender: 'unisex', frameSize: 'medium', isReturnable: true, isExchangeable: true });
      setVariants([]);
      fetchProducts();
    } catch (error) { toast.error(err.response?.data?.message || 'Failed to save'); }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({ 
      name: product.name || product.title, 
      brand: product.brand, 
      category: product.category, 
      price: product.price, 
      originalPrice: product.originalPrice || '', 
      description: product.description || '', 
      stock: product.stock || '', 
      gender: product.gender || 'unisex', 
      frameSize: product.frameSize || 'medium',
      isReturnable: product.isReturnable !== false,
      isExchangeable: product.isExchangeable !== false
    });
    setVariants(product.variants || []);
    setShowForm(true);
  };

  const addVariant = () => {
    if (!variantForm.color && !variantForm.size) { toast.error('Add at least color or size'); return; }
    setVariants([...variants, { ...variantForm, price: variantForm.price || formData.price, isActive: true }]);
    setVariantForm({ color: '', size: '', gender: 'unisex', price: '', stock: '', sku: '' });
    setShowVariantForm(false);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productsApi.delete(id);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) { toastError(error, "Failed to delete"); }
  };

  const openOfferModal = (product) => {
    setOfferProduct(product);
    if (product.offer?.type === 'bogo') {
      setOfferData({ type: 'bogo', percentage: '' });
    } else if (product.offer?.type === 'percentage') {
      setOfferData({ type: 'percentage', percentage: product.offer.percentage || '' });
    } else {
      setOfferData({ type: 'none', percentage: '' });
    }
    setShowOfferModal(true);
  };

  const handleSaveOffer = async () => {
    if (!offerProduct) return;
    setOfferLoading(true);
    try {
      if (offerData.type === 'none') {
        await sellerApi.removeOffer(offerProduct._id);
        toast.success('Offer removed');
      } else {
        const payload = offerData.type === 'percentage'
          ? { type: 'percentage', percentage: Number(offerData.percentage) }
          : { type: 'bogo' };
        await sellerApi.setOffer(offerProduct._id, payload);
        toast.success('Offer saved');
      }
      setShowOfferModal(false);
      setOfferProduct(null);
      fetchProducts();
    } catch (error) {
      toast.error(err.response?.data?.message || 'Failed to save offer');
    } finally {
      setOfferLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(productsList.map(p => p.category));
    return Array.from(cats).sort();
  }, [productsList]);

  const filtered = useMemo(() => {
    let result = [...productsList];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      result = result.filter(p => p.category === categoryFilter);
    }

    if (priceMin) {
      result = result.filter(p => p.price >= Number(priceMin));
    }
    if (priceMax) {
      result = result.filter(p => p.price <= Number(priceMax));
    }

    if (stockFilter === 'in') {
      result = result.filter(p => p.stock > 10);
    } else if (stockFilter === 'low') {
      result = result.filter(p => p.stock > 0 && p.stock <= 10);
    } else if (stockFilter === 'out') {
      result = result.filter(p => !p.stock || p.stock === 0);
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-az':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      default:
        break;
    }

    return result;
  }, [productsList, search, categoryFilter, priceMin, priceMax, sortBy, stockFilter]);

  const getOfferBadge = (product) => {
    if (!product.offer || product.offer.type === 'none') return null;
    if (product.offer.type === 'bogo') {
      return <span style={{ background: '#26a541', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>BOGO</span>;
    }
    if (product.offer.type === 'percentage') {
      return <span style={{ background: '#26a541', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>{product.offer.percentage}% OFF</span>;
    }
    return null;
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setPriceMin('');
    setPriceMax('');
    setStockFilter('');
    setSortBy('newest');
  };

  const hasActiveFilters = search || categoryFilter || priceMin || priceMax || stockFilter || sortBy !== 'newest';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>My Products ({filtered.length})</h1>
            <button onClick={() => { setShowForm(true); setEditingProduct(null); setFormData({ name: '', brand: '', category: 'sunglasses', price: '', originalPrice: '', description: '', stock: '', gender: 'unisex', frameSize: 'medium', isReturnable: true, isExchangeable: true }); setVariants([]); }} className="btn btn-primary"><FiPlus /> Add Product</button>
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FiFilter size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Filters</span>
              {hasActiveFilters && (
                <button onClick={clearFilters} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiX size={14} /> Clear All
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} size={14} />
                <input className="input" placeholder="Search name, brand, category..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '34px', fontSize: '13px' }} />
              </div>
              <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ fontSize: '13px' }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} style={{ fontSize: '13px' }}>
                <option value="">All Stock</option>
                <option value="in">In Stock (&gt;10)</option>
                <option value="low">Low Stock (1-10)</option>
                <option value="out">Out of Stock</option>
              </select>
              <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ fontSize: '13px' }}>
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name-az">Name: A to Z</option>
              </select>
              <input className="input" type="number" placeholder="Min Price" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} style={{ fontSize: '13px' }} />
              <input className="input" type="number" placeholder="Max Price" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} style={{ fontSize: '13px' }} />
            </div>
          </div>

          {showForm && (
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group"><label>Product Name *</label><input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div className="input-group"><label>Brand *</label><input className="input" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} /></div>
                <div className="input-group"><label>Category</label><select className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}><option value="sunglasses">Sunglasses</option><option value="eyeglasses">Eyeglasses</option><option value="contactlenses">Contact Lenses</option><option value="readingglasses">Reading Glasses</option><option value="sportseyewear">Sports Eyewear</option><option value="kids">Kids</option></select></div>
                <div className="input-group"><label>Gender</label><select className="input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}><option value="men">Men</option><option value="women">Women</option><option value="unisex">Unisex</option><option value="kids">Kids</option></select></div>
                <div className="input-group"><label>Price *</label><input className="input" type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} /></div>
                <div className="input-group"><label>Original Price</label><input className="input" type="number" value={formData.originalPrice} onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })} /></div>
                <div className="input-group"><label>Frame Size</label><select className="input" value={formData.frameSize} onChange={(e) => setFormData({ ...formData, frameSize: e.target.value })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="extra-large">Extra Large</option></select></div>
                <div className="input-group"><label>Base Stock</label><input className="input" type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} /></div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Description</label><textarea className="input" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              </div>

              {/* Return & Exchange Policy */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Return & Exchange Policy</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Allow Returns</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Customers can return this product</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.isReturnable} 
                        onChange={(e) => setFormData({ ...formData, isReturnable: e.target.checked })}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: formData.isReturnable ? 'var(--success)' : '#ccc',
                        borderRadius: '26px',
                        transition: '0.3s',
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: '20px',
                          width: '20px',
                          left: formData.isReturnable ? '24px' : '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.3s',
                        }} />
                      </span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Allow Exchanges</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Customers can exchange this product</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.isExchangeable} 
                        onChange={(e) => setFormData({ ...formData, isExchangeable: e.target.checked })}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: formData.isExchangeable ? 'var(--success)' : '#ccc',
                        borderRadius: '26px',
                        transition: '0.3s',
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: '20px',
                          width: '20px',
                          left: formData.isExchangeable ? '24px' : '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.3s',
                        }} />
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Variants Section */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><FiLayers size={14} /> Variants (Color/Size/Gender)</h4>
                  <button type="button" onClick={() => setShowVariantForm(!showVariantForm)} className="btn btn-outline btn-sm"><FiPlus size={12} /> Add Variant</button>
                </div>

                {showVariantForm && (
                  <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px', alignItems: 'end' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '11px' }}>Color</label><input className="input" style={{ fontSize: '12px' }} placeholder="Black" value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} /></div>
                      <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '11px' }}>Size</label><input className="input" style={{ fontSize: '12px' }} placeholder="Medium" value={variantForm.size} onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })} /></div>
                      <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '11px' }}>Gender</label><select className="input" style={{ fontSize: '12px' }} value={variantForm.gender} onChange={(e) => setVariantForm({ ...variantForm, gender: e.target.value })}><option value="men">Men</option><option value="women">Women</option><option value="unisex">Unisex</option><option value="kids">Kids</option></select></div>
                      <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '11px' }}>Price</label><input className="input" style={{ fontSize: '12px' }} type="number" placeholder={formData.price || '0'} value={variantForm.price} onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })} /></div>
                      <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '11px' }}>Stock</label><input className="input" style={{ fontSize: '12px' }} type="number" placeholder="0" value={variantForm.stock} onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button type="button" onClick={addVariant} className="btn btn-primary btn-sm">Add</button>
                      <button type="button" onClick={() => setShowVariantForm(false)} className="btn btn-outline btn-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {variants.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Color', 'Size', 'Gender', 'Price', 'Stock', ''].map(h => <th key={h} style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {variants.map((v, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '8px' }}>{v.color || '—'}</td>
                            <td style={{ padding: '8px' }}>{v.size || '—'}</td>
                            <td style={{ padding: '8px', textTransform: 'capitalize' }}>{v.gender || 'unisex'}</td>
                            <td style={{ padding: '8px' }}>₹{v.price || formData.price}</td>
                            <td style={{ padding: '8px' }}>{v.stock || 0}</td>
                            <td style={{ padding: '8px' }}><button type="button" onClick={() => removeVariant(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><FiTrash2 size={14} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleSave} className="btn btn-primary">{editingProduct ? 'Update' : 'Create'}</button>
                <button onClick={() => { setShowForm(false); setEditingProduct(null); }} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}

          {showOfferModal && offerProduct && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
              <div className="card" style={{ padding: '24px', maxWidth: '440px', width: '100%', position: 'relative' }}>
                <button onClick={() => setShowOfferModal(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                  <FiX size={20} />
                </button>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Manage Offer</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>{offerProduct.name}</p>

                {offerProduct.saleEvent && (
                  <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px', color: '#856404' }}>
                    This product is under sale event "{offerProduct.saleEvent.name}". Offers cannot be modified.
                  </div>
                )}

                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label>Offer Type</label>
                  <select
                    className="input"
                    value={offerData.type}
                    onChange={(e) => setOfferData({ ...offerData, type: e.target.value, percentage: '' })}
                    disabled={!!offerProduct.saleEvent}
                  >
                    <option value="none">No Offer</option>
                    <option value="percentage">Percentage Discount</option>
                    <option value="bogo">Buy 1 Get 1 (BOGO)</option>
                  </select>
                </div>

                {offerData.type === 'percentage' && (
                  <div className="input-group" style={{ marginBottom: '16px' }}>
                    <label>Discount % (1-90)</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="90"
                      value={offerData.percentage}
                      onChange={(e) => setOfferData({ ...offerData, percentage: e.target.value })}
                      disabled={!!offerProduct.saleEvent}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleSaveOffer}
                    className="btn btn-primary"
                    disabled={offerLoading || !!offerProduct.saleEvent}
                    style={{ opacity: offerLoading || offerProduct.saleEvent ? 0.6 : 1 }}
                  >
                    {offerLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setShowOfferModal(false)} className="btn btn-outline">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h3>No products found</h3><p>{hasActiveFilters ? 'Try adjusting your filters' : 'Add your first product'}</p>
              {hasActiveFilters && <button onClick={clearFilters} className="btn btn-outline" style={{ marginTop: '12px' }}>Clear Filters</button>}
            </div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Product', 'Category', 'Price', 'Stock', 'Offers', 'Actions'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><img src={product.images?.[0] || '/placeholder-glasses.png'} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '4px' }} /><div><div style={{ fontSize: '14px', fontWeight: 500 }}>{product.name}</div><div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{product.brand}</div></div></div></td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', textTransform: 'capitalize' }}>{product.category}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>₹{product.price}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}><span className={`badge ${product.stock > 10 ? 'badge-success' : product.stock > 0 ? 'badge-warning' : 'badge-danger'}`}>{product.stock || 0}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        {getOfferBadge(product) || <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => openOfferModal(product)} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}><FiTag size={12} /> Offer</button>
                          <button onClick={() => handleEdit(product)} className="btn btn-outline btn-sm"><FiEdit2 size={12} /></button>
                          <button onClick={() => handleDelete(product._id)} className="btn btn-danger btn-sm"><FiTrash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerProducts;
