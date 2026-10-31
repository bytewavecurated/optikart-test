import React, { useState, useEffect, useMemo } from 'react';
import { FiPackage, FiPlus, FiEdit2, FiTrash2, FiSearch, FiFilter, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { seller as sellerApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';

const SellerInventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [expandedProducts, setExpandedProducts] = useState({});
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [activeProductId, setActiveProductId] = useState(null);
  const [variantForm, setVariantForm] = useState({ color: '', size: '', gender: 'unisex', price: '', originalPrice: '', stock: '', sku: '' });
  const [selectedVariants, setSelectedVariants] = useState({});
  const [bulkStockValue, setBulkStockValue] = useState('');
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [inlineEditVariant, setInlineEditVariant] = useState(null);
  const [inlineStockValue, setInlineStockValue] = useState('');

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    try {
      const res = await sellerApi.getInventory();
      setProducts(listOf(res.data));
    } catch (error) {
      toastError(error, "Failed to load inventory");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (productId) => {
    setExpandedProducts((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const stats = useMemo(() => {
    let totalProducts = products.length;
    let totalStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    products.forEach((p) => {
      const stock = p.totalStock || 0;
      totalStock += stock;
      if (stock === 0) outOfStock++;
      else if (stock <= 10) lowStock++;
    });
    return { totalProducts, totalStock, lowStock, outOfStock };
  }, [products]);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((p) => p.category === categoryFilter);
    }
    if (stockFilter === 'in') {
      result = result.filter((p) => (p.totalStock || 0) > 10);
    } else if (stockFilter === 'low') {
      result = result.filter((p) => (p.totalStock || 0) > 0 && (p.totalStock || 0) <= 10);
    } else if (stockFilter === 'out') {
      result = result.filter((p) => !p.totalStock || p.totalStock === 0);
    }
    return result;
  }, [products, search, categoryFilter, stockFilter]);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStockFilter('');
  };

  const hasActiveFilters = search || categoryFilter || stockFilter;

  const openAddVariant = (productId) => {
    setActiveProductId(productId);
    setEditingVariant(null);
    setVariantForm({ color: '', size: '', gender: 'unisex', price: '', originalPrice: '', stock: '', sku: '' });
    setShowVariantModal(true);
  };

  const openEditVariant = (productId, variant) => {
    setActiveProductId(productId);
    setEditingVariant(variant);
    setVariantForm({
      color: variant.color || '',
      size: variant.size || '',
      gender: variant.gender || 'unisex',
      price: variant.price || '',
      originalPrice: variant.originalPrice || '',
      stock: variant.stock ?? '',
      sku: variant.sku || '',
    });
    setShowVariantModal(true);
  };

  const handleSaveVariant = async () => {
    if (!variantForm.color || !variantForm.size || !variantForm.price) {
      toast.error('Fill required fields (color, size, price)');
      return;
    }
    try {
      const payload = {
        color: variantForm.color,
        size: variantForm.size,
        gender: variantForm.gender,
        price: Number(variantForm.price),
        originalPrice: variantForm.originalPrice ? Number(variantForm.originalPrice) : undefined,
        stock: Number(variantForm.stock) || 0,
        sku: variantForm.sku || undefined,
      };
      if (editingVariant) {
        await sellerApi.updateVariant(activeProductId, editingVariant._id, payload);
        toast.success('Variant updated');
      } else {
        await sellerApi.addVariant(activeProductId, payload);
        toast.success('Variant added');
      }
      setShowVariantModal(false);
      fetchInventory();
    } catch (error) {
      toast.error(err.response?.data?.message || 'Failed to save variant');
    }
  };

  const handleDeleteVariant = async (productId, variantId) => {
    if (!window.confirm('Delete this variant?')) return;
    try {
      await sellerApi.deleteVariant(productId, variantId);
      toast.success('Variant deleted');
      fetchInventory();
    } catch (error) {
      toastError(error, "Failed to delete variant");
    }
  };

  const startInlineEdit = (variant) => {
    setInlineEditVariant(variant._id);
    setInlineStockValue(variant.stock ?? 0);
  };

  const saveInlineStock = async (productId, variantId) => {
    try {
      await sellerApi.updateVariant(productId, variantId, { stock: Number(inlineStockValue) || 0 });
      toast.success('Stock updated');
      setInlineEditVariant(null);
      fetchInventory();
    } catch (error) {
      toastError(error, "Failed to update stock");
    }
  };

  const toggleVariantSelection = (variantId) => {
    setSelectedVariants((prev) => {
      const next = { ...prev };
      if (next[variantId]) delete next[variantId];
      else next[variantId] = true;
      return next;
    });
  };

  const toggleAllVariants = (variants) => {
    const allSelected = variants.every((v) => selectedVariants[v._id]);
    setSelectedVariants((prev) => {
      const next = { ...prev };
      variants.forEach((v) => {
        if (allSelected) delete next[v._id];
        else next[v._id] = true;
      });
      return next;
    });
  };

  const handleBulkStockUpdate = async () => {
    const ids = Object.keys(selectedVariants);
    if (ids.length === 0 || !bulkStockValue) return;
    try {
      const updates = [];
      products.forEach((p) => {
        (p.variants || []).forEach((v) => {
          if (selectedVariants[v._id]) {
            updates.push(sellerApi.updateVariant(p._id, v._id, { stock: Number(bulkStockValue) }));
          }
        });
      });
      await Promise.all(updates);
      toast.success(`Updated stock for ${ids.length} variant(s)`);
      setSelectedVariants({});
      setShowBulkUpdate(false);
      setBulkStockValue('');
      fetchInventory();
    } catch (error) {
      toast.error('Bulk update failed');
    }
  };

  const getStockBadge = (stock) => {
    if (!stock || stock === 0) return <span className="badge badge-danger">Out of Stock</span>;
    if (stock <= 10) return <span className="badge badge-warning">Low Stock</span>;
    return <span className="badge badge-success">In Stock</span>;
  };

  const selectedCount = Object.keys(selectedVariants).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 768px) {
          .inv-summary-grid { grid-template-columns: 1fr 1fr !important; }
          .inv-filter-grid { grid-template-columns: 1fr !important; }
          .inv-product-row { flex-direction: column !important; align-items: flex-start !important; }
          .inv-variant-table { min-width: 600px !important; }
          .inv-modal-content { padding: 16px !important; }
          .inv-modal-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .inv-summary-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}><FiPackage style={{ marginRight: '8px', verticalAlign: 'middle' }} />Inventory Management</h1>
            {selectedCount > 0 && (
              <button onClick={() => setShowBulkUpdate(true)} className="btn btn-primary">
                Bulk Update ({selectedCount})
              </button>
            )}
          </div>

          <div className="inv-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary)' }}>{stats.totalProducts}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Total Products</div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary)' }}>{stats.totalStock}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Total Stock</div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#e67e22' }}>{stats.lowStock}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Low Stock Items</div>
            </div>
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#e74c3c' }}>{stats.outOfStock}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Out of Stock</div>
            </div>
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
            <div className="inv-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} size={14} />
                <input className="input" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '34px', fontSize: '13px' }} />
              </div>
              <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ fontSize: '13px' }}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} style={{ fontSize: '13px' }}>
                <option value="">All Stock</option>
                <option value="in">In Stock (&gt;10)</option>
                <option value="low">Low Stock (1-10)</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No products found</h3>
              <p>{hasActiveFilters ? 'Try adjusting your filters' : 'No inventory items yet'}</p>
              {hasActiveFilters && <button onClick={clearFilters} className="btn btn-outline" style={{ marginTop: '12px' }}>Clear Filters</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map((product) => {
                const isExpanded = !!expandedProducts[product._id];
                const variants = product.variants || [];
                return (
                  <div key={product._id} className="card" style={{ overflow: 'hidden' }}>
                    <div
                      className="inv-product-row"
                      onClick={() => toggleExpand(product._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        cursor: 'pointer',
                        background: isExpanded ? 'var(--bg-primary)' : 'transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                        <img
                          src={product.image || product.images?.[0] || '/placeholder-glasses.png'}
                          alt=""
                          style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{product.brand} &middot; <span style={{ textTransform: 'capitalize' }}>{product.category}</span></div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{product.totalStock || 0}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Stock</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{variants.length}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Variants</div>
                        </div>
                        {isExpanded ? <FiChevronUp size={18} style={{ color: 'var(--text-light)' }} /> : <FiChevronDown size={18} style={{ color: 'var(--text-light)' }} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Variants ({variants.length})</h4>
                          <button onClick={(e) => { e.stopPropagation(); openAddVariant(product._id); }} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FiPlus size={12} /> Add Variant
                          </button>
                        </div>

                        {variants.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)', fontSize: '13px' }}>
                            No variants yet. Add your first variant.
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="inv-variant-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '750px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', width: '32px' }}>
                                    <input
                                      type="checkbox"
                                      checked={variants.length > 0 && variants.every((v) => selectedVariants[v._id])}
                                      onChange={() => toggleAllVariants(variants)}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </th>
                                  {['Color', 'Size', 'Gender', 'Price', 'Stock', 'SKU', 'Status', 'Actions'].map((h) => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {variants.map((variant) => (
                                  <tr key={variant._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: '10px 12px' }}>
                                      <input
                                        type="checkbox"
                                        checked={!!selectedVariants[variant._id]}
                                        onChange={() => toggleVariantSelection(variant._id)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ cursor: 'pointer' }}
                                      />
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500 }}>{variant.color || '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>{variant.size || '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', textTransform: 'capitalize' }}>{variant.gender || '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}>₹{variant.price ?? '—'}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                                      {inlineEditVariant === variant._id ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                          <input
                                            className="input"
                                            type="number"
                                            value={inlineStockValue}
                                            onChange={(e) => setInlineStockValue(e.target.value)}
                                            style={{ width: '60px', fontSize: '12px', padding: '4px 6px' }}
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveInlineStock(product._id, variant._id);
                                              if (e.key === 'Escape') setInlineEditVariant(null);
                                            }}
                                          />
                                          <button
                                            onClick={() => saveInlineStock(product._id, variant._id)}
                                            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '3px', padding: '4px 6px', cursor: 'pointer', fontSize: '11px' }}
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={() => setInlineEditVariant(null)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '11px' }}
                                          >
                                            <FiX size={12} />
                                          </button>
                                        </div>
                                      ) : (
                                        <span
                                          onClick={(e) => { e.stopPropagation(); startInlineEdit(variant); }}
                                          style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-light)', paddingBottom: '1px' }}
                                          title="Click to edit stock"
                                        >
                                          {variant.stock ?? 0}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '12px' }}>{variant.sku || '—'}</td>
                                    <td style={{ padding: '10px 12px' }}>{getStockBadge(variant.stock)}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => openEditVariant(product._id, variant)} className="btn btn-outline btn-sm" title="Edit"><FiEdit2 size={12} /></button>
                                        <button onClick={() => handleDeleteVariant(product._id, variant._id)} className="btn btn-danger btn-sm" title="Delete"><FiTrash2 size={12} /></button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showVariantModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
          <div className="card inv-modal-content" style={{ padding: '24px', maxWidth: '520px', width: '100%', position: 'relative' }}>
            <button onClick={() => setShowVariantModal(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <FiX size={20} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editingVariant ? 'Edit Variant' : 'Add Variant'}</h3>
            <div className="inv-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group">
                <label>Color *</label>
                <input className="input" value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} placeholder="e.g. Black" />
              </div>
              <div className="input-group">
                <label>Size *</label>
                <input className="input" value={variantForm.size} onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })} placeholder="e.g. 54mm" />
              </div>
              <div className="input-group">
                <label>Gender</label>
                <select className="input" value={variantForm.gender} onChange={(e) => setVariantForm({ ...variantForm, gender: e.target.value })}>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="unisex">Unisex</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
              <div className="input-group">
                <label>Price *</label>
                <input className="input" type="number" value={variantForm.price} onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="input-group">
                <label>Original Price</label>
                <input className="input" type="number" value={variantForm.originalPrice} onChange={(e) => setVariantForm({ ...variantForm, originalPrice: e.target.value })} placeholder="0.00" />
              </div>
              <div className="input-group">
                <label>Stock</label>
                <input className="input" type="number" value={variantForm.stock} onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })} placeholder="0" />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label>SKU</label>
                <input className="input" value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} placeholder="e.g. SKU-BLK-54" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={handleSaveVariant} className="btn btn-primary">{editingVariant ? 'Update' : 'Add'} Variant</button>
              <button onClick={() => setShowVariantModal(false)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showBulkUpdate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
          <div className="card" style={{ padding: '24px', maxWidth: '400px', width: '100%', position: 'relative' }}>
            <button onClick={() => setShowBulkUpdate(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <FiX size={20} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Bulk Stock Update</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>{selectedCount} variant(s) selected</p>
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>New Stock Value</label>
              <input className="input" type="number" value={bulkStockValue} onChange={(e) => setBulkStockValue(e.target.value)} placeholder="Enter stock quantity" min="0" />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleBulkStockUpdate} className="btn btn-primary" disabled={!bulkStockValue}>Update Stock</button>
              <button onClick={() => { setShowBulkUpdate(false); setBulkStockValue(''); }} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default SellerInventory;
