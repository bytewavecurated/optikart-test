import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiArrowRight } from 'react-icons/fi';

const GenderSelection = () => {
  const [selectedGender, setSelectedGender] = useState(null);
  const navigate = useNavigate();

  const genders = [
    {
      id: 'men',
      name: 'Men',
      image: 'https://images.unsplash.com/photo-1577803645773-f96470579636?w=400&h=400&fit=crop',
      color: '#2874f0'
    },
    {
      id: 'women',
      name: 'Women',
      image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=400&fit=crop',
      color: '#ff6161'
    },
    {
      id: 'kids',
      name: 'Kids',
      image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=400&fit=crop',
      color: '#ff9f00'
    }
  ];

  const categories = [
    { id: 'eyeglasses', name: 'Eyeglasses', icon: '👓' },
    { id: 'sunglasses', name: 'Sunglasses', icon: '🕶️' },
    { id: 'contactlenses', name: 'Contact Lenses', icon: '👁️' },
    { id: 'computer-glasses', name: 'Computer Glasses', icon: '💻' }
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
    <section style={{ padding: '40px 0', background: '#fff' }}>
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  background: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ 
                  width: '100%', 
                  height: '280px', 
                  overflow: 'hidden',
                  position: 'relative'
                }}>
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
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: `linear-gradient(to top, ${gender.color}, transparent)`,
                    padding: '40px 20px 20px'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '24px', 
                      fontWeight: 700, 
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <FiUser size={24} />
                      {gender.name}
                    </h3>
                  </div>
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
                ← Back to Gender Selection
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
                    background: '#fff',
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
