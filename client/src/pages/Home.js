import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiTruck, FiShield, FiRefreshCw, FiHeadphones, FiArrowRight, FiTag, FiPercent, FiGift, FiEye, FiAward } from 'react-icons/fi';
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
import { useUserBehavior } from '../contexts/UserBehaviorContext';

const ITEMS_PER_PAGE = 5;

const Home = () => {
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [dealsProducts, setDealsProducts] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [budgetBuys, setBudgetBuys] = useState([]);
  const [justForYou, setJustForYou] = useState([]);
  const [personalizedProducts1, setPersonalizedProducts1] = useState([]);
  const [personalizedProducts2, setPersonalizedProducts2] = useState([]);
  const [personalizedProducts3, setPersonalizedProducts3] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchHistory, browsingHistory, wishlist, cartItems } = useUserBehavior();

  const [dealsVisible, setDealsVisible] = useState(ITEMS_PER_PAGE);
  const [topPicksVisible, setTopPicksVisible] = useState(ITEMS_PER_PAGE);
  const [budgetVisible, setBudgetVisible] = useState(ITEMS_PER_PAGE);
  const [justForYouVisible, setJustForYouVisible] = useState(6);

  const shuffleArray = (arr) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

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
          const shuffled = shuffleArray(allRandom);
          setTopPicks(shuffled.slice(0, 10));
          setJustForYou(shuffleArray(allRandom).slice(0, 10));
        }

        // Fetch personalized products based on user behavior
        const userCategories = new Set();
        const userBrands = new Set();
        
        // Extract categories and brands from browsing history
        browsingHistory.forEach(product => {
          if (product.category) userCategories.add(product.category);
          if (product.brand) userBrands.add(product.brand);
        });

        // Extract from wishlist
        wishlist.forEach(product => {
          if (product.category) userCategories.add(product.category);
          if (product.brand) userBrands.add(product.brand);
        });

        // Extract from cart
        cartItems.forEach(item => {
          if (item.product?.category) userCategories.add(item.product.category);
          if (item.product?.brand) userBrands.add(item.product.brand);
        });

        // Extract from search history (simple keyword matching)
        searchHistory.forEach(query => {
          const lowerQuery = query.toLowerCase();
          if (lowerQuery.includes('sunglass')) userCategories.add('sunglasses');
          if (lowerQuery.includes('eyeglass') || lowerQuery.includes('glasses')) userCategories.add('eyeglasses');
          if (lowerQuery.includes('contact')) userCategories.add('contactlenses');
          if (lowerQuery.includes('ray-ban') || lowerQuery.includes('rayban')) userBrands.add('Ray-Ban');
          if (lowerQuery.includes('fastrack')) userBrands.add('Fastrack');
          if (lowerQuery.includes('lenskart')) userBrands.add('Lenskart Air');
        });

        // Fetch personalized products
        if (userCategories.size > 0 || userBrands.size > 0) {
          const personalizedFetches = [];
          
          // Based on categories
          if (userCategories.size > 0) {
            const categoryArray = Array.from(userCategories);
            personalizedFetches.push(
              products.getAll({ category: categoryArray[0], limit: 8, sort: 'rating' })
            );
            if (categoryArray.length > 1) {
              personalizedFetches.push(
                products.getAll({ category: categoryArray[1], limit: 8, sort: 'popularity' })
              );
            }
          }

          // Based on brands
          if (userBrands.size > 0) {
            const brandArray = Array.from(userBrands);
            personalizedFetches.push(
              products.getAll({ brand: brandArray[0], limit: 8, sort: 'newest' })
            );
          }

          // Fallback to random if not enough personalized data
          if (personalizedFetches.length < 3) {
            personalizedFetches.push(products.getRandom({ limit: 8 }));
          }

          const personalizedResults = await Promise.allSettled(personalizedFetches);
          
          if (personalizedResults[0]?.status === 'fulfilled') {
            setPersonalizedProducts1(personalizedResults[0].value.data.products || []);
          }
          if (personalizedResults[1]?.status === 'fulfilled') {
            setPersonalizedProducts2(personalizedResults[1].value.data.products || []);
          }
          if (personalizedResults[2]?.status === 'fulfilled') {
            setPersonalizedProducts3(personalizedResults[2].value.data.products || []);
          }
        } else {
          // No user behavior data, show random products
          const fallbackResults = await Promise.allSettled([
            products.getRandom({ limit: 8 }),
            products.getRandom({ limit: 8 }),
            products.getRandom({ limit: 8 })
          ]);
          
          if (fallbackResults[0]?.status === 'fulfilled') {
            setPersonalizedProducts1(fallbackResults[0].value.data.products || []);
          }
          if (fallbackResults[1]?.status === 'fulfilled') {
            setPersonalizedProducts2(fallbackResults[1].value.data.products || []);
          }
          if (fallbackResults[2]?.status === 'fulfilled') {
            setPersonalizedProducts3(fallbackResults[2].value.data.products || []);
          }
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
      color: '#1a237e', // Deep navy blue
      icon: <FiPercent size={48} />,
      link: '/category/sunglasses' 
    },
    { 
      title: 'Buy 1 Get 1', 
      subtitle: 'Selected eyeglasses', 
      color: '#0d47a1', // Strong blue
      icon: <FiGift size={48} />,
      link: '/category/eyeglasses' 
    },
    { 
      title: 'Starting ₹299', 
      subtitle: 'Contact lenses', 
      color: '#1565c0', // Medium blue
      icon: <FiEye size={48} />,
      link: '/category/contact-lenses' 
    },
    { 
      title: 'Extra ₹200 Off', 
      subtitle: 'Use code: EYE200', 
      color: '#1976d2', // Bright blue
      icon: <FiAward size={48} />,
      link: '/coupons' 
    },
  ];

  const features = [
    { icon: <FiTruck size={24} />, title: 'Free Delivery', desc: 'On orders above ₹999' },
    { icon: <FiShield size={24} />, title: '100% Genuine', desc: 'Authentic products only' },
    { icon: <FiRefreshCw size={24} />, title: 'Easy Returns', desc: '7-day return policy' },
    { icon: <FiHeadphones size={24} />, title: '24/7 Support', desc: 'Dedicated help center' },
  ];

  const renderSkeletons = (count = 5) =>
    Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card" style={{ height: '280px' }}>
        <div className="skeleton" style={{ height: '200px', width: '100%' }} />
        <div style={{ padding: '12px' }}>
          <div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '14px', width: '50%' }} />
        </div>
      </div>
    ));

  const renderProductGrid = (items, visibleCount) =>
    loading
      ? renderSkeletons()
      : items.slice(0, visibleCount).map((product) => (
          <ProductCard key={product._id} product={product} />
        ));

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  };

  const sectionTitleStyle = {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <HeroCarousel />
        <GenderSelection />

        <div className="container" style={{ marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {offers.map((offer, idx) => (
              <Link 
                key={idx} 
                to={offer.link} 
                className="offer-card"
                style={{ 
                  background: offer.color, 
                  borderRadius: '8px', 
                  padding: '24px', 
                  color: '#fff', 
                  transition: 'all 0.3s ease',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ 
                  opacity: 0.2, 
                  position: 'absolute', 
                  right: '16px', 
                  top: '16px',
                  fontSize: '64px'
                }}>
                  {offer.icon}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', zIndex: 1 }}>{offer.title}</div>
                <div style={{ fontSize: '14px', opacity: 0.95, zIndex: 1 }}>{offer.subtitle}</div>
              </Link>
            ))}
          </div>

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Trending Now</h2>
              <Link to="/search?sort=popularity" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>
                View All <FiArrowRight />
              </Link>
            </div>
            <div style={gridStyle}>
              {renderProductGrid(trendingProducts, trendingProducts.length)}
            </div>
          </section>

          <CategorySection />

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', gap: '8px' }}><FiTag color="var(--secondary)" /> Deals of the Day</h2>
            </div>
            <div style={gridStyle}>
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

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>New Arrivals</h2>
              <Link to="/search?sort=newest" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>
                View All <FiArrowRight />
              </Link>
            </div>
            <div style={gridStyle}>
              {renderProductGrid(newArrivals, newArrivals.length)}
            </div>
          </section>

          <BrandSection />

          <ContactLensBrandSection />

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Top Picks For You</h2>
            </div>
            <div style={gridStyle}>
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

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Best Sellers</h2>
              <Link to="/search?sort=rating" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>
                View All <FiArrowRight />
              </Link>
            </div>
            <div style={gridStyle}>
              {renderProductGrid(bestSellers, bestSellers.length)}
            </div>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'var(--secondary)', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>₹</span>
                Budget Buys Under ₹999
              </h2>
            </div>
            <div style={gridStyle}>
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

          <section style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Just For You</h2>
            </div>
            <div style={gridStyle}>
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

          {/* Personalized Section 1 - Based on user behavior */}
          {personalizedProducts1.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Curated For Your Style</h2>
                <Link to="/search" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>
                  Explore More <FiArrowRight />
                </Link>
              </div>
              <div style={gridStyle}>
                {personalizedProducts1.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* Personalized Section 2 - Based on user behavior */}
          {personalizedProducts2.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Trending In Your Feed</h2>
                <Link to="/search" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>
                  View All <FiArrowRight />
                </Link>
              </div>
              <div style={gridStyle}>
                {personalizedProducts2.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* Personalized Section 3 - Based on user behavior */}
          {personalizedProducts3.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Handpicked Selection</h2>
                <Link to="/search" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '14px', fontWeight: 500 }}>
                  Discover More <FiArrowRight />
                </Link>
              </div>
              <div style={gridStyle}>
                {personalizedProducts3.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section style={{ background: 'var(--bg-white)', borderRadius: '8px', padding: '24px', marginBottom: '32px', boxShadow: 'var(--shadow)' }}>
            <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px', textAlign: 'center' }}>
              {features.map((feature, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {feature.icon}
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600 }}>{feature.title}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <style>{`
        .offer-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .offer-card:active {
          transform: translateY(-2px);
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
