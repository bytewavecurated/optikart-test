import React from 'react';
import { FiChevronRight } from 'react-icons/fi';

const BRANDS = [
  { name: 'Ray-Ban', slug: 'ray-ban', startPrice: 2999, color: 'var(--bg-dark)', tagline: 'Iconic Style' },
  { name: 'Fastrack', slug: 'fastrack', startPrice: 999, color: 'var(--danger)', tagline: 'Youth Vibe' },
  { name: 'Lenskart Air', slug: 'lenskart-air', startPrice: 1499, color: 'var(--brand)', tagline: 'Featherlight' },
  { name: 'John Jacobs', slug: 'john-jacobs', startPrice: 2499, color: 'var(--text-primary)', tagline: 'Premium Craft' },
  { name: 'Vogue', slug: 'vogue', startPrice: 3499, color: 'var(--brand-dark)', tagline: 'Fashion Forward' },
  { name: 'Oakley', slug: 'oakley', startPrice: 4999, color: 'var(--warning)', tagline: 'Performance' },
];

const styles = {
  section: {
    background: 'var(--bg-white)',
    margin: '16px 0',
    padding: '20px 24px',
    borderRadius: 'var(--radius-xs)',
    boxShadow: 'var(--shadow)',
    fontFamily: "var(--font-body)",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '16px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 12px',
    borderRadius: 'var(--radius-xs)',
    border: '1px solid var(--bg-subtle)',
    textDecoration: 'none',
    transition: 'all 0.2s',
    cursor: 'pointer',
    textAlign: 'center',
    background: 'var(--bg-white)',
  },
  logoCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--text-white)',
    letterSpacing: '-1px',
  },
  brandName: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  tagline: {
    fontSize: '12px',
    color: 'var(--text-light)',
    marginBottom: '8px',
  },
  startPrice: {
    fontSize: '13px',
    color: 'var(--success)',
    fontWeight: 600,
  },
};

export default function BrandSection() {
  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>Top Brands</h2>
        <a href="/brands" style={styles.viewAll}>
          View All <FiChevronRight />
        </a>
      </div>

      <div style={styles.grid} className="brand-grid">
        {BRANDS.map((brand) => (
          <a
            key={brand.slug}
            href={`/brands/${brand.slug}`}
            style={styles.card}
            className="brand-card"
          >
            <div style={{ ...styles.logoCircle, background: brand.color }}>
              {brand.name.substring(0, 2).toUpperCase()}
            </div>
            <div style={styles.brandName}>{brand.name}</div>
            <div style={styles.tagline}>{brand.tagline}</div>
            <div style={styles.startPrice}>Starting ₹{brand.startPrice.toLocaleString()}</div>
          </a>
        ))}
      </div>

      <style>{`
        .brand-card:hover {
          box-shadow: var(--shadow-lg) !important;
          transform: translateY(-3px);
        }
        @media (max-width: 1024px) {
          .brand-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .brand-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
