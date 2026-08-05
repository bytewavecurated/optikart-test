import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const ALL_CATEGORIES = [
  { 
    name: 'Sunglasses', 
    image: 'https://via.placeholder.com/300x300/2874f0/fff?text=🕶️', 
    link: '/category/sunglasses', 
    color: '#2874f0',
    description: 'Protect your eyes in style with our premium sunglasses collection',
    count: '500+ Products'
  },
  { 
    name: 'Eyeglasses', 
    image: 'https://via.placeholder.com/300x300/ff9f00/fff?text=👓', 
    link: '/category/eyeglasses', 
    color: '#ff9f00',
    description: 'Find the perfect frames for your prescription needs',
    count: '800+ Products'
  },
  { 
    name: 'Contact Lenses', 
    image: 'https://via.placeholder.com/300x300/388e3c/fff?text=👁️', 
    link: '/category/contact-lenses', 
    color: '#388e3c',
    description: 'Comfortable and clear vision with our contact lens range',
    count: '200+ Products'
  },
  { 
    name: 'Sports Eyewear', 
    image: 'https://via.placeholder.com/300x300/e43f5a/fff?text=🏃', 
    link: '/category/sports', 
    color: '#e43f5a',
    description: 'Performance eyewear designed for athletes and active lifestyles',
    count: '150+ Products'
  },
  { 
    name: 'Kids Eyewear', 
    image: 'https://via.placeholder.com/300x300/6c63ff/fff?text=🧒', 
    link: '/category/kids', 
    color: '#6c63ff',
    description: 'Durable and fun eyewear designed specifically for children',
    count: '120+ Products'
  },
  { 
    name: 'Reading Glasses', 
    image: 'https://via.placeholder.com/300x300/00897b/fff?text=📖', 
    link: '/category/reading', 
    color: '#00897b',
    description: 'Clear close-up vision for reading and detailed work',
    count: '180+ Products'
  },
  { 
    name: 'Computer Glasses', 
    image: 'https://via.placeholder.com/300x300/9c27b0/fff?text=💻', 
    link: '/category/computer', 
    color: '#9c27b0',
    description: 'Blue light blocking glasses for digital eye strain relief',
    count: '250+ Products'
  },
  { 
    name: 'Safety Eyewear', 
    image: 'https://via.placeholder.com/300x300/ff5722/fff?text=🛡️', 
    link: '/category/safety', 
    color: '#ff5722',
    description: 'Protective eyewear for industrial and workplace safety',
    count: '100+ Products'
  },
];

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    padding: '24px 0',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '12px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 24px',
  },
  card: {
    background: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'all 0.3s',
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: '200px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.3s',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 100%)',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '20px',
  },
  count: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
  },
  content: {
    padding: '20px',
  },
  name: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: '#666',
    lineHeight: 1.5,
    marginBottom: '16px',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#2874f0',
    fontSize: '14px',
    fontWeight: 600,
    gap: '4px',
  },
};

export default function Categories() {
  return (
    <div style={styles.container}>
      <Header />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Shop by Category</h1>
          <p style={styles.subtitle}>Explore our complete range of eyewear categories</p>
        </div>

        <div style={styles.grid}>
          {ALL_CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              to={cat.link}
              style={styles.card}
              className="category-grid-card"
            >
              <div style={styles.imageWrap}>
                <img src={cat.image} alt={cat.name} style={styles.image} />
                <div style={styles.overlay}>
                  <span style={styles.count}>{cat.count}</span>
                </div>
              </div>
              <div style={styles.content}>
                <h3 style={styles.name}>{cat.name}</h3>
                <p style={styles.description}>{cat.description}</p>
                <span style={styles.link}>
                  Browse Collection →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />

      <style>{`
        .category-grid-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .category-grid-card:hover img {
          transform: scale(1.05);
        }
        @media (max-width: 768px) {
          .category-grid-card:nth-child(n+5) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
