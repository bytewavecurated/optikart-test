import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { banners } from '../services/api';

const DEFAULT_BANNERS = [
  {
    _id: 'default-1',
    title: 'Summer Edit',
    eyebrow: 'LIMITED SERIES',
    subtitle: 'Polarized shades and blue-cut lenses, styled for the season.',
    ctaText: 'Shop offers',

    images: {
      desktop: { url: '/assets/banner-1.svg' },
      tablet: { url: '/assets/banner-1.svg' },
      mobile: { url: '/assets/banner-1.svg' },
    },
    linkUrl: '/products?hasOffer=1',
  },
  {
    _id: 'default-2',
    title: 'New Arrivals',
    eyebrow: 'JUST LANDED',
    subtitle: 'Fresh frames from the brands you trust, added weekly.',
    ctaText: 'Browse brands',

    images: {
      desktop: { url: '/assets/banner-2.svg' },
      tablet: { url: '/assets/banner-2.svg' },
      mobile: { url: '/assets/banner-2.svg' },
    },
    linkUrl: '/brands',
  },
  {
    _id: 'default-3',
    title: 'Blue Cut Lenses',
    eyebrow: 'SCREEN READY',
    subtitle: 'Filter the glare, keep the look - lenses graded for screen time.',
    ctaText: 'See eligible frames',

    images: {
      desktop: { url: '/assets/banner-3.svg' },
      tablet: { url: '/assets/banner-3.svg' },
      mobile: { url: '/assets/banner-3.svg' },
    },
    linkUrl: '/category/eyeglasses',
  },
];

const styles = {
  container: {
    position: 'relative',
    width: 'calc(100% - 32px)',
    margin: '16px auto',
    overflow: 'hidden',
    background: 'var(--bg-subtle)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
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
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  /* fluid cinematic proportion instead of a fixed 300px strip: reads like a
     campaign surface on desktop, stays a touch taller on mobile so the copy
     never gets orphaned. */
  slideBox: {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: 'clamp(280px, 30vw, 440px)',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  scrim: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(10,12,20,.72) 0%, rgba(10,12,20,.42) 38%, rgba(10,12,20,0) 68%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 clamp(18px, 5vw, 56px)',
    pointerEvents: 'none',
  },
  heroTitle: {
    fontFamily: 'var(--font-display, inherit)',
    fontSize: 'clamp(22px, 3.4vw, 40px)',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: '#fff',
    textShadow: '0 2px 18px rgba(0,0,0,.35)',
    maxWidth: '72%',
  },
  heroEyebrow: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: '.16em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.82)',
    marginBottom: 8,
  },
  heroCta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 18px',
    borderRadius: 999,
    background: '#fff',
    color: '#111',
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: '.02em',
    boxShadow: '0 8px 24px rgba(0,0,0,.28)',
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
    color: 'var(--text-white)',
    boxShadow: 'var(--shadow-lg)',
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
    borderRadius: 'var(--radius-2xs)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: 'var(--border)',
    position: 'relative',
    overflow: 'hidden',
  },
  lineIndicatorActive: {
    background: 'var(--brand)',
  },
  lineProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    background: 'var(--brand)',
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
      <div
        style={{
          ...styles.container,
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  const slideWidth = 100 / cardsToShow;
  const translateValue = -(currentIndex * slideWidth);

  return (
    <>
      <div style={styles.container} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
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
              aria-label={banner.ctaText ? `${banner.title} - ${banner.ctaText}` : banner.title}
            >
              <span style={styles.slideBox}>
                <img
                  src={getImageUrl(banner)}
                  alt={banner.title}
                  style={styles.image}
                  className="hero-slide-image"
                  loading="lazy"
                />
                <span style={styles.scrim}>
                  <span style={styles.heroEyebrow}>{banner.eyebrow || 'OPTIKART'}</span>
                  <span style={styles.heroTitle}>{banner.title}</span>
                  {banner.subtitle ? (
                    <span style={{ color: 'rgba(255,255,255,.86)', fontSize: 13.5, marginTop: 6, maxWidth: '68%' }}>
                      {banner.subtitle}
                    </span>
                  ) : null}
                  <span style={styles.heroCta} aria-hidden>
                    {(banner.ctaText || 'Explore') + ' →'}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>

        {bannerList.length > cardsToShow && (
          <>
            <button
              style={{ ...styles.arrow, left: '16px' }}
              onClick={(e) => {
                e.preventDefault();
                prev();
              }}
              aria-label="Previous"
              className="carousel-arrow"
            >
              <FiChevronLeft />
            </button>
            <button
              style={{ ...styles.arrow, right: '16px' }}
              onClick={(e) => {
                e.preventDefault();
                next();
              }}
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
