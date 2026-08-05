import React from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiUser, FiHelpCircle, FiFileText, FiBriefcase, FiChevronRight } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';

const sitemapData = [
  {
    title: 'Shopping',
    icon: <FiShoppingBag size={20} />,
    links: [
      { label: 'All Sunglasses', path: '/category/sunglasses' },
      { label: 'All Eyeglasses', path: '/category/eyeglasses' },
      { label: 'Contact Lenses', path: '/category/contact-lenses' },
      { label: 'Computer Glasses', path: '/category/computer-glasses' },
      { label: 'Sports Eyewear', path: '/category/sports-eyewear' },
      { label: 'All Brands', path: '/brands' },
      { label: 'Virtual Try-On', path: '/virtual-tryon' },
      { label: 'Upload Prescription', path: '/prescription' },
      { label: 'Available Coupons', path: '/coupons' },
      { label: 'Blog', path: '/blog' },
    ],
  },
  {
    title: 'Account',
    icon: <FiUser size={20} />,
    links: [
      { label: 'Login', path: '/login' },
      { label: 'Register', path: '/register' },
      { label: 'My Profile', path: '/profile' },
      { label: 'My Orders', path: '/orders' },
      { label: 'Wishlist', path: '/wishlist' },
      { label: 'Cart', path: '/cart' },
      { label: 'Seller Login', path: '/seller/login' },
      { label: 'Seller Register', path: '/seller/register' },
    ],
  },
  {
    title: 'Help',
    icon: <FiHelpCircle size={20} />,
    links: [
      { label: 'Help Center', path: '/help' },
      { label: 'Contact Us', path: '/contact' },
      { label: 'Payments Info', path: '/help/payments' },
      { label: 'Shipping Info', path: '/help/shipping' },
      { label: 'Cancellation & Returns', path: '/help/cancellation' },
      { label: 'FAQ', path: '/help/faq' },
      { label: 'Report Infringement', path: '/help/report' },
    ],
  },
  {
    title: 'Legal',
    icon: <FiFileText size={20} />,
    links: [
      { label: 'Terms of Use', path: '/policy/terms' },
      { label: 'Privacy Policy', path: '/policy/privacy' },
      { label: 'Return Policy', path: '/policy/return' },
      { label: 'Security', path: '/policy/security' },
      { label: 'EPR Compliance', path: '/policy/epr' },
    ],
  },
  {
    title: 'Company',
    icon: <FiBriefcase size={20} />,
    links: [
      { label: 'About Us', path: '/about' },
      { label: 'Careers', path: '/careers' },
      { label: 'Press', path: '/press' },
      { label: 'Corporate Information', path: '/corporate' },
      { label: 'Sitemap', path: '/sitemap' },
    ],
  },
];

const Sitemap = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Sitemap</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '32px' }}>Complete directory of all pages on OptiKart</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }} className="sitemap-grid">
            {sitemapData.map((category) => (
              <div key={category.title} className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--primary)' }}>
                  <div style={{ color: 'var(--primary)' }}>{category.icon}</div>
                  <h2 style={{ fontSize: '17px', fontWeight: 600 }}>{category.title}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {category.links.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0', fontSize: '14px', color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                      className="sitemap-link"
                    >
                      <FiChevronRight size={14} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        .sitemap-link:hover { color: var(--primary) !important; }
        @media (max-width: 768px) {
          .sitemap-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .sitemap-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Sitemap;
