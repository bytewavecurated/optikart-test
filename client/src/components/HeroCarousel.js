import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { banners } from '../services/api';

const DEFAULT_BANNERS = [
  {
    _id: 'default-1',
    title: 'Summer Sale',
    imageUrl: 'https://images.unsplash.com/photo-1577803645773-f96470579636?w=1200&h=400&fit=crop',
    linkUrl: '/sale/summer',
  },
  {
    _id: 'default-2',
    title: 'New Arrivals',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1200&h=400&fit=crop',
    linkUrl: '/brands/ray-ban',
  },
  {
    _id: 'default-3',
    title: 'Blue Cut Lenses',
    imageUrl: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=1200&h=400&fit=crop',
    linkUrl: '/category/blue-cut',
  },
  {
    _id: 'default-4',
    title: 'Virtual Try-On',
    imageUrl: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=1200&h=400&fit=crop',
    linkUrl: '/virtual-try-on',
  },
];

const styles = {
  container: {
    position: 'relative',
    width: 'calc(100% - 32px)',
    margin: '16px auto',
    overflow: 'hidden',
    background: '#f1f3f6',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  track: {
    display: 'flex',
    transition: 'transform 0.5s ease-in-out',
  },
  slide: {
    position: 'relative',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '400px',
    objectFit: 'cover',
    display: 'block',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    fontSize: '24px',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'all 0.3s',
  },
  dotsContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px 0',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: '#ccc',
  },
};

export default function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [bannerList, setBannerList] = useState(DEFAULT_BANNERS);
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await banners.getActive();
        if (response.data.success && response.data.banners.length > 0) {
          setBannerList(response.data.banners);
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, []);

  // Determine how many cards to show based on screen size
  const getCardsToShow = () => {
    if (windowWidth < 768) return 1;
    if (windowWidth < 1024) return 2;
    return 3;
  };

  const cardsToShow = getCardsToShow();
  const maxIndex = Math.max(0, bannerList.length - cardsToShow);

  const next = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  }, [maxIndex]);

  useEffect(() => {
    if (paused || bannerList.length === 0) return;
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next, paused, bannerList.length]);

  if (loading || bannerList.length === 0) {
    return (
      <div style={{ ...styles.container, height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  const slideWidth = 100 / cardsToShow;
  const translateValue = -(currentIndex * slideWidth);

  return (
    <>
      <div
        style={styles.container}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          style={{
            ...styles.track,
            transform: `translateX(${translateValue}%)`,
          }}
        >
          {bannerList.map((banner) => (
            <Link
              to={banner.linkUrl}
              key={banner._id}
              style={{ ...styles.slide, width: `${slideWidth}%` }}
            >
              <img
                src={banner.imageUrl}
                alt={banner.title}
                style={styles.image}
                className="hero-slide-image"
              />
            </Link>
          ))}
        </div>

        {bannerList.length > cardsToShow && (
          <>
            <button
              style={{ ...styles.arrow, left: '16px' }}
              onClick={(e) => { e.preventDefault(); prev(); }}
              aria-label="Previous"
              className="carousel-arrow"
            >
              <FiChevronLeft />
            </button>
            <button
              style={{ ...styles.arrow, right: '16px' }}
              onClick={(e) => { e.preventDefault(); next(); }}
              aria-label="Next"
              className="carousel-arrow"
            >
              <FiChevronRight />
            </button>
          </>
        )}
      </div>

      {/* Dots below the carousel */}
      {bannerList.length > cardsToShow && (
        <div style={styles.dotsContainer}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              style={{
                ...styles.dot,
                background: i === currentIndex ? '#2874f0' : '#ccc',
                transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                boxShadow: i === currentIndex ? '0 2px 8px rgba(40,116,240,0.4)' : 'none',
              }}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className="carousel-dot"
            />
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hero-slide-image { 
            height: 200px !important; 
          }
        }
        @media (max-width: 480px) {
          .hero-slide-image { 
            height: 150px !important; 
          }
        }
        .carousel-arrow:hover {
          background: rgba(255, 255, 255, 0.4) !important;
          transform: translateY(-50%) scale(1.1) !important;
        }
        .carousel-dot {
          animation: dotPulse 2s infinite;
        }
        .carousel-dot:nth-child(1) { animation-delay: 0s; }
        .carousel-dot:nth-child(2) { animation-delay: 0.2s; }
        .carousel-dot:nth-child(3) { animation-delay: 0.4s; }
        .carousel-dot:nth-child(4) { animation-delay: 0.6s; }
        .carousel-dot:nth-child(5) { animation-delay: 0.8s; }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
