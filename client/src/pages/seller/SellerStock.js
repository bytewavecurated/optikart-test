import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cart as cartApi, listOf } from '../../services/apiBridge';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BackButton from '../../components/BackButton';
import toast from 'react-hot-toast';
import { toastError } from '../../services/errors';
import { FiSearch, FiPlus, FiTruck, FiCheck, FiX, FiTag, FiBox, FiAlertCircle } from 'react-icons/fi';

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Stat = ({ label, value, hint }) => (
  <div className="card-flat" style={{ padding: '14px 16px' }}>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{value}</div>
    {hint && <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>{hint}</div>}
  </div>
);

/** One listing row: price, discount, stock, and the two toggles that matter. */
const ListingRow = ({ row, onToggle, onList, onEdit }) => {
  const p = row.product || {};
  const discount = row.mrp && row.sellingPrice && row.mrp > row.sellingPrice
    ? Math.round(((row.mrp - row.sellingPrice) / row.mrp) * 100)
    : 0;
  const units = (row.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
  return (
    <tr style={{ background: row.isListed === false ? 'var(--bg-subtle)' : undefined }}>
      <td style={td}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <img src={p.images?.[0] || '/placeholder.svg'} alt="" style={{ width: 44, height: 44, objectFit: 'contain', background: 'var(--bg-subtle)', borderRadius: 8 }} />
          <div style={{ minWidth: 0 }}>
            <Link to={`/product/${p._id}`} style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{p.title || row.brand}</Link>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{p.modelNumber || row.modelNumber || ''}</div>
          </div>
        </div>
      </td>
      <td style={td}>{p.brand || row.brand}</td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700 }}>{inr(row.sellingPrice)}</span>
        {row.mrp > row.sellingPrice && (
          <span style={{ fontSize: 12, color: 'var(--text-light)', marginLeft: 6 }}>
            <s>{inr(row.mrp)}</s> <span style={{ color: 'var(--success)', fontWeight: 700 }}>{discount}% off</span>
          </span>
        )}
        {row.pendingChange?.status === 'awaiting_acceptance' && (
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 2 }}>awaiting your approval: {inr(row.pendingChange.sellingPrice)}</div>
        )}
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 700, color: units === 0 ? 'var(--danger)' : 'inherit' }}>{units}</span>
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{(row.variants || []).length} variant{(row.variants || []).length === 1 ? '' : 's'}</div>
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <button
          onClick={() => onToggle(row)}
          title={row.sellsWithPower ? 'Buyers can add prescription lenses to this' : 'Sold as-is only'}
          disabled={!p.poweredOptionsAvailable}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            cursor: p.poweredOptionsAvailable ? 'pointer' : 'not-allowed',
            border: `1px solid ${row.sellsWithPower ? 'var(--success)' : 'var(--border)'}`,
            background: row.sellsWithPower ? 'var(--success-light)' : 'var(--bg-white)',
            color: row.sellsWithPower ? 'var(--success)' : 'var(--text-light)',
            opacity: p.poweredOptionsAvailable ? 1 : 0.5
          }}
        >
          {row.sellsWithPower ? <FiCheck size={13} /> : <FiX size={13} />} With power
        </button>
        {!p.poweredOptionsAvailable && <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 3 }}>maker did not offer this frame glazed</div>}
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        <button onClick={() => onList(row)} className="btn btn-quiet" style={{ padding: '6px 12px', fontSize: 12.5 }}>
          {row.isListed === false ? 'List' : 'Unlist'}
        </button>
        <button onClick={() => onEdit(row)} className="btn btn-link" style={{ marginLeft: 8, fontSize: 12.5 }}>Edit</button>
      </td>
    </tr>
  );
};

/** Proposals awaiting the seller's answer, with the clock shown. */
const PendingProposals = ({ items, onDecide, busy }) => {
  if (!items.length) return null;
  return (
    <div className="card-flat" style={{ padding: 16, marginBottom: 18, borderLeft: '3px solid var(--warning)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FiAlertCircle size={17} style={{ color: 'var(--warning)' }} />
        <h2 style={{ fontSize: 14.5, fontWeight: 800, margin: 0 }}>Price changes waiting for you</h2>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Nothing changes on your listings until you accept. If you do not reply within seven working days the proposal expires and your current price stays.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((c) => {
          const left = c.expiresAt ? Math.max(0, Math.round((new Date(c.expiresAt) - Date.now()) / 864e5)) : null;
          return (
            <div key={c.stockId} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.product?.title || c.brand}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {inr(c.currentPrice)} <span style={{ color: 'var(--text-light)' }}>→</span> <b style={{ color: 'var(--text-primary)' }}>{inr(c.proposedPrice)}</b>
                  {c.requestedBy ? ` · requested by ${c.requestedBy}` : ''}
                  {left !== null ? ` · ${left} day(s) left` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={busy === c.stockId} onClick={() => onDecide(c, 'accept')} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}>Accept</button>
                <button disabled={busy === c.stockId} onClick={() => onDecide(c, 'decline')} className="btn btn-outline" style={{ padding: '7px 14px', fontSize: 13 }}>Keep current price</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
/** Pick a verified catalogue product and set your price and stock per variant. */
const AddListing = ({ catalogBrands, onSave, onCancel, saving }) => {
  const [brand, setBrand] = useState(catalogBrands[0]?.brand || '');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [variantRows, setVariantRows] = useState([]);
  const products = catalogBrands.find((b) => b.brand === brand)?.products || [];

  const choose = (id) => {
    const p = products.find((x) => x._id === id);
    setProductId(id);
    if (p) {
      setPrice(String(p.discountedPrice || p.price || ''));
      const colours = (p.colors || []).map((c) => c.name || c).filter(Boolean);
      const sizes = (p.sizes || []).filter(Boolean);
      setVariantRows(
        (colours.length && sizes.length
          ? colours.flatMap((c) => sizes.map((sz) => ({ color: c, size: sz })))
          : [{ color: '', size: '' }]
        ).map((v) => ({ ...v, stock: 0, price: p.discountedPrice || p.price || 0 }))
      );
    }
  };

  return (
    <div className="card-flat" style={{ padding: 18, marginBottom: 18 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px' }}>Stock a catalogue product</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Brand</label>
          <select className="input" value={brand} onChange={(e) => { setBrand(e.target.value); setProductId(''); }}>
            {catalogBrands.map((b) => <option key={b.brand} value={b.brand}>{b.brand} ({b.count})</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Product</label>
          <select className="input" value={productId} onChange={(e) => choose(e.target.value)}>
            <option value="">Choose a product</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Your selling price</label>
          <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!productId} />
        </div>
      </div>

      {productId && variantRows.length > 0 && (
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--text-secondary)', marginBottom: 8 }}>Quantity you hold, per colour and size</div>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
            <thead><tr>
              <th style={th}>Colour</th><th style={th}>Size</th><th style={th}>Stock</th><th style={th}>Price (optional)</th>
            </tr></thead>
            <tbody>
              {variantRows.map((v, i) => (
                <tr key={`${v.color}-${v.size}`}>
                  <td style={td}>{v.color || 'Any'}</td>
                  <td style={td}>{v.size || 'Any'}</td>
                  <td style={{ ...td, width: 110 }}>
                    <input className="input" type="number" min="0" value={v.stock} style={{ width: 90 }}
                      onChange={(e) => setVariantRows((rows) => rows.map((r, j) => (j === i ? { ...r, stock: Math.max(0, Number(e.target.value) || 0) } : r)))} />
                  </td>
                  <td style={{ ...td, width: 130 }}>
                    <input className="input" type="number" min="0" value={v.price} style={{ width: 110 }}
                      onChange={(e) => setVariantRows((rows) => rows.map((r, j) => (j === i ? { ...r, price: Number(e.target.value) || 0 } : r)))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          className="btn btn-primary"
          disabled={!productId || !price || saving}
          onClick={() => onSave({ productId, sellingPrice: Number(price), mrp: products.find((p) => p._id === productId)?.price, variants: variantRows })}
        >
          {saving ? 'Saving…' : 'Add to my listings'}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};
export default function SellerStock() {
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stock, cat, pc] = await Promise.all([
        cartApi.getMyStock(),
        cartApi.getStockCatalogue(),
        cartApi.getMyPriceChanges().catch(() => ({ data: { data: [] } }))
      ]);
      setRows(listOf(stock.data));
      setCatalog(cat.data.brands || []);
      setPending(pc.data.data || []);
    } catch (err) {
      toastError(err, 'Could not load your listings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let out = rows;
    if (view === 'listed') out = out.filter((r) => r.isListed !== false);
    if (view === 'power') out = out.filter((r) => r.sellsWithPower);
    if (view === 'zero') out = out.filter((r) => ((r.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0)) === 0);
    if (!search.trim()) return out;
    const q = search.toLowerCase();
    return out.filter((r) => [r.brand, r.modelNumber, r.product?.title].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, search, view]);

  const totalUnits = rows.reduce((sum, r) => sum + ((r.variants || []).length ? (r.variants || []).reduce((a, v) => a + (v.stock || 0), 0) : 0), 0);

  const togglePower = async (row) => {
    setBusy(String(row._id));
    try {
      await cartApi.updateStock(row._id, { sellsWithPower: !row.sellsWithPower });
      toast.success(!row.sellsWithPower ? 'Buyers can now add prescription lenses to this item' : 'Sold as-is only');
      load();
    } catch (err) {
      toastError(err, 'Could not update this listing');
    } finally { setBusy(''); }
  };

  const toggleListed = async (row) => {
    setBusy(String(row._id));
    try {
      await cartApi.updateStock(row._id, { isListed: row.isListed === false });
      load();
    } catch (err) {
      toastError(err, 'Could not change listing state');
    } finally { setBusy(''); }
  };

  const saveNew = async (draft) => {
    setSaving(true);
    try {
      await cartApi.listStock({
        productId: draft.productId,
        sellingPrice: draft.sellingPrice,
        variants: draft.variants.filter((v) => Number(v.stock) >= 0)
      });
      toast.success('Listing added');
      setShowAdd(false);
      load();
    } catch (err) {
      toastError(err, 'Could not save listing');
    } finally { setSaving(false); }
  };

  const decide = async (c, decision) => {
    setBusy(c.stockId);
    try {
      const res = await cartApi.decideMyPriceChange(c.stockId, decision);
      toast.success(res.data.message);
      load();
    } catch (err) {
      toastError(err, 'Could not record your decision');
    } finally { setBusy(''); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header />
      <main className="container" style={{ flex: 1, maxWidth: 1200, padding: '18px 20px 44px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <BackButton to="/seller/dashboard" />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 0' }}>My listings</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              What you stock, at your price, per colour and size - and whether you sell it with prescription lenses.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <FiPlus size={16} /> Stock a product
          </button>
        </div>

        {loading ? (
          <div className="card-flat" style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
        ) : (
          <>
            <PendingProposals items={pending} onDecide={decide} busy={busy} />
            {showAdd && <AddListing catalogBrands={catalog} onSave={saveNew} saving={saving} onCancel={() => setShowAdd(false)} />}

            <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <Stat label="Listings" value={rows.length} hint={`${rows.filter((r) => r.isListed !== false).length} live`} />
                <Stat label="Units held" value={totalUnits.toLocaleString('en-IN')} />
                <Stat label="Sold with power" value={rows.filter((r) => r.sellsWithPower).length} hint="prescription orders route to you" />
                <Stat label="Awaiting approval" value={pending.length} hint={pending.length ? 'action needed' : 'nothing pending'} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <FiSearch size={15} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-light)' }} />
                <input className="input" placeholder="Search brand, model or product" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
              {[['all', 'All'], ['listed', 'Live'], ['power', 'With power'], ['zero', 'Out of stock']].map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className={`chip ${view === k ? 'is-active' : ''}`}>{l}</button>
              ))}
            </div>

            <div className="card-flat" style={{ overflowX: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 46, textAlign: 'center' }}>
                  <FiBox size={32} style={{ color: 'var(--text-light)', marginBottom: 10 }} />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                    {rows.length === 0 ? 'You have not listed anything yet. Choose a catalogue product and set your stock.' : 'No listings match this filter.'}
                  </p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Product</th><th style={th}>Brand</th><th style={th}>Your price</th>
                    <th style={th}>Stock</th><th style={th}>Prescription</th><th style={{ ...th, textAlign: 'right' }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((r) => (
                      <ListingRow key={r._id} row={r} onToggle={togglePower} onList={toggleListed} onEdit={() => toast('Edit prices from Inventory, then use Stock a product to relist.')} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
