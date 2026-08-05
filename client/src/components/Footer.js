import React from 'react';
import { Link } from 'react-router-dom';
import { FiFacebook, FiTwitter, FiYoutube, FiInstagram, FiChevronRight } from 'react-icons/fi';

const FOOTER_LINKS = {
  about: {
    title: 'ABOUT',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
      { label: 'Corporate Information', href: '/corporate' },
    ],
  },
  help: {
    title: 'HELP',
    links: [
      { label: 'Payments', href: '/help/payments' },
      { label: 'Shipping', href: '/help/shipping' },
      { label: 'Cancellation & Returns', href: '/help/cancellation' },
      { label: 'FAQ', href: '/help/faq' },
      { label: 'Report Infringement', href: '/help/report' },
    ],
  },
  policy: {
    title: 'POLICY',
    links: [
      { label: 'Return Policy', href: '/policy/return' },
      { label: 'Terms of Use', href: '/policy/terms' },
      { label: 'Security', href: '/policy/security' },
      { label: 'Privacy', href: '/policy/privacy' },
      { label: 'Sitemap', href: '/sitemap' },
      { label: 'EPR Compliance', href: '/policy/epr' },
    ],
  },
  social: {
    title: 'SOCIAL',
    links: [
      { href: 'https://facebook.com', icon: <FiFacebook size={20} /> },
      { href: 'https://twitter.com', icon: <FiTwitter size={20} /> },
      { href: 'https://youtube.com', icon: <FiYoutube size={20} /> },
      { href: 'https://instagram.com', icon: <FiInstagram size={20} /> },
    ],
  },
};

const styles = {
  footer: {
    background: '#172337',
    color: '#878787',
    fontFamily: "'Roboto', sans-serif",
    fontSize: '12px',
  },
  topBanner: {
    background: '#2874f0',
    padding: '16px 40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    borderBottom: '1px solid #1a2942',
  },
  bannerText: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
  },
  bannerBtn: {
    background: '#ff9f00',
    color: '#fff',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '3px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'none',
    textTransform: 'uppercase',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  main: {
    padding: '40px 40px 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    borderBottom: '1px solid #2a3a54',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  colTitle: {
    color: '#878787',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  link: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 400,
    padding: '3px 0',
    transition: 'color 0.15s',
  },
  socialColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  socialIcons: {
    display: 'flex',
    gap: '16px',
    marginTop: '4px',
  },
  socialIcon: {
    color: '#fff',
    fontSize: '20px',
    transition: 'color 0.15s',
    textDecoration: 'none',
  },
  bottomBar: {
    padding: '16px 40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  },
  copyright: {
    fontSize: '12px',
    color: '#878787',
  },
  policyLinks: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  policyLink: {
    color: '#878787',
    textDecoration: 'none',
    fontSize: '12px',
  },
};

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.topBanner}>
        <span style={styles.bannerText}>Sell on OptiKart</span>
        <Link to="/seller/register" style={styles.bannerBtn}>
          Become a Seller <FiChevronRight style={{ verticalAlign: 'middle' }} />
        </Link>
      </div>

      <div style={styles.main} className="footer-main">
        {Object.entries(FOOTER_LINKS).map(([key, col]) => (
          <div key={key} style={key === 'social' ? styles.socialColumn : styles.column}>
            <span style={styles.colTitle}>{col.title}</span>
            {key === 'social' ? (
              <div style={styles.socialIcons}>
                {col.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.socialIcon}
                    className="footer-social-icon"
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            ) : (
              col.links.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  style={styles.link}
                  className="footer-link"
                >
                  {link.label}
                </Link>
              ))
            )}
          </div>
        ))}
      </div>

      <div style={styles.bottomBar} className="footer-bottom">
        <span style={styles.copyright}>© 2026 OptiKart.com. All rights reserved.</span>

        <div style={styles.policyLinks}>
          <Link to="/policy/privacy" style={styles.policyLink}>Privacy</Link>
          <Link to="/policy/terms" style={styles.policyLink}>Terms</Link>
          <Link to="/policy/return" style={styles.policyLink}>Returns</Link>
        </div>
      </div>

      <style>{`
        .footer-link:hover { color: #2874f0 !important; }
        .footer-social-icon:hover { color: #2874f0 !important; }
        @media (max-width: 768px) {
          .footer-main {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 24px 16px !important;
          }
          .footer-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
            padding: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .footer-main {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
