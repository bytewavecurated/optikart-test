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
    gap: '12px',
  },
  slide: {
    position: 'relative',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '300px',
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
    gap: '8px',
    padding: '16px 0',
    alignItems: 'center',
  },
  lineIndicator: {
    height: '4px',
    borderRadius: '2px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: '#e0e0e0',
    position: 'relative',
    overflow: 'hidden',
  },
  lineIndicatorActive: {
    background: '#2874f0',
  },
  lineProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    background: '#2874f0',
    transition: 'width 0.3s ease',
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

  // Get appropriate image URL based on device
  const getImageUrl = (banner) => {
    if (windowWidth < 768 && banner.images?.mobile?.url) {
      return banner.images.mobile.url;
    } else if (windowWidth < 1024 && banner.images?.tablet?.url) {
      return banner.images.tablet.url;
    } else if (banner.images?.desktop?.url) {
      return banner.images.desktop.url;
    }
    // Fallback to old imageUrl for backward compatibility
    return banner.imageUrl || banner.images?.desktop?.url || '';
  };

  // Determine how many cards to show based on screen size
  const getCardsToShow = () => {
    if (windowWidth < 768) return 1;
    return 2; // Show 2 images on tablet and desktop
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
                src={getImageUrl(banner)}
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

      {/* Line indicators below the carousel */}
      {bannerList.length > cardsToShow && (
        <div style={styles.dotsContainer}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => {
            const isActive = i === currentIndex;
            const progress = isActive ? 100 : 0;
            
            return (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  ...styles.lineIndicator,
                  width: isActive ? '60px' : '30px',
                  ...(isActive ? styles.lineIndicatorActive : {}),
                }}
              >
                {isActive && (
                  <div 
                    style={{
                      ...styles.lineProgress,
                      width: `${progress}%`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .hero-slide-image { 
            height: 250px !important; 
          }
        }
        @media (max-width: 768px) {
          .hero-slide-image { 
            height: 200px !important; 
          }
        }
        @media (max-width: 480px) {
          .hero-slide-image { 
            height: 180px !important; 
          }
        }
        .carousel-arrow:hover {
          background: rgba(255, 255, 255, 0.4) !important;
          transform: translateY(-50%) scale(1.1) !important;
        }
      `}</style>
    </>
  );
}
