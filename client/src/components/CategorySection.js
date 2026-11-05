import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

const CATEGORIES = [
  { name: 'Sunglasses', image: '/assets/face-1.svg', link: '/category/sunglasses', color: 'var(--brand)' },
  { name: 'Eyeglasses', image: '/assets/face-1.svg', link: '/category/eyeglasses', color: 'var(--warning)' },
  { name: 'Contact Lenses', image: '/assets/face-3.svg', link: '/category/contact-lenses', color: 'var(--success)' },
  { name: 'Sports', image: '/assets/face-1.svg', link: '/category/sports', color: 'var(--danger)' },
  { name: 'Kids', image: '/assets/face-5.svg', link: '/category/kids', color: 'var(--brand)' },
  { name: 'Reading', image: '/assets/face-1.svg', link: '/category/reading', color: 'var(--success)' },
  { name: 'Computer', image: '/assets/face-1.svg', link: '/category/computer', color: 'var(--brand-dark)' },
  { name: 'Safety', image: '/assets/face-1.svg', link: '/category/safety', color: 'var(--danger)' },
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
  scrollContainer: {
    display: 'flex',
    gap: '24px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: '8px',
    scrollBehavior: 'smooth',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    minWidth: '130px',
    textDecoration: 'none',
    transition: 'transform 0.2s',
  },
  imageWrap: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: '3px solid var(--bg-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center',
  },
  viewMore: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '120px',
    border: '2px dashed #d0d0d0',
    borderRadius: '50%',
    width: '120px',
    height: '120px',
    color: 'var(--brand)',
    fontWeight: 600,
    fontSize: '13px',
    textDecoration: 'none',
    transition: 'all 0.2s',
    textAlign: 'center',
    lineHeight: '1.3',
    background: 'var(--bg-white)',
  },
};

/**
 * The heading is passed down from the home page: an administrator editing the
 * "Shop by Category" wording should not find two copies of it, one changed and
 * one still hardcoded in the component.
 */
export default function CategorySection({ title, subtitle }) {
  const scrollRef = useRef(null);

  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>{title || 'Shop by Category'}</h2>
        <Link to="/categories" style={styles.viewAll}>
          View All <FiChevronRight />
        </Link>
      </div>

      <div style={styles.scrollContainer} ref={scrollRef}>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.name}
            to={cat.link}
            style={styles.card}
            className="category-card"
          >
            <div
              style={styles.imageWrap}
              className="category-image-wrap"
            >
              <img src={cat.image} alt={cat.name} style={styles.image} />
            </div>
            <span style={styles.name}>{cat.name}</span>
          </Link>
        ))}

        <Link to="/categories" style={styles.viewMore} className="view-more-btn">
          View<br />More
        </Link>
      </div>

      <style>{`
        .category-card:hover .category-image-wrap {
          border-color: #2874f0 !important;
          box-shadow: 0 2px 12px rgba(40,116,240,0.2) !important;
        }
        .category-card:hover { transform: translateY(-4px); }
        .view-more-btn:hover {
          border-color: #2874f0 !important;
          background: #f0f6ff !important;
        }
        @media (max-width: 768px) {
          .category-card:nth-child(n+4) { display: none; }
        }
      `}</style>
    </div>
  );
}
