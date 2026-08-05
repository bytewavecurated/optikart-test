import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiShoppingCart, FiUser, FiHeart, FiMenu, FiX, FiChevronDown } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(true);
  const categoryNavRef = useRef(null);
  const { user, seller, admin, isAuthenticated, logout, sellerLogout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  // Handle category nav scroll indicators
  useEffect(() => {
    const nav = categoryNavRef.current;
    if (!nav) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = nav;
      setShowLeftIndicator(scrollLeft > 0);
      setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 10);
    };

    nav.addEventListener('scroll', handleScroll);
    // Initial check
    handleScroll();

    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    if (seller) {
      sellerLogout();
      navigate('/seller/login');
    } else {
      logout();
      navigate('/');
    }
    setProfileDropdown(false);
  };

  const categories = [
    { name: 'Sunglasses', path: '/category/sunglasses' },
    { name: 'Eyeglasses', path: '/category/eyeglasses' },
    { name: 'Contact Lenses', path: '/category/contact-lenses' },
    { name: 'Computer Glasses', path: '/category/computer-glasses' },
    { name: 'Sports Eyewear', path: '/category/sports-eyewear' },
  ];

  const displayName = user?.name || seller?.storeName || seller?.businessName || 'Account';

  return (
    <header style={{ background: 'var(--bg-dark)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: 'var(--header-height)', gap: '16px' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 'fit-content' }}>
          <span style={{ color: 'var(--secondary)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>OptiKart</span>
          <span style={{ color: '#999', fontSize: '10px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '2px' }}>
            Explore <span style={{ color: 'var(--secondary)' }}>Plus</span> <span style={{ fontSize: '8px' }}>✦</span>
          </span>
        </Link>

        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: '560px', position: 'relative' }} className="hide-on-small-mobile">
          <input
            type="text"
            placeholder="Search for sunglasses, eyeglasses, contact lenses and more"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              borderRadius: '4px',
              border: 'none',
              fontSize: '14px',
              background: '#fff',
              color: 'var(--text-primary)',
            }}
          />
          <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '18px' }} />
        </form>

        {/* Desktop Nav */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileDropdown(!profileDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '14px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <FiUser size={18} />
                <span>{displayName}</span>
                <FiChevronDown size={14} />
              </button>
              <AnimatePresence>
                {profileDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: '#fff',
                      borderRadius: '4px',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: '200px',
                      zIndex: 100,
                      overflow: 'hidden',
                    }}
                  >
                    {user && (
                      <>
                        <Link to="/profile" onClick={() => setProfileDropdown(false)} style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>My Profile</Link>
                        <Link to="/orders" onClick={() => setProfileDropdown(false)} style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>Orders</Link>
                        <Link to="/wishlist" onClick={() => setProfileDropdown(false)} style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>Wishlist</Link>
                      </>
                    )}
                    {seller && (
                      <>
                        <Link to="/seller/dashboard" onClick={() => setProfileDropdown(false)} style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>Dashboard</Link>
                        <Link to="/seller/products" onClick={() => setProfileDropdown(false)} style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>Products</Link>
                        <Link to="/seller/orders" onClick={() => setProfileDropdown(false)} style={{ display: 'block', padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>Orders</Link>
                      </>
                    )}
                    <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: '14px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Logout</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '14px', fontWeight: 600, padding: '6px 24px', background: '#fff', borderRadius: '4px', textDecoration: 'none' }}>
              <FiUser size={16} />
              Login
            </Link>
          )}

          <Link to="/wishlist" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
            <FiHeart size={18} />
          </Link>

          <Link to="/cart" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '14px', fontWeight: 500, position: 'relative', textDecoration: 'none' }}>
            <FiShoppingCart size={18} />
            {totalItems > 0 && (
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--secondary)', color: 'var(--text-primary)', fontSize: '10px', fontWeight: 700, width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {totalItems}
              </span>
            )}
            Cart
          </Link>
        </nav>

        {/* Mobile Icons - Flipkart style */}
        <div className="mobile-icons" style={{ display: 'none', alignItems: 'center', gap: '16px', marginLeft: 'auto' }}>
          {/* Mobile search toggle */}
          <button onClick={() => setMobileSearchOpen(!mobileSearchOpen)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <FiSearch size={22} />
          </button>

          {/* Cart icon - always visible on mobile */}
          <Link to="/cart" style={{ position: 'relative', color: '#fff', display: 'flex', alignItems: 'center' }}>
            <FiShoppingCart size={22} />
            {totalItems > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-8px', background: 'var(--secondary)', color: 'var(--text-primary)', fontSize: '9px', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {totalItems}
              </span>
            )}
          </Link>

          {/* Account icon - shows Login if not authenticated, user icon if authenticated */}
          {isAuthenticated ? (
            <Link to="/profile" style={{ color: '#fff', display: 'flex', alignItems: 'center' }}>
              <FiUser size={22} />
            </Link>
          ) : (
            <Link to="/login" style={{ color: '#fff', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, gap: '4px' }}>
              <FiUser size={20} />
              <span style={{ fontSize: '12px' }}>Login</span>
            </Link>
          )}

          {/* Hamburger menu */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ color: '#fff', fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>

        {/* Desktop hamburger (hidden) */}
        <button className="hide-desktop" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ color: '#fff', fontSize: '24px', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', display: 'none' }}>
          {mobileMenuOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ background: '#fff', overflow: 'hidden', position: 'absolute', width: '100%', zIndex: 98, boxShadow: 'var(--shadow)' }}
            className="mobile-search-bar"
          >
            <form onSubmit={handleSearch} style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search for eyewear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '14px' }}
                autoFocus
              />
              <button type="submit" style={{ padding: '10px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <FiSearch size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category sub-nav (desktop) */}
      <div className="hide-mobile" style={{ background: '#fff', borderTop: '1px solid var(--border)', position: 'relative' }}>
        <div className="container" style={{ position: 'relative' }}>
          <div 
            ref={categoryNavRef}
            className="category-nav-scroll" 
            style={{ display: 'flex', alignItems: 'center', gap: '32px', height: '40px', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}
          >
            {categories.map((cat) => (
              <Link key={cat.path} to={cat.path} style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>
                {cat.name}
              </Link>
            ))}
            <Link to="/brands" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>All Brands</Link>
            <Link to="/virtual-tryon" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Virtual Try-On</Link>
            <Link to="/prescription" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Upload Prescription</Link>
            <Link to="/coupons" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--secondary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Offers</Link>
            <Link to="/blog" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Blog</Link>
            <Link to="/help" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Help</Link>
          </div>
          {/* Scroll indicators */}
          {showLeftIndicator && (
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40px', background: 'linear-gradient(to right, #fff 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none', zIndex: 1 }} />
          )}
          {showRightIndicator && (
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40px', background: 'linear-gradient(to left, #fff 0%, rgba(255,255,255,0) 100%)', pointerEvents: 'none', zIndex: 1 }} />
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ background: '#fff', overflow: 'hidden', position: 'absolute', width: '100%', zIndex: 99, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}
          >
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <input
                  type="text"
                  placeholder="Search for eyewear..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <button type="submit" style={{ padding: '10px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  <FiSearch size={18} />
                </button>
              </form>
              {categories.map((cat) => (
                <Link key={cat.path} to={cat.path} onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', fontWeight: 500, padding: '8px 0', borderBottom: '1px solid var(--border-light)', textDecoration: 'none', color: 'var(--text-primary)' }}>
                  {cat.name}
                </Link>
              ))}
              <Link to="/brands" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>All Brands</Link>
              <Link to="/virtual-tryon" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', color: 'var(--primary)', textDecoration: 'none' }}>Virtual Try-On</Link>
              <Link to="/prescription" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>Upload Prescription</Link>
              <Link to="/coupons" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>Offers</Link>
              <Link to="/blog" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>Blog</Link>
              <Link to="/help" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>Help</Link>
              {isAuthenticated && (
                <>
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>My Profile</Link>
                  <Link to="/orders" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>My Orders</Link>
                  <Link to="/wishlist" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '14px', padding: '8px 0', textDecoration: 'none', color: 'var(--text-primary)' }}>Wishlist</Link>
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} style={{ fontSize: '14px', padding: '10px', color: 'var(--danger)', background: 'none', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Logout</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .mobile-icons {
            display: flex !important;
          }
          .hide-on-small-mobile {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-icons {
            display: none !important;
          }
          .mobile-search-bar {
            display: none !important;
          }
        }
        /* Hide scrollbar for category nav */
        .category-nav-scroll::-webkit-scrollbar {
          display: none;
        }
        /* Category nav hover effects */
        .category-nav-scroll a:hover {
          color: var(--primary) !important;
        }
        /* Scroll indicators visibility based on scroll position */
        .category-nav-wrapper {
          position: relative;
        }
      `}</style>
    </header>
  );
};

export default Header;
