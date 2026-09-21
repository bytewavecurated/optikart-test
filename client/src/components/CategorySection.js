import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

const CATEGORIES = [
  { name: 'Sunglasses', image: 'https://via.placeholder.com/120x120/2874f0/fff?text=Sun', link: '/category/sunglasses', color: '#2874f0' },
  { name: 'Eyeglasses', image: 'https://via.placeholder.com/120x120/ff9f00/fff?text=Eye', link: '/category/eyeglasses', color: '#ff9f00' },
  { name: 'Contact Lenses', image: 'https://via.placeholder.com/120x120/388e3c/fff?text=CL', link: '/category/contact-lenses', color: '#388e3c' },
  { name: 'Sports', image: 'https://via.placeholder.com/120x120/e43f5a/fff?text=Sport', link: '/category/sports', color: '#e43f5a' },
  { name: 'Kids', image: 'https://via.placeholder.com/120x120/6c63ff/fff?text=Kids', link: '/category/kids', color: '#6c63ff' },
  { name: 'Reading', image: 'https://via.placeholder.com/120x120/00897b/fff?text=Read', link: '/category/reading', color: '#00897b' },
  { name: 'Computer', image: 'https://via.placeholder.com/120x120/9c27b0/fff?text=PC', link: '/category/computer', color: '#9c27b0' },
  { name: 'Safety', image: 'https://via.placeholder.com/120x120/ff5722/fff?text=Safe', link: '/category/safety', color: '#ff5722' },
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
    border: '3px solid #f1f3f6',
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
    color: '#333',
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
    color: '#2874f0',
    fontWeight: 600,
    fontSize: '13px',
    textDecoration: 'none',
    transition: 'all 0.2s',
    textAlign: 'center',
    lineHeight: '1.3',
    background: '#fff',
  },
};

export default function CategorySection() {
  const scrollRef = useRef(null);

  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>Shop by Category</h2>
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
