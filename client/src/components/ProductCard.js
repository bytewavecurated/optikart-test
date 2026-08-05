import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart, FiShoppingCart, FiStar } from 'react-icons/fi';

const styles = {
  card: {
    background: '#fff',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s, transform 0.2s',
    cursor: 'pointer',
    position: 'relative',
    fontFamily: "'Roboto', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  cardHover: {
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    transform: 'translateY(-2px)',
  },
  imageWrap: {
    position: 'relative',
    height: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: '#fafafa',
    overflow: 'hidden',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  wishlistBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    zIndex: 2,
  },
  body: {
    padding: '12px 16px 16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  brand: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  title: {
    fontSize: '14px',
    color: '#555',
    lineHeight: '1.4',
    marginBottom: '8px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minHeight: '39px',
  },
  ratingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  ratingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    background: '#388e3c',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '12px',
    fontWeight: 600,
  },
  ratingCount: {
    fontSize: '12px',
    color: '#888',
  },
  priceWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: 'auto',
  },
  price: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#212121',
  },
  originalPrice: {
    fontSize: '14px',
    color: '#888',
    textDecoration: 'line-through',
  },
  discount: {
    fontSize: '13px',
    color: '#388e3c',
    fontWeight: 600,
  },
  addToCart: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    background: '#ff9f00',
    color: '#fff',
    border: 'none',
    padding: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.3s, opacity 0.3s',
    transform: 'translateY(100%)',
    opacity: 0,
  },
  addToCartVisible: {
    transform: 'translateY(0)',
    opacity: 1,
  },
};

export default function ProductCard({ product }) {
  const [hovered, setHovered] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  if (!product) return null;

  const {
    id,
    brand = 'Unknown Brand',
    title = 'Eyewear Product',
    image = 'https://via.placeholder.com/200x200/f1f3f6/999?text=👓',
    price = 999,
    originalPrice = 1999,
    rating = 4.2,
    ratingCount = 124,
  } = product;

  const discount = originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <Link
      to={`/product/${id}`}
      style={{
        ...styles.card,
        ...(hovered ? styles.cardHover : {}),
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.imageWrap}>
        <img src={image} alt={title} style={styles.image} loading="lazy" />
        <button
          style={{
            ...styles.wishlistBtn,
            color: wishlisted ? '#ff4747' : '#999',
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWishlisted(!wishlisted);
          }}
          aria-label="Add to wishlist"
        >
          <FiHeart size={16} fill={wishlisted ? '#ff4747' : 'none'} />
        </button>
      </div>

      <div style={styles.body}>
        <div style={styles.brand}>{brand}</div>
        <div style={styles.title}>{title}</div>

        <div style={styles.ratingWrap}>
          <span style={styles.ratingBadge}>
            {rating.toFixed(1)} <FiStar size={10} fill="#fff" />
          </span>
          <span style={styles.ratingCount}>({ratingCount.toLocaleString()})</span>
        </div>

        <div style={styles.priceWrap}>
          <span style={styles.price}>₹{price.toLocaleString()}</span>
          {originalPrice > price && (
            <>
              <span style={styles.originalPrice}>₹{originalPrice.toLocaleString()}</span>
              <span style={styles.discount}>{discount}% off</span>
            </>
          )}
        </div>
      </div>

      <button
        style={{
          ...styles.addToCart,
          ...(hovered ? styles.addToCartVisible : {}),
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <FiShoppingCart /> Add to Cart
      </button>
    </Link>
  );
}
