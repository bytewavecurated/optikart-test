import React from 'react';
import { FiChevronRight } from 'react-icons/fi';

const BRANDS = [
  { name: 'Ray-Ban', slug: 'ray-ban', startPrice: 2999, color: '#1a1a2e', tagline: 'Iconic Style' },
  { name: 'Fastrack', slug: 'fastrack', startPrice: 999, color: '#e43f5a', tagline: 'Youth Vibe' },
  { name: 'Lenskart Air', slug: 'lenskart-air', startPrice: 1499, color: '#2874f0', tagline: 'Featherlight' },
  { name: 'John Jacobs', slug: 'john-jacobs', startPrice: 2499, color: '#4a4a4a', tagline: 'Premium Craft' },
  { name: 'Vogue', slug: 'vogue', startPrice: 3499, color: '#9c27b0', tagline: 'Fashion Forward' },
  { name: 'Oakley', slug: 'oakley', startPrice: 4999, color: '#ff6f00', tagline: 'Performance' },
];

const styles = {
  section: {
    background: '#fff',
    margin: '16px 0',
    padding: '20px 24px',
    borderRadius: '4px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    fontFamily: "'Roboto', sans-serif",
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
    color: '#212121',
  },
  viewAll: {
    color: '#2874f0',
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
    borderRadius: '4px',
    border: '1px solid #f0f0f0',
    textDecoration: 'none',
    transition: 'all 0.2s',
    cursor: 'pointer',
    textAlign: 'center',
    background: '#fff',
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
    color: '#fff',
    letterSpacing: '-1px',
  },
  brandName: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '4px',
  },
  tagline: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
  },
  startPrice: {
    fontSize: '13px',
    color: '#388e3c',
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
          box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
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
