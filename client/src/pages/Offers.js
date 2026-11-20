import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiChevronRight, FiPercent, FiTag } from 'react-icons/fi';
import { coupons as couponsApi, saleEvents } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

const catHref = (c) => (c === 'all' ? '/offers' : `/category/${c}`);

/**
 * The public Offers surface. Two mechanisms, one page:
 *  - live sale events (the outright festive price drops: a percentage window
 *    over categories and/or named brands) read from GET /sale-events'
 *    ACTIVE set - the same server decision that reprices the catalogue;
 *  - public vouchers (GET /coupons) listed honestly with their scope: when a
 *    code says 'eyeglasses only', that's printed on the ticket, not hidden
 *    behind a click.
 * Each card deep-links to what the offer actually covers (brand chip -> the
 * brand's storefront; category chip -> that browse) so banner CTAs, the bell
 * and this page all land on the same truth the pricing engine used.
 */
export default function Offers() {
  const [events, setEvents] = useState(null);
  const [vouchers, setVouchers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    saleEvents
      .getAll()
      .then((res) => live && setEvents((res.data?.activeEvents || []).filter((e) => e.isActive)))
      .catch((e) => live && (setError(e.message), setEvents([])));
    couponsApi
      .getAll()
      .then((res) => {
        if (!live) return;
        const now = new Date();
        setVouchers(
          (res.data?.coupons || []).filter(
            (c) => c.isActive && new Date(c.validFrom) <= now && new Date(c.validUntil) >= now
          )
        );
      })
      .catch(() => live && setVouchers([]));
    return () => {
      live = false;
    };
  }, []);

  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const activeCount = events?.length || 0;
  const voucherCount = vouchers?.length || 0;

  const title = useMemo(() => {
    if (events === null || vouchers === null) return 'Checking what is live…';
    if (activeCount) return `${activeCount} live offer${activeCount === 1 ? '' : 's'}`;
    return error ? 'Offer board' : 'No live offers right now';
  }, [events, vouchers, activeCount, error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{title}</h1>
            <Link to="/products" className="btn btn-outline">
              Browse everything <FiChevronRight size={14} style={{ verticalAlign: -2, marginLeft: 6 }} />
            </Link>
          </div>

          {events === null || vouchers === null ? (
            <div
              className="card card-flat"
              style={{ padding: 26, textAlign: 'center', color: 'var(--text-secondary)' }}
            >
              Loading offers - reading the event board and the voucher case.
            </div>
          ) : activeCount === 0 && voucherCount === 0 ? (
            <div className="card card-flat" style={{ padding: 34, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                {error ? 'The offer board could not be reached' : 'Nothing discounted right now'}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 0 }}>
                {error ||
                  'When a festive price event or a voucher goes live, it appears here - priced exactly as the shopfront prices it.'}
              </p>
              <Link to="/categories" className="btn btn-outline" style={{ marginTop: 10 }}>
                Browse categories
              </Link>
            </div>
          ) : (
            <>
              {activeCount > 0 && (
                <>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      margin: '2px 0 12px',
                    }}
                  >
                    Price events
                  </h2>
                  <div
                    style={{
                      display: 'grid',
                      gap: 14,
                      gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
                      marginBottom: 26,
                    }}
                  >
                    {events.map((e) => (
                      <article
                        key={e._id}
                        className="card-flat"
                        style={{ padding: 16, borderLeft: '4px solid var(--primary)' }}
                      >
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                          <span
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: 'var(--primary-tint, rgba(63,81,181,.12))',
                              color: 'var(--primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FiPercent size={18} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{e.name}</h3>
                            <p
                              style={{
                                margin: '2px 0 0',
                                fontSize: 12.5,
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 280,
                              }}
                            >
                              {e.description || ''}
                            </p>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            alignItems: 'center',
                            margin: '10px 0 12px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--text-light)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <FiCalendar size={13} /> until{' '}
                            {new Date(e.endDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', marginLeft: 'auto' }}>
                            {e.discountPercentage}% off
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(e.brands || []).map((b) => (
                            <Link
                              key={b}
                              to={`/brands/${encodeURIComponent(String(b).trim().toLowerCase().replace(/\s+/g, '-'))}`}
                              className="pill"
                            >
                              {b}
                            </Link>
                          ))}
                          {e.brands?.length ? (
                            <span style={{ fontSize: 12, color: 'var(--text-light)', alignSelf: 'center' }}>
                              {(e.categories || []).includes('all')
                                ? ' · in all listed categories'
                                : ` · ${(e.categories || []).join(', ')}`}
                            </span>
                          ) : (
                            (e.categories || []).map((c) =>
                              c && c !== 'all' ? (
                                <Link
                                  key={c}
                                  to={c === 'all' ? '/products' : `/category/${c}`}
                                  className="pill"
                                  style={{ textTransform: 'capitalize' }}
                                >
                                  {c
                                    .replace('contactlenses', 'contact lenses')
                                    .replace('readingglasses', 'reading glasses')
                                    .replace('sportseyewear', 'sports')}
                                </Link>
                              ) : null
                            )
                          )}
                        </div>

                        <Link
                          to={
                            e.brands?.length
                              ? `/brands/${encodeURIComponent(String(e.brands[0]).trim().toLowerCase().replace(/\s+/g, '-'))}`
                              : (e.categories || []).includes('all') || !e.categories?.length
                                ? '/products'
                                : `/category/${e.categories[0]}`
                          }
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 14, width: 'fit-content' }}
                        >
                          Shop the event <FiChevronRight size={13} style={{ verticalAlign: -2, marginLeft: 6 }} />
                        </Link>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {voucherCount > 0 && (
                <>
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      margin: '2px 0 12px',
                    }}
                  >
                    Vouchers (enter at checkout)
                  </h2>
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(230px,2fr))' }}>
                    {vouchers.map((v) => (
                      <article key={v._id} className="card card-flat" style={{ padding: 14 }}>
                        <code
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: 800,
                            fontSize: 15,
                          }}
                        >
                          <FiTag size={15} style={{ color: 'var(--primary)' }} /> {v.code}
                        </code>
                        <div style={{ fontSize: 13.5, marginTop: 6 }}>
                          {v.discountType === 'percentage'
                            ? `${v.discountValue}% off`
                            : `${money(v.discountValue)} off`}
                          {v.maxDiscount ? ` · up to ${money(v.maxDiscount)}` : ''}
                          {v.minOrderAmount ? ` · min ${money(v.minOrderAmount)}` : ''}
                        </div>
                        {(v.applicableCategories?.length || v.applicableBrands?.length) > 0 && (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: 'var(--text-secondary)',
                              marginTop: 6,
                              wordBreak: 'break-word',
                            }}
                          >
                            only: {[...(v.applicableCategories || []), ...(v.applicableBrands || [])].join(', ')}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
                          until {new Date(v.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
