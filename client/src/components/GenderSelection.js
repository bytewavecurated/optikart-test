import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiArrowRight, FiDroplet, FiEye, FiMonitor, FiSun, FiUser } from 'react-icons/fi';

/*
 * `tiles` comes from the storefront-content screen: name, colour rule, wording
 * and photograph can all be replaced by an administrator. Anything left blank
 * falls back to the defaults below, so a partial edit cannot break the block.
 */
const DEFAULT_GENDERS = [
  { id: 'men', name: 'Men', image: '/assets/gen-men.svg', color: 'var(--brand)' },
  { id: 'women', name: 'Women', image: '/assets/gen-women.svg', color: '#ff6161' },
  { id: 'kids', name: 'Kids', image: '/assets/gen-kids.svg', color: 'var(--warning)' }
];

const GenderSelection = ({ tiles }) => {
  const [selectedGender, setSelectedGender] = useState(null);
  const navigate = useNavigate();

  const genders = (tiles && tiles.length)
    ? tiles.map((tile, i) => ({
        id: (tile.slug || tile.link || DEFAULT_GENDERS[i]?.id || `group-${i}`).replace(/^\//, '').split('?')[0],
        name: tile.name || DEFAULT_GENDERS[i]?.name || 'Shop',
        headline: tile.subtitle || '',
        image: tile.image || DEFAULT_GENDERS[i]?.image || '',
        color: tile.fg || DEFAULT_GENDERS[i]?.color || 'var(--brand)'
      }))
    : DEFAULT_GENDERS;

  const categories = [
    { id: 'eyeglasses', name: 'Eyeglasses', icon: <FiEye size={32} /> },
    { id: 'sunglasses', name: 'Sunglasses', icon: <FiSun size={32} /> },
    { id: 'contactlenses', name: 'Contact Lenses', icon: <FiDroplet size={32} /> },
    { id: 'computer-glasses', name: 'Computer Glasses', icon: <FiMonitor size={32} /> }
  ];

  const handleGenderSelect = (genderId) => {
    setSelectedGender(genderId);
  };

  const handleCategorySelect = (categoryId) => {
    if (selectedGender) {
      navigate(`/search?gender=${selectedGender}&category=${categoryId}`);
    }
  };

  const handleReset = () => {
    setSelectedGender(null);
  };

  return (
    <section style={{ padding: '40px 0', background: 'var(--bg-white)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            Shop by Gender
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Find the perfect eyewear for everyone
          </p>
        </div>

        {!selectedGender ? (
          // Gender Selection
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            {genders.map((gender) => (
              <div
                key={gender.id}
                onClick={() => handleGenderSelect(gender.id)}
                style={{
                  cursor: 'pointer',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-lg)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  background: 'var(--bg-white)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
              >
                <div style={{ width: '100%', height: '280px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                  <img
                    src={gender.image}
                    alt={gender.name}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      transition: 'transform 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </div>
                {/* The colour band sits under the photo instead of a gradient burnt
                    over it, so a real photograph stays readable and the label never
                    depends on the image's contrast. */}
                <div style={{ padding: '14px 18px', background: 'var(--bg-white)', borderTop: `3px solid ${gender.color}` }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '19px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FiUser size={19} style={{ color: gender.color }} />
                    {gender.name}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Category Selection
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <button
                onClick={handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-secondary)'
                }}
              >
                <FiArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Back to Gender Selection
              </button>
              <h3 style={{ margin: '16px 0 0 0', fontSize: '20px', fontWeight: 600 }}>
                Select Category for <span style={{ color: 'var(--primary)', textTransform: 'capitalize' }}>{selectedGender}</span>
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {categories.map((category) => (
                <div
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  style={{
                    padding: '24px',
                    background: 'var(--bg-white)',
                    border: '2px solid var(--border)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                    {category.icon}
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                    {category.name}
                  </h4>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '4px',
                    color: 'var(--primary)',
                    fontSize: '14px'
                  }}>
                    Shop Now <FiArrowRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default GenderSelection;
