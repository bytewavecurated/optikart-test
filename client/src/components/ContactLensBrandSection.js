import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

const CONTACT_LENS_BRANDS = [
  {
    name: 'Acuvue',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/ACUVUE_logo.svg/320px-ACUVUE_logo.svg.png',
    link: '/brands/acuvue',
  },
  {
    name: 'Bausch + Lomb',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Bausch_%26_Lomb_logo.svg/320px-Bausch_%26_Lomb_logo.svg.png',
    link: '/brands/bausch-lomb',
  },
  {
    name: 'CooperVision',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/CooperVision_logo.svg/320px-CooperVision_logo.svg.png',
    link: '/brands/cooper-vision',
  },
  {
    name: 'Alcon',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Alcon_logo.svg/320px-Alcon_logo.svg.png',
    link: '/brands/alcon',
  },
  {
    name: 'SofLens',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/ACUVUE_logo.svg/320px-ACUVUE_logo.svg.png',
    link: '/brands/soflens',
  },
  {
    name: 'Biofinity',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/CooperVision_logo.svg/320px-CooperVision_logo.svg.png',
    link: '/brands/biofinity',
  },
];

const styles = {
  section: {
    background: '#fff',
    padding: '24px 0',
    marginBottom: '32px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    borderRadius: '4px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  viewAll: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--primary)',
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'none',
  },
  brandGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '16px',
    padding: '0 24px',
  },
  brandCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    background: '#fafafa',
    borderRadius: '8px',
    textDecoration: 'none',
    transition: 'all 0.2s',
    border: '1px solid transparent',
  },
  logoContainer: {
    width: '100px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  logo: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  brandName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    textAlign: 'center',
    margin: 0,
  },
};

export default function ContactLensBrandSection() {
  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>Top Contact Lens Brands</h2>
        <Link to="/brands?category=contact-lenses" style={styles.viewAll}>
          View All <FiArrowRight />
        </Link>
      </div>
      <div style={styles.brandGrid}>
        {CONTACT_LENS_BRANDS.map((brand) => (
          <Link
            key={brand.name}
            to={brand.link}
            style={styles.brandCard}
            className="brand-card"
          >
            <div style={styles.logoContainer}>
              <img
                src={brand.logo}
                alt={brand.name}
                style={styles.logo}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span style={{ display: 'none', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {brand.name}
              </span>
            </div>
            <p style={styles.brandName}>{brand.name}</p>
          </Link>
        ))}
      </div>
      <style>{`
        .brand-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-color: var(--primary) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </section>
  );
}
