import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTag, FiPercent, FiCalendar, FiChevronRight, FiShield } from 'react-icons/fi';
import { coupons as couponsApi, saleEvents } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

/**
 * Offers - the one storefront surface that answers "what's on, right now".
 *
 * The header has pointed at /coupons for seasons, and /coupons has always
 * listed redeemable voucher codes only. Sale events - the outright festive
 * price drops ('Durga Puja: 30% off Ray-Ban eyeglasses') - were invisible on
 * the shopfront: they moved prices and the card badge, but nothing told the
 * customer the event existed or sent them to the items it applies to.
 *
 * This page shows BOTH public halves from the APIs that already serve them:
 * live sale events (name, window, %, and its actual BRAND + CATEGORY scope,
 * linked straight to the scoped browse), plus vouchers you can claim. The
 * banners can then link here, to a brand, or to a category - the whole point
 * of the linkUrl field.
 */
export default function Offers() {
  const [events, setEvents] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    saleEvents
      .getAll()
      .then((res) => {
        if (!live) return;
        const now = Date.now();
        const list = (res.data?.events || []).filter((e) => e.isActive && new Date(e.startDate) <= now && new Date(e.endDate) >= now);
        setEvents(list);
      })
      .catch(() => live && setError('Offers could not be loaded.'));
    couponsApi
      .getAll()
      .then((res) => live && setVouchers((res.data?.coupons || []).filter((c) => new Date(c.validUntil) >= new Date())))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const catHref = (c) => (c === 'all' ? '/category/sunglasses' : `/category/${c.replace('glasses', 'glasses')}`);

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const body = useMemo(() => {
    if (error) return <p style={{ padding: '40px 0', color: 'var(--danger)' }}>{error}</p>;
    if (events === null) return <p style={{ padding: '40px 0', color: 'var(--text-secondary)' }}>Loading offers…</p>;

    if (!events.length && !vouchers.length) {
      return (
        <div style={{ padding: '56px 0', textAlign: 'center', background: 'var(--bg-white)', borderRadius: 16 }}>
          <div style={{ fontSize: 30, color: 'var(--text-light)', marginBottom: 10 }}>✦</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>No live offers right now</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 22px', fontSize: 14 }}>Festive sales and vouchers will appear as soon as the desk puts one up.</p>
          <Link to="/brands" className="btn btn-outline">
            Browse brands
          </Link>
        </div>
      );
    }

    return (
      <>
        {events.length > 0 && (
          <section aria-label="Live sale events">
            <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Live sale events
            </h2>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {events.map((e) => (
                <article key={e._id} className="card card-pad" style={{ borderTop: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-tint, rgba(44,62,217,.08))', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiPercent size={19} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                        {e.name} · {e.discountPercentage}% off
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || ''}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
                    {(e.brands || []).map((b) => (
                      <Link key={b} to={`/brands/${encodeURIComponent(String(b).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}`} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--brand-tint)', color: 'var(--brand)', textDecoration: 'none', border: '1px solid var(--border-light)' }}>
                        {b}
                      </Link>
                    ))}
                    {(e.categories || []).map((c) => (
                      <Link key={c} to={catHref(c)} style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        {c === 'all' ? 'All eyewear' : c}
                      </Link>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-light)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <FiCalendar size={13} /> till {fmt(e.endDate)}
                    </span>
                    {e.categories?.[0] ? (
                      <Link to={catHref(e.categories[0])} className="btn btn-primary btn-sm">
                        Shop the event <FiChevronRight size={14} />
                      </Link>
                    ) : (
                      <Link to="/brands" className="btn btn-primary btn-sm">
                        Shop the event <FiChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {vouchers.length > 0 && (
          <section aria-label="Vouchers you can use" style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Vouchers you can use
            </h2>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
              {vouchers.map((c) => (
                <article key={c._id} className="card-flat" style={{ padding: '14px 16px', border: '1px dashed var(--border)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <FiTag size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'ui-monospace, monospace' }}>{c.code}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {c.discountType === 'percentage' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                        {(c.applicableBrands || []).length ? ` · ${c.applicableBrands.join(', ')}` : ''}
                        {(c.applicableCategories || []).length ? ` · ${(c.applicableCategories || []).join('/')}` : ''}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
              <FiShield size={13} /> Vouchers redeem at checkout against their scope; only eligible items get the discount.
            </p>
          </section>
        )}
      </>
    );
  }, [events, vouchers, error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Offers</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: -8 }}>Every live sale event and voucher, straight from the desk.</p>
          {body}
        </div>
      </main>
      <Footer />
    </div>
  );
}
