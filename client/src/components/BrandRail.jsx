import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import api from '../services/api';

/**
 * A rail of brands, read from the catalogue instead of typed into the file.
 *
 * The components this replaces held a hardcoded array invented in the front end:
 * six brands, their "starting at" prices and marketing taglines, and slugs like
 * `lenskart-air` that no longer matched anything. Nothing on the storefront could
 * disagree with it loudly enough to be noticed - so a shopper was shown
 * "Starting ₹2,999" for a price that existed in no database, while a brand that
 * actually shipped 40 frames appeared nowhere. Worse, clicking a tile went to a
 * URL built from that fiction.
 *
 * Everything here comes from `/brands/with-logos`, which is gated by the same
 * visibility rule as the product list. Two consequences are deliberate:
 *
 *  - `minPrice: null` means "no priced product", and we render nothing at all.
 *    Rendering ₹0 for missing data would invent the cheapest thing on the site.
 *  - A brand with no approved logo falls back to its initial. The fallback stays
 *    because it is honest: the desk has not cleared a mark for it yet.
 */

const BRAND_TONES = [
  'var(--bg-dark)',
  'var(--brand)',
  'var(--brand-dark)',
  'var(--text-primary)',
  'var(--danger)',
  'var(--warning)',
];

const styles = {
  section: {
    background: 'var(--bg-white)',
    margin: '16px 0',
    padding: '20px 24px',
    borderRadius: 'var(--radius-xs)',
    boxShadow: 'var(--shadow)',
    fontFamily: 'var(--font-body)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  title: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  viewAll: {
    color: 'var(--brand)',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 12px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--bg-subtle)',
    textDecoration: 'none',
    cursor: 'pointer',
    textAlign: 'center',
    background: 'var(--bg-white)',
  },
  markCell: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    overflow: 'hidden',
    background: 'var(--bg-subtle)',
  },
  letter: { fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' },
  logo: { width: '100%', height: '100%', objectFit: 'contain', background: 'var(--bg-white)' },
  brandName: { fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' },
  price: { fontSize: '13px', color: 'var(--success)', fontWeight: 600 },
  count: { fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' },
  note: { fontSize: '13px', color: 'var(--text-light)', padding: '12px 0' },
  error: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '14px' },
  retry: {
    background: 'none',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-xs)',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/*
 * The tone is decoration for the letter tile, so it is derived from the brand
 * rather than from the position in the array: re-ranking the rail must not
 * repaint every other brand.
 */
const tone = (brand) => {
  const key = String((brand && (brand.slug || brand.name)) || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 9973;
  return BRAND_TONES[hash % BRAND_TONES.length];
};

export default function BrandRail({
  title = 'Top Brands',
  category,
  viewAllTo = '/brands',
  viewAllLabel = 'View All',
  emptyMessage = 'No brands are live yet. Products appear here once they are verified.',
}) {
  const [brands, setBrands] = React.useState(null);
  const [error, setError] = React.useState(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get('/brands/with-logos', { params: category ? { category } : {} });
      setBrands(Array.isArray(data?.brands) ? data.brands : []);
    } catch (e) {
      /*
       * Failure says so. The old components could not fail - they had no request
       * to fail - and a rail that shows nothing while silently keeping stale
       * invented data is worse than an empty rail with a reason and a retry.
       */
      setError(e?.response?.data?.message || e?.message || 'The brand list could not be loaded.');
      setBrands(null);
    }
  }, [category]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div style={styles.section}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <Link to="/brands" style={styles.viewAll}>
            Browse catalogue <FiChevronRight />
          </Link>
        </div>
        <p style={styles.error}>
          <FiAlertCircle /> {error}
        </p>
        <button style={styles.retry} onClick={load} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (brands === null) {
    return (
      <div style={styles.section}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
        </div>
        <p style={styles.note}>Loading brands from the live catalogue…</p>
      </div>
    );
  }

  if (!brands.length) {
    return (
      <div style={styles.section}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
        </div>
        <p style={styles.note}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        <Link to={viewAllTo} style={styles.viewAll}>
          {viewAllLabel} <FiChevronRight />
        </Link>
      </div>

      <div style={styles.grid} className="brand-grid">
        {brands.map((brand) => (
          <Link
            key={brand.urlSlug || brand.slug}
            to={`/brands/${brand.urlSlug}`}
            style={styles.card}
            data-pc-root="1" className="brand-card"
          >
            <div data-pc-media="1" style={styles.markCell}>
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.name} logo`}
                  style={styles.logo}
                  onError={(event) => {
                    // A mark that 404s must degrade to the initial it replaced,
                    // not to an empty circle.
                    event.currentTarget.style.display = 'none';
                    event.currentTarget.parentElement.textContent = brand.letter;
                  }}
                />
              ) : (
                <span
                  style={{ ...styles.letter, color: 'var(--text-white)', background: tone(brand) }}
                  aria-hidden="true"
                >
                  {brand.letter}
                </span>
              )}
            </div>
            <div data-pc-body="1" style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.brandName}>{brand.name}</div>
            {brand.minPrice != null && <div style={styles.price}>From {rupees(brand.minPrice)}</div>}
            <div style={styles.count}>
              {brand.productCount} {brand.productCount === 1 ? 'style' : 'styles'} live
            </div>
          </div>
          </Link>
        ))}
      </div>

      <style>{`
        .brand-card { transition: box-shadow .2s, transform .2s; position: relative; }
        .brand-card:hover { box-shadow: var(--shadow-lg) !important; transform: translateY(-3px); }
        @media (max-width: 1024px) { .brand-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 600px) { .brand-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </div>
  );
}
