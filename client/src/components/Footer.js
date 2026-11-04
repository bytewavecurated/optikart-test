import React from 'react';
import { Link } from 'react-router-dom';
import { FiFacebook, FiTwitter, FiYoutube, FiInstagram, FiChevronRight } from 'react-icons/fi';
import Logo from './Logo';
import { useSiteFooter } from '../services/homeContent';

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
    background: 'var(--bg-dark)',
    color: 'rgba(255,255,255,0.62)',
    fontFamily: "var(--font-body)",
    fontSize: '12px',
  },
  topBanner: {
    background: 'rgba(255,255,255,0.04)',
    padding: '16px 40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  bannerText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: '14px',
    fontWeight: 600,
  },
  bannerBtn: {
    background: 'var(--brand)',
    color: 'var(--text-white)',
    border: 'none',
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
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
    color: 'rgba(255,255,255,0.55)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  link: {
    color: 'var(--text-white)',
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
    color: 'var(--text-white)',
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
    color: 'rgba(255,255,255,0.55)',
  },
  policyLinks: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  policyLink: {
    color: 'rgba(255,255,255,0.55)',
    textDecoration: 'none',
    fontSize: '12px',
  },
};

export default function Footer() {
  // Column titles, link wording and destinations are editable from the admin
  // panel; the constants above remain the fallback so the footer is never blank
  // because a request failed.
  const site = useSiteFooter();
  const social = FOOTER_LINKS.social;
  const columns = site.groups
    ? [
        ...site.groups.map((group, i) => [`custom${i}`, {
          title: group.title,
          links: (group.links || []).map((l) => ({ label: l.name, href: l.link }))
        }]),
        // Editing the link columns must not make the social row disappear - a
        // footer that silently loses its icons reads as a bug, not an edit.
        ['social', social]
      ]
    : Object.entries(FOOTER_LINKS);

  return (
    <footer style={styles.footer}>
      <div style={styles.topBanner}>
        <span style={styles.bannerText}>Sell on OptiKart</span>
        <Link to="/seller/register" style={styles.bannerBtn}>
          Become a Seller <FiChevronRight style={{ verticalAlign: 'middle' }} />
        </Link>
      </div>

      <div style={styles.main} className="footer-main">
        {columns.map(([key, col]) => (
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

      {/*
        An operator may add a line the customer needs to see - a returns notice, a
        support window, a GST or grievance contact. Empty by default, so nothing
        changes until someone writes it.
      */}
      {(site.footerNote || site.support?.email || site.support?.phone) && (
        <div style={{ padding: '0 40px 22px', fontSize: '12.5px', color: 'rgba(255,255,255,0.62)' }}>
          {site.footerNote && <div style={{ maxWidth: 880, marginBottom: 6 }}>{site.footerNote}</div>}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {site.support?.email && <a href={`mailto:${site.support.email}`} style={{ color: 'rgba(255,255,255,0.78)' }}>{site.support.email}</a>}
            {site.support?.phone && <a href={`tel:${site.support.phone.replace(/[^0-9+]/g, '')}`} style={{ color: 'rgba(255,255,255,0.78)' }}>{site.support.phone}</a>}
          </div>
        </div>
      )}

      <div style={styles.bottomBar} className="footer-bottom">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Logo variant="onDark" size={18} />
          <span style={styles.copyright}>© {new Date().getFullYear()} OptiKart. All rights reserved.</span>
        </span>

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
