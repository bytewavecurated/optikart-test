import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiRefreshCw, FiTruck, FiPackage, FiClock } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from '../../services/api';
import { toastError } from '../../services/errors';
import SupplyDeclaration from '../../components/SupplyDeclaration';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

/*
 * Stocking another company's brand at OptiKart.
 *
 * This page is why the supply-claim rule is real rather than paperwork. A
 * listing of a branded frame is a statement that the brand supplied this shop,
 * and nothing else in the system can tell that statement from a purchase made
 * off a closing retailer. So the source is said here, in a form the brand can
 * actually check, and the listing then belongs to two queues before it belongs
 * to a customer: the brand's approval, then the platform's verification.
 *
 * Three states are shown because they feel completely different from the shop's
 * side - one needs waiting, one needs an action, one needs a new claim - and a
 * dashboard that renders all of them as "pending" teaches nobody anything.
 */
const STATE_META = {
  awaiting_manufacturer: {
    label: 'Waiting on the brand',
    detail: 'The brand has been asked whether it supplied you. Nothing is visible to buyers until it answers.',
    tone: 'warning'
  },
  awaiting_admin: {
    label: 'Waiting on OptiKart',
    detail: 'The brand confirmed it supplied you. OptiKart verifies the listing itself before it can sell.',
    tone: 'warning'
  },
  live: {
    label: 'Live',
    detail: 'Buyers can see it and order routing can offer it work.',
    tone: 'success'
  },
  rejected: {
    label: 'Refused',
    detail: 'It cannot be sold. Stocking it again needs a new declaration and both approvals again.',
    tone: 'danger'
  },
  paused: {
    label: 'Paused by you',
    detail: 'Hidden from buyers. Price and stock are kept; listing it again needs a fresh declaration.',
    tone: 'muted'
  }
};

const toneStyle = {
  warning: { bg: 'rgba(217, 119, 6, .12)', fg: '#8a6d3b' },
  success: { bg: 'rgba(22, 163, 74, .12)', fg: 'var(--success)' },
  danger: { bg: 'rgba(220, 38, 38, .10)', fg: 'var(--danger)' },
  muted: { bg: 'var(--bg-subtle, #f1f3f5)', fg: 'var(--text-secondary)' }
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const SellerBrandStock = () => {
  const [rows, setRows] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ open: false, product: null, price: '', units: '', proof: { kind: '', reference: '', note: '' } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, catalogueRes] = await Promise.all([
        api.get('/seller-stock'),
        api.get('/seller-stock/catalogue')
      ]);
      setRows(mine.data?.stock || mine.data?.data || mine.data || []);
      setCatalogue(catalogueRes.data?.catalogue || []);
    } catch (error) {
      toastError(error, 'Your listings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const productsByBrand = useMemo(() => {
    const map = new Map();
    for (const brand of catalogue) {
      map.set(brand.brand, (brand.products || []).filter((p) => p.manufacturer));
    }
    return map;
  }, [catalogue]);

  const brandOptions = useMemo(
    () => [...productsByBrand.entries()].filter(([, list]) => list.length).map(([brand, list]) => ({ brand, products: list })),
    [productsByBrand]
  );

  const openForm = () => {
    const first = brandOptions[0];
    setForm({
      open: true,
      brand: first?.brand || '',
      product: first?.products[0] || null,
      price: first?.products[0] ? String(first.products[0].discountedPrice || first.products[0].price || '') : '',
      units: '',
      proof: { kind: '', reference: '', note: '' }
    });
  };

  const pickBrand = (brand) => {
    const list = productsByBrand.get(brand) || [];
    setForm((f) => ({
      ...f,
      brand,
      product: list[0] || null,
      price: list[0] ? String(list[0].discountedPrice || list[0].price || '') : '',
      // A new product is a new claim: what was typed for another frame has no
      // bearing on this one, and carrying it over would pre-fill the answer.
      proof: { kind: '', reference: '', note: '' }
    }));
  };

  const submit = async () => {
    const { product, price, units, proof } = form;
    if (!product) return;
    const sellingPrice = Number(price);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      toast.error('Enter the price you will sell this at.');
      return;
    }
    const stock = Math.max(0, Number(units) || 0);

    setBusy('submit');
    try {
      const res = await api.post('/seller-stock', {
        productId: product._id,
        sellingPrice,
        // The colour/size the shop actually holds. Routing offers an order only
        // to sellers who hold the exact configuration the buyer chose, so this
        // is the field that decides whether this listing ever gets work.
        variants: [{ color: product.colors?.[0]?.name || product.colors?.[0] || '', size: product.sizes?.[0] || '', stock }],
        isListed: true,
        proofKind: proof.kind,
        proofReference: proof.reference,
        proofNote: proof.note
      });
      if (res.data?.state === 'live') {
        toast.success('Listing saved and visible to buyers.');
      } else {
        toast.success(res.data?.message || 'Sent to the brand for approval.');
      }
      setForm({ open: false });
      await load();
    } catch (error) {
      // The declaration is kept on screen when the server refuses it: the shop
      // has already typed the reference, and losing it to a validation message
      // means typing it out again from the invoice.
      toastError(error, error.response?.data?.message || 'The listing could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const pause = async (row) => {
    setBusy(String(row._id));
    try {
      await api.put(`/seller-stock/${row._id}`, { isListed: false });
      toast.info('Paused. Your price and stock are kept.');
      await load();
    } catch (error) {
      toastError(error, 'The listing could not be paused.');
    } finally {
      setBusy('');
    }
  };

  const errors = brandOptions.length === 0 && !loading;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <FiPackage style={{ color: 'var(--primary)' }} /> Brand listings
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 720, lineHeight: 1.6 }}>
              Frames from a brand that supply you. Each listing is a claim about where your stock came from, so the
              brand confirms it and OptiKart verifies the listing before buyers can see it.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-quiet" onClick={load} disabled={loading}>
              <FiRefreshCw style={{ marginRight: 6 }} />{loading ? 'Loading' : 'Refresh'}
            </button>
            <button className="btn btn-primary" onClick={openForm} disabled={errors}>
              <FiPlus style={{ marginRight: 6 }} /> List a brand frame
            </button>
          </div>
        </div>

        {errors && (
          <div className="card" style={{ padding: 16, marginTop: 14, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            No branded catalogue is open to your account yet. Brand listings come from manufacturers who have
            added your shop; your own products are listed under
            {' '}<Link to="/seller/products" style={{ color: 'var(--primary)' }}>My products</Link>.
          </div>
        )}

        {form.open && (
          <div className="card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Brand</label>
                <select className="input" value={form.brand} onChange={(e) => pickBrand(e.target.value)}>
                  {brandOptions.map((b) => <option key={b.brand} value={b.brand}>{b.brand}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Product</label>
                <select
                  className="input"
                  value={form.product?._id || ''}
                  onChange={(e) => {
                    const p = (productsByBrand.get(form.brand) || []).find((x) => x._id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      product: p || null,
                      price: p ? String(p.discountedPrice || p.price || '') : '',
                      proof: { kind: '', reference: '', note: '' }
                    }));
                  }}
                >
                  {(productsByBrand.get(form.brand) || []).map((p) => (
                    <option key={p._id} value={p._id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Your price</label>
                <input className="input" type="number" min="1" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                {form.product?.mrp && Number(form.price) > Number(form.product.mrp) && (
                  <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                    Above the listed MRP of {inr(form.product.mrp)} - buyers will not see a higher price than that.
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Units in your shop</label>
                <input className="input" type="number" min="0" value={form.units} onChange={(e) => setForm((f) => ({ ...f, units: e.target.value }))} placeholder="e.g. 6" />
                <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 4 }}>
                  Only orders for the configuration you hold can be routed to you.
                </div>
              </div>
            </div>

            <SupplyDeclaration
              value={form.proof}
              onChange={(proof) => setForm((f) => ({ ...f, proof }))}
              productName={form.product?.title}
              busy={busy === 'submit'}
              onSubmit={submit}
              onCancel={() => setForm({ open: false })}
            />
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {rows.length === 0 && !loading && !errors && (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <FiClock size={20} style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No brand listings yet</div>
              <div style={{ fontSize: 13 }}>List a frame and the brand is asked to confirm your stock.</div>
            </div>
          )}

          {rows.map((row) => {
            const listing = row.listing || {};
            const state = STATE_META[listing.state || 'live'];
            const tone = toneStyle[state.tone];
            const product = row.product || {};
            const units = (row.variants || []).reduce((n, v) => n + (Number(v.stock) || 0), 0);
            return (
              <div key={row._id} className="card" style={{ padding: 14, border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{product.title || row.modelNumber || 'A listing'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {product.brand || row.brand}
                      {(product.colors || []).length ? ` · ${product.colors.map((c) => c.name || c).join(', ')}` : ''}
                      {` · ${units} unit${units === 1 ? '' : 's'} held`}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{inr(row.sellingPrice)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: tone.bg, color: tone.fg }}>
                      {state.label}
                    </span>
                    <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 4, maxWidth: 260, lineHeight: 1.5 }}>
                      {state.detail}
                    </div>
                  </div>
                </div>

                {listing.sellerProof?.kind && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Declared source:{' '}
                    {listing.sellerProof.kind === 'other'
                      ? <em>{listing.sellerProof.note}</em>
                      : <strong>{listing.sellerProof.reference}</strong>}
                    {listing.declarationCount > 1 ? ` · declared ${listing.declarationCount} times` : ''}
                    {listing.manufacturerReview?.status === 'approved' ? ' · brand confirmed' : ''}
                  </div>
                )}

                {listing.state === 'rejected' && (
                  <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>
                    Reason: {listing.manufacturerReview?.reason || listing.adminReview?.reason || 'none recorded'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {listing.state !== 'paused' && units >= 0 && (
                    <button className="btn btn-quiet" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={busy === String(row._id)} onClick={() => pause(row)}>
                      Pause listing
                    </button>
                  )}
                  <Link to="/seller/stock" className="btn btn-link" style={{ fontSize: 12.5 }}>
                    Manage price &amp; variants
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SellerBrandStock;
