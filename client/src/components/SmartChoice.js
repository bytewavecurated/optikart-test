import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiStar, FiArrowRight, FiUser, FiEye } from 'react-icons/fi';
import { products as productsApi } from '../services/api';
import { useUserBehavior } from '../contexts/UserBehaviorContext';
import { useAuth } from '../contexts/AuthContext';

const SmartChoice = () => {
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { browsingHistory, wishlist, cartItems } = useUserBehavior();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecommendedProducts();
  }, [browsingHistory, wishlist, cartItems, isAuthenticated]);

  const fetchRecommendedProducts = async () => {
    setLoading(true);
    try {
      // Analyze user behavior to determine preferences
      const preferences = analyzeUserPreferences();
      
      // Fetch products based on preferences
      const params = {
        limit: 8,
        sort: 'popularity'
      };

      if (preferences.category) {
        params.category = preferences.category;
      }

      if (preferences.gender) {
        params.gender = preferences.gender;
      }

      const response = await productsApi.getAll(params);
      const allProducts = response.data.data || [];
      
      // Shuffle and take 8 products
      const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
      setRecommendedProducts(shuffled.slice(0, 8));
    } catch (error) {
      console.error('Error fetching recommended products:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeUserPreferences = () => {
    const preferences = {
      category: null,
      gender: null,
      brands: []
    };

    // Analyze browsing history
    const historyCategories = {};
    const historyGenders = {};
    const historyBrands = {};

    browsingHistory.forEach(product => {
      if (product.category) {
        historyCategories[product.category] = (historyCategories[product.category] || 0) + 1;
      }
      if (product.gender) {
        historyGenders[product.gender] = (historyGenders[product.gender] || 0) + 1;
      }
      if (product.brand) {
        historyBrands[product.brand] = (historyBrands[product.brand] || 0) + 1;
      }
    });

    // Analyze wishlist
    wishlist.forEach(product => {
      if (product.category) {
        historyCategories[product.category] = (historyCategories[product.category] || 0) + 2;
      }
      if (product.gender) {
        historyGenders[product.gender] = (historyGenders[product.gender] || 0) + 2;
      }
    });

    // Analyze cart
    cartItems.forEach(item => {
      if (item.product?.category) {
        historyCategories[item.product.category] = (historyCategories[item.product.category] || 0) + 3;
      }
      if (item.product?.gender) {
        historyGenders[item.product.gender] = (historyGenders[item.product.gender] || 0) + 3;
      }
    });

    // Determine most common category
    const topCategory = Object.entries(historyCategories).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      preferences.category = topCategory[0];
    }

    // Determine most common gender
    const topGender = Object.entries(historyGenders).sort((a, b) => b[1] - a[1])[0];
    if (topGender) {
      preferences.gender = topGender[0];
    }

    return preferences;
  };

  const handleViewAll = () => {
    const preferences = analyzeUserPreferences();
    
    if (!isAuthenticated) {
      // Show gender selection modal for non-authenticated users
      navigate('/smart-choice/gender');
    } else if (!preferences.category) {
      // Show category selection
      navigate('/smart-choice/category');
    } else {
      // Navigate to filtered results
      const params = new URLSearchParams();
      if (preferences.category) params.set('category', preferences.category);
      if (preferences.gender) params.set('gender', preferences.gender);
      navigate(`/search?${params.toString()}`);
    }
  };

  if (loading) {
    return (
      <section style={{ padding: '40px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <FiStar size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Smart Choice For You</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card" style={{ height: '300px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recommendedProducts.length === 0) {
    return null;
  }

  return (
    <section style={{ padding: '40px 0', background: 'var(--bg-primary)' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiStar size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Smart Choice For You</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                {isAuthenticated 
                  ? 'Personalized recommendations based on your preferences'
                  : 'Login for personalized recommendations'}
              </p>
            </div>
          </div>
          <button
            onClick={handleViewAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            View All
            <FiArrowRight size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {recommendedProducts.map((product) => (
            <Link
              key={product._id}
              to={`/product/${product._id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{ overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }}>
                <div style={{ 
                  width: '100%', 
                  height: '200px', 
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  <img
                    src={product.images?.[0] || '/placeholder-glasses.png'}
                    alt={product.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase' }}>
                        {product.brand}
                      </p>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, lineHeight: '1.4' }}>
                        {product.title}
                      </h3>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiEye size={14} style={{ color: 'var(--text-light)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                        {product.viewCount || 0} views
                      </span>
                    </div>
                    {product.gender && (
                      <span style={{ 
                        padding: '2px 8px', 
                        background: 'var(--bg-primary)', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        textTransform: 'capitalize'
                      }}>
                        {product.gender}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                      ₹{product.discountedPrice || product.price}
                    </span>
                    {product.discountedPrice && product.price > product.discountedPrice && (
                      <span style={{ fontSize: '14px', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                        ₹{product.price}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SmartChoice;
