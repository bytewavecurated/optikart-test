import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTruck, FiShield, FiRefreshCw, FiHeadphones, FiArrowRight, FiTag, FiPercent,
  FiGift, FiEye, FiAward, FiStar, FiDroplet, FiSun, FiLayers,
  FiBookOpen, FiActivity, FiSmile, FiZap, FiMonitor, FiTool, FiAperture, FiHexagon
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
import { useHomeContent, iconFor } from '../services/homeContent';
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

/*
 * What shows when the administrator has changed nothing. The storefront-content
 * record stores only the overrides, so the two cannot drift apart, and a failed
 * content request still renders a complete home page.
 */
const CATEGORIES = [
  { name: 'Sunglasses', slug: 'sunglasses', icon: <FiSun size={18} /> },
  { name: 'Eyeglasses', slug: 'eyeglasses', icon: <FiEye size={18} /> },
  { name: 'Contact Lenses', slug: 'contact-lenses', icon: <FiDroplet size={18} /> },
  { name: 'Reading Glasses', slug: 'reading-glasses', icon: <FiBookOpen size={18} /> },
  { name: 'Sports Eyewear', slug: 'sports-eyewear', icon: <FiActivity size={18} /> },
  { name: 'Powered Sunglasses', slug: 'powered-sunglasses', icon: <FiZap size={18} /> },
  { name: 'Computer Glasses', slug: 'computer-glasses', icon: <FiMonitor size={18} /> },
  { name: 'Lens Care', slug: 'solution', icon: <FiDroplet size={18} /> },
  { name: 'Accessories', slug: 'accessories', icon: <FiTool size={18} /> },
  { name: 'Kids', slug: 'kids', icon: <FiSmile size={18} /> }
];

const OFFERS = [
  { title: 'Flat 50% off', subtitle: 'On premium sunglasses', tint: 'var(--brand-tint)', fg: 'var(--brand-dark)', icon: <FiPercent size={20} />, link: '/category/sunglasses' },
  { title: 'Buy 1 get 1', subtitle: 'Selected eyeglasses', tint: 'var(--bg-subtle)', fg: 'var(--text-primary)', icon: <FiGift size={20} />, link: '/category/eyeglasses' },
  { title: 'From ₹299', subtitle: 'Contact lenses', tint: 'var(--success-light)', fg: 'var(--success)', icon: <FiDroplet size={20} />, link: '/category/contact-lenses' },
  { title: 'Extra ₹200 off', subtitle: 'Use code EYE200', tint: 'var(--warning-light)', fg: 'var(--warning)', icon: <FiAward size={20} />, link: '/coupons' }
];


const FEATURES = [
  { icon: <FiTruck size={26} />, title: 'Free Delivery', desc: 'On orders above ₹999' },
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

/*
 * Icon to the left of the label instead of stacked above it: a row of names scans
 * far faster, and the chips stay readable when they wrap to one column on a phone.
 */
const chipLink = {
  display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 14px',
  textAlign: 'left', textDecoration: 'none', color: 'inherit',
  background: 'var(--bg-white)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 600,
  transition: 'border-color .15s ease, background-color .15s ease, color .15s ease'
};

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' };

const Home = () => {
  const content = useHomeContent();
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

  /*
   * Stored entries carry an icon *name* - only names already imported here are
   * accepted - while the built-in defaults carry the element. Normalising here
   * means each rail renders one shape either way.
   */
  const withIcon = (list) => (list || []).map((item) => {
    if (item.icon && typeof item.icon !== 'string') return item;
    const Icon = iconFor(item.icon);
    return { ...item, icon: Icon ? <Icon size={18} /> : null };
  });
  const categories = content.categoryRail ? withIcon(content.categoryRail) : CATEGORIES;
  const offers = content.promoTiles ? withIcon(content.promoTiles) : OFFERS;
  const facetRails = [
    {
      key: 'faceShapeRail', title: content.heading('faceShape'), subtitle: content.heading('faceShapeSub'),
      items: content.faceShapes || FACE_SHAPES, base: '/products?frameShape=', minWidth: '130px',
      icon: <FiAperture size={18} />
    },
    {
      key: 'frameTypeRail', title: content.heading('frameType'), subtitle: content.heading('frameTypeSub'),
      items: content.frameTypes || FRAME_TYPES, base: '/products?frameType=', minWidth: '160px',
      icon: <FiLayers size={18} />
    },
    {
      key: 'materialRail', title: content.heading('material'), subtitle: content.heading('materialSub'),
      items: content.frameMaterials || FRAME_MATERIALS, base: '/products?material=', minWidth: '150px',
      icon: <FiHexagon size={18} />, last: true
    }
  ];

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
            {sectionHeading(content.heading('categories'), content.heading('categoriesSub'))}
            <Link to="/categories" style={viewAllLink}>All Categories <FiArrowRight size={16} /></Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {categories.map((cat) => (
              <Link key={cat.slug} to={`/category/${cat.slug}`} className="home-chip card" style={chipLink}>
                <span style={{ color: 'var(--primary)', display: 'inline-flex', flexShrink: 0 }}>{cat.icon}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Offers */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {offers.map((offer) => (
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

        {content.visible('gender') && (
          <div className="container" style={{ maxWidth: 1400, marginTop: 36 }}>
            <GenderSelection tiles={content.genderTiles} />
          </div>
        )}

        {/*
          Face shape / frame type / material come from one list, so a rail the
          administrator switched off is absent from the page rather than painted
          over, and the three blocks cannot drift apart.
        */}
        <div className="container" style={{ maxWidth: 1400, marginTop: 36 }}>
          {facetRails.map((rail) => (content.visible(rail.key) ? (
            <div key={rail.key} style={{ marginBottom: rail.last ? 0 : 36 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>{rail.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{rail.subtitle}</p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${rail.minWidth}, 1fr))`, gap: 12 }}>
                {rail.items.map((value) => (
                  <Link key={value} to={`${rail.base}${encodeURIComponent(value)}`} className="home-chip card" style={chipLink}>
                    <span style={{ color: 'var(--primary)', display: 'inline-flex', flexShrink: 0 }}>{rail.icon}</span>
                    <span>{value}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null))}
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

          <CategorySection title={content.heading('categories')} subtitle={content.heading('categoriesSub')} />

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
