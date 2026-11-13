import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { FiSearch, FiShoppingCart, FiUser, FiHeart, FiMenu, FiX, FiChevronDown, FiCamera, FiMic, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import Logo from './Logo';
import { STOREFRONT_NAV } from '../utils/catalogTaxonomy';
import { useSiteFooter } from '../services/homeContent';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [showRightIndicator, setShowRightIndicator] = useState(true);
  // The arrow buttons only appear when the strip genuinely overflows; on a wide
  // screen where every link fits they would be dead weight.
  const [railOverflow, setRailOverflow] = useState(false);
  const categoryNavRef = useRef(null);
  const { user, seller, admin, isAuthenticated, isCustomerAuthenticated, activeRole, roleConsole,
    logout, sellerLogout, staffLogout, adminLogout, executiveLogout, manufacturerLogout, manufacturerSellerLogout, partnerLogout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  // Handle category nav scroll indicators
  useEffect(() => {
    const nav = categoryNavRef.current;
    if (!nav) return;

    const measure = () => {
      const { scrollLeft, scrollWidth, clientWidth } = nav;
      setShowLeftIndicator(scrollLeft > 0);
      setShowRightIndicator(scrollLeft < scrollWidth - clientWidth - 10);
      setRailOverflow(scrollWidth > clientWidth + 10);
    };

    nav.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // Webfonts settle after first paint and change the strip's width, so measure
    // again shortly after mount instead of trusting the first pass.
    measure();
    const t = setTimeout(measure, 400);

    return () => {
      nav.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, []);

  // One press moves roughly a screenful of links, which feels the same on a 13"
  // laptop and a 34" monitor.
  const scrollRail = (direction) => {
    const nav = categoryNavRef.current;
    if (!nav) return;
    nav.scrollBy({ left: direction * Math.max(200, nav.clientWidth * 0.7), behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // One button for whichever console is open. Each role keeps its own logout
  // because they clear different keys and re-point different sockets.
  const signOutRole = () => {
    const byRole = {
      seller: sellerLogout,
      admin: adminLogout,
      staff: staffLogout,
      executive: executiveLogout,
      manufacturer: manufacturerLogout,
      manufacturerSeller: manufacturerSellerLogout,
      deliveryPartner: partnerLogout
    };
    const fn = byRole[activeRole];
    if (typeof fn === 'function') fn();
    else logout();
    navigate('/');
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

  // Shared with the browse page so the second-hand nav and the filter column
  // can never list different shops.
  // The administrator can relabel or retire entries in the category strip.
  const siteFooter = useSiteFooter();
  const categories = siteFooter.nav || STOREFRONT_NAV;

  const displayName = user?.name || seller?.storeName || seller?.businessName || 'Account';

  return (
    <header style={{ background: 'var(--bg-dark)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="container header-row" style={{ display: 'flex', alignItems: 'center', height: 'var(--header-height)', gap: '28px', paddingBlock: 'var(--header-pad-block)' }}>
        {/* Logo */}
        <Link to="/" aria-label="OptiKart home" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <Logo variant="onDark" size={22} tagline />
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
              padding: '10px 80px 10px 40px',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              fontSize: '14px',
              background: 'var(--bg-white)',
              color: 'var(--text-primary)',
            }}
          />
          <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--action)', fontSize: '18px' }} />
          <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => navigate('/face-shape-guide')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--action)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-light)'}
              title="Face Shape Guide"
            >
              <FiCamera size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                  const recognition = new SpeechRecognition();
                  recognition.lang = 'en-US';
                  recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    setSearchQuery(transcript);
                    navigate(`/search?q=${encodeURIComponent(transcript)}`);
                  };
                  recognition.start();
                } else {
                  alert('Voice search is not supported in your browser');
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--action)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-light)'}
              title="Voice Search"
            >
              <FiMic size={18} />
            </button>
          </div>
        </form>

        {/* Desktop Nav */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isCustomerAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileDropdown(!profileDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-white)', fontSize: '14px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
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
                      background: 'var(--bg-white)',
                      borderRadius: 'var(--radius-xs)',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: '200px',
                      zIndex: 100,
                      overflow: 'hidden',
                    }}
                  >
                    {isCustomerAuthenticated && (
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
            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '14px', fontWeight: 600, padding: '6px 24px', background: 'var(--text-white)', borderRadius: 'var(--radius-xs)', textDecoration: 'none' }}>
              <FiUser size={16} />
              Login
            </Link>
          )}

          {/*
            A staff, seller, manufacturer, executive or partner session is not a
            shopping session. Rather than fake a customer account, the bar offers
            the way back into their own console and out of it.
          */}
          {roleConsole && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link
                to={roleConsole.path}
                title={`Signed in as ${activeRole}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-white)', fontSize: '13px', fontWeight: 600, padding: '7px 12px', border: '1px solid rgba(255,255,255,0.45)', borderRadius: 'var(--radius-xs)', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                <FiUser size={15} />
                {roleConsole.label}
              </Link>
              <button
                onClick={signOutRole}
                style={{ color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '7px 8px', whiteSpace: 'nowrap' }}
              >
                Sign out
              </button>
            </div>
          )}

          <Link to="/wishlist" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-white)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
            <FiHeart size={18} />
          </Link>

          <Link to="/cart" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-white)', fontSize: '14px', fontWeight: 500, position: 'relative', textDecoration: 'none' }}>
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
        <div className="mobile-icons" style={{ display: 'none', alignItems: 'center', gap: '12px', marginLeft: 'auto', flexShrink: 0 }}>
          {/* Mobile search toggle */}
          <button onClick={() => setMobileSearchOpen(!mobileSearchOpen)} style={{ color: 'var(--text-white)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <FiSearch size={22} />
          </button>

          {/* Cart icon - always visible on mobile */}
          <Link to="/cart" style={{ position: 'relative', color: 'var(--text-white)', display: 'flex', alignItems: 'center' }}>
            <FiShoppingCart size={22} />
            {totalItems > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-8px', background: 'var(--secondary)', color: 'var(--text-primary)', fontSize: '9px', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {totalItems}
              </span>
            )}
          </Link>

          {/* Account icon - shows Login if not authenticated, user icon if authenticated */}
          {isAuthenticated ? (
            <Link to="/profile" style={{ color: 'var(--text-white)', display: 'flex', alignItems: 'center' }}>
              <FiUser size={22} />
            </Link>
          ) : (
            <Link to="/login" style={{ color: 'var(--text-white)', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, gap: '4px' }}>
              <FiUser size={20} />
              <span style={{ fontSize: '12px' }}>Login</span>
            </Link>
          )}

          {/* Hamburger menu */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ color: 'var(--text-white)', fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>

        {/* Desktop hamburger (hidden) */}
        <button className="hide-desktop" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ color: 'var(--text-white)', fontSize: '24px', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', display: 'none' }}>
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
            style={{ background: 'var(--bg-white)', overflow: 'hidden', position: 'absolute', width: '100%', zIndex: 98, boxShadow: 'var(--shadow)' }}
            className="mobile-search-bar"
          >
            <form onSubmit={handleSearch} style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search for eyewear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', fontSize: '14px' }}
                autoFocus
              />
              <button type="submit" style={{ padding: '10px 16px', background: 'var(--primary)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
                <FiSearch size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category sub-nav (desktop). Links are padded pills rather than bare text
          on a 40px strip, and the rail scrolls by arrow on wide screens. */}
      <div className="hide-mobile" style={{ background: 'var(--bg-white)', borderTop: '1px solid var(--border)', position: 'relative' }}>
        <div className="container category-nav-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {railOverflow && (
            <button
              type="button"
              onClick={() => scrollRail(-1)}
              disabled={!showLeftIndicator}
              aria-label="Scroll categories left"
              className="rail-arrow"
              style={{ opacity: showLeftIndicator ? 1 : 0.3 }}
            >
              <FiChevronLeft size={18} />
            </button>
          )}
          <div
            ref={categoryNavRef}
            className="category-nav-scroll"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); scrollRail(1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); scrollRail(-1); }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '46px', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth', flex: 1, minWidth: 0 }}
          >
            {categories.map((cat) => (
              <NavLink key={cat.path} to={cat.path} className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>
                {cat.name}
              </NavLink>
            ))}
            <NavLink to="/brands" className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>All Brands</NavLink>
            <NavLink to="/virtual-tryon" className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>Virtual Try-On</NavLink>
            <NavLink to="/prescription" className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>Upload Prescription</NavLink>
            <NavLink to="/coupons" className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--secondary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>Offers</NavLink>
            <NavLink to="/blog" className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>Blog</NavLink>
            <NavLink to="/help" className="cat-nav-link" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}>Help</NavLink>
          </div>
          {railOverflow && (
            <button
              type="button"
              onClick={() => scrollRail(1)}
              disabled={!showRightIndicator}
              aria-label="Scroll categories right"
              className="rail-arrow"
              style={{ opacity: showRightIndicator ? 1 : 0.3 }}
            >
              <FiChevronRight size={18} />
            </button>
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
            style={{ background: 'var(--bg-white)', overflow: 'hidden', position: 'absolute', width: '100%', zIndex: 99, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}
          >
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <input
                  type="text"
                  placeholder="Search for eyewear..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', fontSize: '14px' }}
                />
                <button type="submit" style={{ padding: '10px 16px', background: 'var(--primary)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}>
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
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} style={{ fontSize: '14px', padding: '10px', color: 'var(--danger)', background: 'none', border: '1px solid var(--danger)', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontWeight: 600 }}>Logout</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        /* Category rail: padded pills with a quiet hover, and round arrow buttons
           that sit outside the scrolling strip. */
        .cat-nav-link {
          padding: 7px 13px;
          border-radius: 999px;
          transition: background-color .15s ease, color .15s ease;
        }
        .cat-nav-link:hover { background: var(--bg-secondary); }
        .cat-nav-link.active {
          background: var(--brand-tint);
          color: var(--brand);
          font-weight: 700;
        }
        .rail-arrow {
          flex-shrink: 0;
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: 50%;
          background: #fff;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background-color .15s ease, color .15s ease;
        }
        .rail-arrow:hover:not(:disabled) { background: var(--bg-secondary); color: var(--text-primary); }
        .rail-arrow:disabled { cursor: default; }
        @media (min-width: 769px) {
          .header-row { gap: 30px; }
          .header-row .container { padding-left: 0; padding-right: 0; }
          .category-nav-wrap { padding-top: 5px; padding-bottom: 5px; }
        }
        /* The desktop nav and the category rail are marked .hide-mobile; without
           this rule they rendered on phones and forced a horizontal scrollbar. */
        @media (max-width: 768px) {
          /* The logo tagline and the wide gaps pushed the icon cluster past the
             viewport edge on phones, creating a 7px horizontal scroll. */
          .logo-tagline { display: none !important; }
          .header-row { gap: 10px !important; }
          .header-row > div.container, .header-row .container { padding-left: 0; padding-right: 0; }
          .hide-mobile {
            display: none !important;
          }
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
