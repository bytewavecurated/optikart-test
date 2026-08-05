import React, { useState, useEffect, useRef, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiSearch, FiShoppingCart, FiUser, FiChevronDown, FiMenu, FiX,
  FiHeart, FiBell, FiPackage, FiHelpCircle, FiLogOut, FiChevronRight
} from 'react-icons/fi';

const AuthContext = React.createContext(null);
const CartContext = React.createContext({ items: [] });

const CATEGORIES = [
  { name: 'Sunglasses', link: '/category/sunglasses', icon: '🕶️' },
  { name: 'Eyeglasses', link: '/category/eyeglasses', icon: '👓' },
  { name: 'Contact Lenses', link: '/category/contact-lenses', icon: '👁️' },
  { name: 'Reading Glasses', link: '/category/reading-glasses', icon: '📖' },
  { name: 'Sports Eyewear', link: '/category/sports', icon: '🏃' },
  { name: 'Kids', link: '/category/kids', icon: '🧒' },
  { name: 'Brands', link: '/brands', icon: '🏷️' },
  { name: 'Virtual Try-On', link: '/virtual-try-on', icon: '📸' },
];

const styles = {
  wrapper: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    fontFamily: "'Roboto', sans-serif",
  },
  topStrip: {
    background: '#2874f0',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  logo: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '-0.5px',
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1,
  },
  logoSubtext: {
    fontSize: '10px',
    fontStyle: 'italic',
    color: '#ff9f00',
    fontWeight: 500,
  },
  searchWrap: {
    flex: 1,
    maxWidth: '560px',
    position: 'relative',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px 10px 40px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    color: '#333',
    boxSizing: 'border-box',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#2874f0',
    fontSize: '18px',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginLeft: 'auto',
  },
  navLink: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    background: '#fff',
    borderRadius: '4px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    minWidth: '200px',
    zIndex: 1001,
    marginTop: '8px',
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    color: '#333',
    textDecoration: 'none',
    fontSize: '14px',
    borderBottom: '1px solid #f1f1f1',
    transition: 'background 0.15s',
  },
  cartWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: '-8px',
    right: '-10px',
    background: '#ff9f00',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBar: {
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  categoryItem: {
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  hamburger: {
    display: 'none',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
  },
  mobileMenu: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '280px',
    height: '100vh',
    background: '#fff',
    zIndex: 2000,
    boxShadow: '4px 0 16px rgba(0,0,0,0.2)',
    overflowY: 'auto',
    transform: 'translateX(-100%)',
    transition: 'transform 0.3s ease',
  },
  mobileMenuOpen: {
    transform: 'translateX(0)',
  },
  mobileOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1999,
  },
  mobileHeader: {
    background: '#2874f0',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileCategory: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #f1f1f1',
    color: '#333',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
  },
};

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount] = useState(3);
  const navigate = useNavigate();
  const loginRef = useRef(null);
  const moreRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (loginRef.current && !loginRef.current.contains(e.target)) setLoginOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = e.target.querySelector('input').value;
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.topStrip}>
        <button
          style={{ ...styles.hamburger, display: 'none' }}
          className="nav-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          <FiMenu />
        </button>

        <Link to="/" style={styles.logo}>
          OptiKart
          <span style={styles.logoSubtext}>Explore Plus</span>
        </Link>

        <form onSubmit={handleSearch} style={styles.searchWrap}>
          <FiSearch style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search for eyewear, brands and more"
            style={styles.searchInput}
          />
        </form>

        <div style={styles.navLinks} className="nav-links-desktop">
          {user ? (
            <div ref={loginRef} style={{ position: 'relative' }}>
              <button
                style={styles.navLink}
                onClick={() => setLoginOpen(!loginOpen)}
              >
                <FiUser /> {user.name || 'Account'} <FiChevronDown />
              </button>
              {loginOpen && (
                <div style={styles.dropdown}>
                  <Link to="/profile" style={styles.dropdownItem} onClick={() => setLoginOpen(false)}>
                    <FiUser /> My Profile
                  </Link>
                  <Link to="/orders" style={styles.dropdownItem} onClick={() => setLoginOpen(false)}>
                    <FiPackage /> Orders
                  </Link>
                  <Link to="/wishlist" style={styles.dropdownItem} onClick={() => setLoginOpen(false)}>
                    <FiHeart /> Wishlist
                  </Link>
                  <Link to="/logout" style={styles.dropdownItem} onClick={() => setLoginOpen(false)}>
                    <FiLogOut /> Logout
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" style={styles.navLink}>
              <FiUser /> Login
            </Link>
          )}

          <Link to="/seller/register" style={styles.navLink} className="seller-link">
            Become a Seller
          </Link>

          <div ref={moreRef} style={{ position: 'relative' }}>
            <button
              style={styles.navLink}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              More <FiChevronDown />
            </button>
            {moreOpen && (
              <div style={styles.dropdown}>
                <Link to="/notifications" style={styles.dropdownItem} onClick={() => setMoreOpen(false)}>
                  <FiBell /> Notifications
                </Link>
                <Link to="/help" style={styles.dropdownItem} onClick={() => setMoreOpen(false)}>
                  <FiHelpCircle /> Help & Support
                </Link>
              </div>
            )}
          </div>

          <Link to="/cart" style={{ ...styles.navLink, ...styles.cartWrap }}>
            <FiShoppingCart size={20} />
            {cartCount > 0 && <span style={styles.badge}>{cartCount}</span>}
            Cart
          </Link>
        </div>
      </div>

      <div style={styles.categoryBar} className="category-bar">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.name}
            to={cat.link}
            style={styles.categoryItem}
            className="category-nav-item"
          >
            <span>{cat.icon}</span>
            {cat.name}
          </Link>
        ))}
      </div>

      {mobileOpen && (
        <div style={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
      )}
      <div
        style={{
          ...styles.mobileMenu,
          ...(mobileOpen ? styles.mobileMenuOpen : {}),
        }}
        className="mobile-nav-menu"
      >
        <div style={styles.mobileHeader}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>OptiKart</span>
          <button
            onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer' }}
          >
            <FiX />
          </button>
        </div>
        {user ? (
          <div style={{ padding: '16px', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ fontWeight: 600, fontSize: '16px' }}>{user.name}</div>
            <div style={{ fontSize: '13px', color: '#666' }}>{user.email}</div>
          </div>
        ) : (
          <Link
            to="/login"
            style={{ display: 'block', padding: '16px', background: '#2874f0', color: '#fff', textAlign: 'center', fontWeight: 600 }}
            onClick={() => setMobileOpen(false)}
          >
            Login / Sign Up
          </Link>
        )}
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.name}
            to={cat.link}
            style={styles.mobileCategory}
            onClick={() => setMobileOpen(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>{cat.icon}</span> {cat.name}
            </span>
            <FiChevronRight />
          </Link>
        ))}
        <Link to="/seller/register" style={styles.mobileCategory} onClick={() => setMobileOpen(false)}>
          Become a Seller <FiChevronRight />
        </Link>
        <Link to="/help" style={styles.mobileCategory} onClick={() => setMobileOpen(false)}>
          Help & Support <FiChevronRight />
        </Link>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .category-nav-item:hover { color: #2874f0 !important; border-bottom-color: #2874f0 !important; }
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: block !important; }
          .category-bar { display: none !important; }
          .seller-link { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav-menu { display: none !important; }
        }
      `}</style>
    </div>
  );
}
