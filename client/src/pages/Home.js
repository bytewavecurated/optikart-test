import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiTruck, FiShield, FiRefreshCw, FiHeadphones, FiArrowRight, FiTag, FiPercent, FiGift, FiEye, FiAward, FiStar } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';
import HeroCarousel from '../components/HeroCarousel';
import CategorySection from '../components/CategorySection';
import BrandSection from '../components/BrandSection';
import ContactLensBrandSection from '../components/ContactLensBrandSection';
import ProductCard from '../components/ProductCard';
import LoadMore from '../components/LoadMore';
import SmartChoice from '../components/SmartChoice';
import GenderSelection from '../components/GenderSelection';
import { products } from '../services/api';

const ITEMS_PER_PAGE = 8;

const Home = () => {
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [dealsProducts, setDealsProducts] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [budgetBuys, setBudgetBuys] = useState([]);
  const [justForYou, setJustForYou] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dealsVisible, setDealsVisible] = useState(ITEMS_PER_PAGE);
  const [topPicksVisible, setTopPicksVisible] = useState(ITEMS_PER_PAGE);
  const [budgetVisible, setBudgetVisible] = useState(ITEMS_PER_PAGE);
  const [justForYouVisible, setJustForYouVisible] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendingRes, newArrivalsRes, bestSellersRes, dealsRes, budgetRes, randomRes] = await Promise.allSettled([
          products.getAll({ sort: 'popularity', limit: 10 }),
          products.getAll({ sort: 'newest', limit: 10 }),
          products.getAll({ sort: 'rating', limit: 10 }),
          products.getAll({ hasOffer: true, limit: 10 }),
          products.getAll({ maxPrice: 999, limit: 10 }),
          products.getRandom({ limit: 20 }),
        ]);

        if (trendingRes.status === 'fulfilled') setTrendingProducts(trendingRes.value.data.products || []);
        if (newArrivalsRes.status === 'fulfilled') setNewArrivals(newArrivalsRes.value.data.products || []);
        if (bestSellersRes.status === 'fulfilled') setBestSellers(bestSellersRes.value.data.products || []);
        if (dealsRes.status === 'fulfilled') setDealsProducts(dealsRes.value.data.products || []);
        if (budgetRes.status === 'fulfilled') setBudgetBuys(budgetRes.value.data.products || []);

        if (randomRes.status === 'fulfilled') {
          const allRandom = randomRes.value.data.products || [];
          const shuffled = [...allRandom].sort(() => Math.random() - 0.5);
          setTopPicks(shuffled.slice(0, 10));
          setJustForYou([...allRandom].sort(() => Math.random() - 0.5).slice(0, 10));
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const offers = [
    { 
      title: 'Flat 50% Off', 
      subtitle: 'On premium sunglasses', 
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: <FiPercent size={32} />,
      link: '/category/sunglasses' 
    },
    { 
      title: 'Buy 1 Get 1', 
      subtitle: 'Selected eyeglasses', 
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      icon: <FiGift size={32} />,
      link: '/category/eyeglasses' 
    },
    { 
      title: 'Starting ₹299', 
      subtitle: 'Contact lenses', 
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      icon: <FiEye size={32} />,
      link: '/category/contact-lenses' 
    },
    { 
      title: 'Extra ₹200 Off', 
      subtitle: 'Use code: EYE200', 
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      icon: <FiAward size={32} />,
      link: '/coupons' 
    },
  ];

  const features = [
    { icon: <FiTruck size={28} />, title: 'Free Delivery', desc: 'On orders above ₹999', color: '#667eea' },
    { icon: <FiShield size={28} />, title: '100% Genuine', desc: 'Authentic products only', color: '#f5576c' },
    { icon: <FiRefreshCw size={28} />, title: 'Easy Returns', desc: '7-day return policy', color: '#4facfe' },
    { icon: <FiHeadphones size={28} />, title: '24/7 Support', desc: 'Dedicated help center', color: '#43e97b' },
  ];

  const renderSkeletons = (count = 8) =>
    Array.from({ length: count }).map((_, i) => (
      <div key={i} className="product-skeleton" style={{ height: '320px', borderRadius: '12px', background: '#f5f5f5' }}>
        <div className="skeleton" style={{ height: '240px', width: '100%', borderRadius: '12px 12px 0 0' }} />
        <div style={{ padding: '16px' }}>
          <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '8px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ height: '14px', width: '50%', borderRadius: '4px' }} />
        </div>
      </div>
    ));

  const renderProductGrid = (items, visibleCount) =>
    loading
      ? renderSkeletons()
      : items.slice(0, visibleCount).map((product) => (
          <ProductCard key={product._id} product={product} />
        ));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f9fa' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <HeroCarousel />
        <GenderSelection />

        <div className="container" style={{ marginTop: '24px', maxWidth: '1400px' }}>
          {/* Offers Section - Modern Gradient Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '40px' }}>
            {offers.map((offer, idx) => (
              <Link 
                key={idx} 
                to={offer.link} 
                className="modern-offer-card"
                style={{ 
                  background: offer.gradient, 
                  borderRadius: '16px', 
                  padding: '28px', 
                  color: '#fff', 
                  textDecoration: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ 
                  position: 'absolute', 
                  right: '-20px', 
                  top: '-20px',
                  opacity: 0.15,
                  transform: 'rotate(15deg)'
                }}>
                  {offer.icon}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.2 }}>{offer.title}</div>
                <div style={{ fontSize: '14px', opacity: 0.95, fontWeight: 500 }}>{offer.subtitle}</div>
                <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Shop Now <FiArrowRight size={14} />
                </div>
              </Link>
            ))}
          </div>

          {/* Trending Now Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                  Trending Now
                </h2>
                <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Most popular products this week</p>
              </div>
              <Link to="/search?sort=popularity" className="view-all-btn" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: '#667eea', 
                fontSize: '14px', 
                fontWeight: 600,
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#f0f4ff',
                transition: 'all 0.3s ease'
              }}>
                View All <FiArrowRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(trendingProducts, trendingProducts.length)}
            </div>
          </section>

          <CategorySection />

          {/* Deals of the Day Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}>
                  <FiTag size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                    Deals of the Day
                  </h2>
                  <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Exclusive offers just for you</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(dealsProducts, dealsVisible)}
            </div>
            {!loading && dealsProducts.length > 0 && (
              <LoadMore
                onLoadMore={() => setDealsVisible((prev) => prev + ITEMS_PER_PAGE)}
                hasMore={dealsVisible < dealsProducts.length}
                label="Load More Deals"
              />
            )}
          </section>

          {/* New Arrivals Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                  New Arrivals
                </h2>
                <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Fresh styles just landed</p>
              </div>
              <Link to="/search?sort=newest" className="view-all-btn" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: '#667eea', 
                fontSize: '14px', 
                fontWeight: 600,
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#f0f4ff',
                transition: 'all 0.3s ease'
              }}>
                View All <FiArrowRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(newArrivals, newArrivals.length)}
            </div>
          </section>

          <BrandSection />
          <ContactLensBrandSection />

          {/* Top Picks Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}>
                  <FiStar size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                    Top Picks For You
                  </h2>
                  <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Handpicked based on your preferences</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(topPicks, topPicksVisible)}
            </div>
            {!loading && topPicks.length > 0 && (
              <LoadMore
                onLoadMore={() => setTopPicksVisible((prev) => prev + ITEMS_PER_PAGE)}
                hasMore={topPicksVisible < topPicks.length}
                label="Load More Picks"
              />
            )}
          </section>

          {/* Best Sellers Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                  Best Sellers
                </h2>
                <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Customer favorites</p>
              </div>
              <Link to="/search?sort=rating" className="view-all-btn" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: '#667eea', 
                fontSize: '14px', 
                fontWeight: 600,
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#f0f4ff',
                transition: 'all 0.3s ease'
              }}>
                View All <FiArrowRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(bestSellers, bestSellers.length)}
            </div>
          </section>

          {/* Budget Buys Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 800
                }}>
                  ₹
                </div>
                <div>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                    Budget Buys Under ₹999
                  </h2>
                  <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Quality eyewear at affordable prices</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(budgetBuys, budgetVisible)}
            </div>
            {!loading && budgetBuys.length > 0 && (
              <LoadMore
                onLoadMore={() => setBudgetVisible((prev) => prev + ITEMS_PER_PAGE)}
                hasMore={budgetVisible < budgetBuys.length}
                label="Load More Budget Buys"
              />
            )}
          </section>

          {/* Just For You Section */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#212121', margin: 0, letterSpacing: '-0.5px' }}>
                  Just For You
                </h2>
                <p style={{ fontSize: '14px', color: '#757575', margin: '4px 0 0 0' }}>Personalized recommendations</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {renderProductGrid(justForYou, justForYouVisible)}
            </div>
            {!loading && justForYou.length > 0 && (
              <LoadMore
                onLoadMore={() => setJustForYouVisible((prev) => prev + ITEMS_PER_PAGE)}
                hasMore={justForYouVisible < justForYou.length}
                label="Load More"
              />
            )}
          </section>

          <SmartChoice />

          {/* Features Section - Modern Design */}
          <section style={{ marginBottom: '48px' }}>
            <div style={{ 
              background: '#fff', 
              borderRadius: '16px', 
              padding: '40px', 
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
                {features.map((feature, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      color: '#fff',
                      background: feature.color,
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: `0 4px 12px ${feature.color}40`
                    }}>
                      {feature.icon}
                    </div>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#212121' }}>{feature.title}</h4>
                    <p style={{ fontSize: '13px', color: '#757575', margin: 0, lineHeight: 1.5 }}>{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <style>{`
        .modern-offer-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.15);
        }
        .view-all-btn:hover {
          background: #667eea !important;
          color: #fff !important;
        }
        .product-skeleton {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s ease-in-out infinite;
        }
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 768px) {
          .container {
            padding: 0 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
