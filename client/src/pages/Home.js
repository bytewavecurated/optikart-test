import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTruck, FiShield, FiRefreshCw, FiHeadphones, FiArrowRight, FiTag, FiPercent,
  FiGift, FiEye, FiAward, FiStar, FiDroplet, FiSun, FiLayers,
  FiBookOpen, FiActivity, FiSmile
} from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';
import HeroCarousel from '../components/HeroCarousel';
import CategorySection from '../components/CategorySection';
import BrandSection from '../components/BrandSection';
import ContactLensBrandSection from '../components/ContactLensBrandSection';
import ProductCard from '../components/ProductCard';
import LoadMore from '../components/LoadMore';
import GenderSelection from '../components/GenderSelection';
import { products } from '../services/api';
import { useUserBehavior } from '../contexts/UserBehaviorContext';
import api from '../services/api';
import { listOf } from '../services/apiResponse.js';

const ITEMS_PER_PAGE = 8;

// Facets exposed on the home page. Values are sent to the products API which
// normalises the spelling, so these read as labels rather than raw enums.
const FACE_SHAPES = ['Rectangle', 'Cat Eye', 'Oval', 'Aviator', 'Geometric', 'Round', 'Square', 'Wayfarer'];
const FRAME_TYPES = ['Full Rim', 'Half Rim', 'Rimless'];
const FRAME_MATERIALS = ['Acetate', 'Metal', 'Polycarbonate', 'Stainless Steel', 'TR90', 'Titanium'];

const CATEGORIES = [
  { name: 'Sunglasses', slug: 'sunglasses', icon: <FiSun size={26} /> },
  { name: 'Eyeglasses', slug: 'eyeglasses', icon: <FiEye size={26} /> },
  { name: 'Contact Lenses', slug: 'contact-lenses', icon: <FiDroplet size={26} /> },
  { name: 'Reading Glasses', slug: 'reading-glasses', icon: <FiBookOpen size={26} /> },
  { name: 'Sports Eyewear', slug: 'sports-eyewear', icon: <FiActivity size={26} /> },
  { name: 'Kids', slug: 'kids', icon: <FiSmile size={26} /> }
];

const OFFERS = [
  { title: 'Flat 50% off', subtitle: 'On premium sunglasses', tint: '#eef4fe', fg: '#1b5fc4', icon: <FiPercent size={20} />, link: '/category/sunglasses' },
  { title: 'Buy 1 get 1', subtitle: 'Selected eyeglasses', tint: '#f1f3f6', fg: '#14161a', icon: <FiGift size={20} />, link: '/category/eyeglasses' },
  { title: 'From Rs. 299', subtitle: 'Contact lenses', tint: '#e8f5ee', fg: '#1a7f4b', icon: <FiDroplet size={20} />, link: '/category/contact-lenses' },
  { title: 'Extra Rs. 200 off', subtitle: 'Use code EYE200', tint: '#fdf3e3', fg: '#b06e00', icon: <FiAward size={20} />, link: '/coupons' }
];


const FEATURES = [
  { icon: <FiTruck size={26} />, title: 'Free Delivery', desc: 'On orders above Rs. 999' },
  { icon: <FiShield size={26} />, title: '100% Genuine', desc: 'Authentic products only' },
  { icon: <FiRefreshCw size={26} />, title: 'Easy Returns', desc: '7-day return policy' },
  { icon: <FiHeadphones size={26} />, title: '24/7 Support', desc: 'Dedicated help center' }
];

const sectionHeading = (title, subtitle) => (
  <div>
    <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>{title}</h2>
    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{subtitle}</p>
  </div>
);

const viewAllLink = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)',
  fontSize: '14px', fontWeight: 600, textDecoration: 'none', padding: '10px 18px',
  borderRadius: '8px', background: 'var(--primary-light)'
};

const chipLink = {
  display: 'block', padding: '16px 12px', textAlign: 'center', textDecoration: 'none',
  color: 'inherit', background: 'var(--bg-white)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s'
};

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' };

const Home = () => {
  const [trending, setTrending] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [brandGroups, setBrandGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { browsingHistory } = useUserBehavior();
  const [dealsVisible, setDealsVisible] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    const fetchData = async () => {
      const results = await Promise.allSettled([
        products.getAll({ sort: 'popularity', limit: 10 }),
        products.getAll({ sort: 'newest', limit: 10 }),
        products.getAll({ sort: 'rating', limit: 10 }),
        products.getAll({ hasOffer: true, limit: 10 }),
        api.get('/products/manufacturer-brands', { params: { perBrand: 8 } })
      ]);

      const pick = (i, key) => (results[i].status === 'fulfilled' ? listOf(results[i].value.data) : []);
      setTrending(pick(0));
      setNewArrivals(pick(1));
      setBestSellers(pick(2));
      setDeals(pick(3));
      if (results[4].status === 'fulfilled') setBrandGroups(results[4].value.data.brands || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const renderGrid = (items, visible) => {
    if (loading) {
      return Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: '320px', borderRadius: 'var(--radius)', background: 'var(--border-light)' }} />
      ));
    }
    return (visible === undefined ? items : items.slice(0, visible)).map((product) => (
      <ProductCard key={product._id} product={product} />
    ));
  };

  const activeBrands = brandGroups.slice(0, 4);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <HeroCarousel />

        {/* Trust strip */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <span style={{ color: 'var(--primary)' }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{f.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            {sectionHeading('Shop by Category', 'Find exactly what you are looking for')}
            <Link to="/categories" style={viewAllLink}>All Categories <FiArrowRight size={16} /></Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {CATEGORIES.map((cat) => (
              <Link key={cat.slug} to={`/category/${cat.slug}`} className="home-chip card" style={chipLink}>
                <span style={{ color: 'var(--primary)', display: 'block', marginBottom: 8 }}>{cat.icon}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Offers */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {OFFERS.map((offer) => (
              <Link
                key={offer.title}
                to={offer.link}
                className="offering"
                style={{
                  background: 'var(--bg-white)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 10, background: offer.tint, color: offer.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {offer.icon}
                </span>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>{offer.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{offer.subtitle}</div>
                <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Shop now <FiArrowRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="container" style={{ maxWidth: 1400, marginTop: 36 }}>
          <GenderSelection />
        </div>

        {/* Face shape / frame type / material */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 36 }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Shop by Face Shape</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Pick the frame that suits you best</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {FACE_SHAPES.map((shape) => (
                <Link key={shape} to={`/products?frameShape=${encodeURIComponent(shape)}`} className="home-chip card" style={chipLink}>{shape}</Link>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Shop by Frame Type</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Full rim, half rim and rimless constructions</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {FRAME_TYPES.map((type) => (
                <Link key={type} to={`/products?frameType=${encodeURIComponent(type)}`} className="home-chip card" style={chipLink}>
                  <FiLayers size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary)' }} />{type}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Shop by Material</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px' }}>The material decides the weight, feel and durability</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {FRAME_MATERIALS.map((mat) => (
                <Link key={mat} to={`/products?material=${encodeURIComponent(mat)}`} className="home-chip card" style={chipLink}>{mat}</Link>
              ))}
            </div>
          </div>
        </div>

        {/* Trending */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 44 }}>
          <section style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              {sectionHeading('Trending Now', 'Most popular products this week')}
              <Link to="/products?sort=popularity" style={viewAllLink}>View All <FiArrowRight size={16} /></Link>
            </div>
            <div style={gridStyle}>{renderGrid(trending)}</div>
          </section>

          <CategorySection />

          {/* Deals */}
          <section style={{ margin: '44px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                <FiTag size={22} />
              </div>
              {sectionHeading('Deals of the Day', 'Exclusive offers just for you')}
            </div>
            <div style={gridStyle}>{renderGrid(deals, dealsVisible)}</div>
            {!loading && deals.length > dealsVisible && (
              <LoadMore onLoadMore={() => setDealsVisible((p) => p + ITEMS_PER_PAGE)} hasMore label="Load More Deals" />
            )}
          </section>

          {/* New arrivals */}
          <section style={{ margin: '44px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              {sectionHeading('New Arrivals', 'Fresh styles just landed')}
              <Link to="/products?sort=newest" style={viewAllLink}>View All <FiArrowRight size={16} /></Link>
            </div>
            <div style={gridStyle}>{renderGrid(newArrivals)}</div>
          </section>

          <BrandSection />

          {/* Brand-wise manufacturer catalogue */}
          <section style={{ margin: '44px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              {sectionHeading('Shop by Brand', 'Every product each manufacturer has listed, grouped by brand')}
              <Link to="/brands" style={viewAllLink}>All Brands <FiArrowRight size={16} /></Link>
            </div>
            {loading ? (
              <div style={gridStyle}>{renderGrid([])}</div>
            ) : activeBrands.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No manufacturer catalogue is published yet.
              </div>
            ) : (
              activeBrands.map((group) => (
                <div key={group.brand} style={{ marginBottom: 36 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '20px 0 14px', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{group.brand}</h3>
                    <Link to={`/products?brand=${encodeURIComponent(group.brand)}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                      View all {group.productCount} products
                    </Link>
                  </div>
                  <div style={gridStyle}>
                    {group.products.map((product) => <ProductCard key={product._id} product={product} />)}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Recently viewed - persisted locally, so returning shoppers can
              pick up where they left off. */}
          {(browsingHistory || []).length > 0 && (
            <section style={{ margin: '44px 0' }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.4px' }}>Recently Viewed</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Items you looked at recently</p>
              </div>
              <div className="rail">
                {browsingHistory.slice(0, 10).map((p) => (
                  <div key={p._id} style={{ width: 210 }}>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <ContactLensBrandSection />

          {/* Best sellers */}
          <section style={{ margin: '44px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                  <FiStar size={22} />
                </div>
                {sectionHeading('Best Sellers', 'Highest rated by our customers')}
              </div>
              <Link to="/products?sort=rating" style={viewAllLink}>View All <FiArrowRight size={16} /></Link>
            </div>
            <div style={gridStyle}>{renderGrid(bestSellers)}</div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Home;
