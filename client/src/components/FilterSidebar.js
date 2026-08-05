import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiChevronDown, FiChevronUp, FiFilter } from 'react-icons/fi';
import api from '../services/api';

const DEFAULT_FRAME_SHAPES = ['Round', 'Rectangle', 'Square', 'Aviator', 'Cat Eye', 'Wayfarer', 'Oval', 'Geometric'];
const DEFAULT_COLORS = [
  { name: 'Black', hex: '#000' }, { name: 'Brown', hex: '#8B4513' },
  { name: 'Gold', hex: '#FFD700' }, { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Blue', hex: '#2874f0' }, { name: 'Red', hex: '#e43f5a' },
  { name: 'Green', hex: '#388e3c' }, { name: 'Transparent', hex: '#e0e0e0' },
  { name: 'Multi', hex: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)' },
];
const DEFAULT_LENS_TYPES = ['Non-Powered', 'Powered', 'Photochromic', 'Polarized', 'Blue-Cut'];
const DEFAULT_GENDERS = ['Men', 'Women', 'Unisex', 'Kids'];
const DEFAULT_FRAME_SIZES = ['Small', 'Medium', 'Large', 'Extra-Large'];
const RATING_OPTIONS = [
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
  { label: '2★ & above', value: 2 },
];
const DISCOUNT_OPTIONS = [
  { label: '10% or more', value: 10 },
  { label: '20% or more', value: 20 },
  { label: '30% or more', value: 30 },
  { label: '50% or more', value: 50 },
];

const styles = {
  sidebar: {
    width: '260px',
    background: '#fff',
    borderRadius: '4px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    fontFamily: "'Roboto', sans-serif",
    overflow: 'hidden',
    position: 'sticky',
    top: '120px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid #f0f0f0',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#212121',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  clearBtn: {
    fontSize: '13px',
    color: '#2874f0',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  section: {
    padding: '16px',
    borderBottom: '1px solid #f0f0f0',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#212121',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  checkboxWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#555',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#2874f0',
    cursor: 'pointer',
  },
  rangeWrap: {
    padding: '8px 0',
  },
  rangeLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#888',
    marginBottom: '8px',
  },
  rangeInput: {
    width: '100%',
    accentColor: '#2874f0',
    cursor: 'pointer',
  },
  priceInputs: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '8px',
  },
  priceInput: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  colorItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#666',
  },
  colorSwatch: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid #e0e0e0',
    transition: 'all 0.15s',
  },
  colorSwatchActive: {
    border: '2px solid #2874f0',
    boxShadow: '0 0 0 2px rgba(40,116,240,0.3)',
  },
  mobileToggle: {
    display: 'none',
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    background: '#2874f0',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '52px',
    height: '52px',
    boxShadow: '0 4px 12px rgba(40,116,240,0.4)',
    cursor: 'pointer',
    zIndex: 1400,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  closeMobile: {
    display: 'none',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666',
  },
  applyBtn: {
    width: '100%',
    padding: '12px',
    background: '#2874f0',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    borderRadius: '0 0 4px 4px',
  },
};

export default function FilterSidebar({ filters = {}, onFilterChange, mobileOpen = false, onMobileClose }) {
  const [localFilters, setLocalFilters] = useState({
    priceRange: [0, 50000],
    brands: [],
    categories: [],
    frameShapes: [],
    colors: [],
    lensTypes: [],
    genders: [],
    frameSizes: [],
    minRating: 0,
    minDiscount: 0,
    ...filters,
  });
  const [expanded, setExpanded] = useState({
    price: true, brands: true, category: true, frameShape: false,
    color: false, lensType: false, gender: false, frameSize: false, rating: false, discount: false,
  });
  const [dynamicBrands, setDynamicBrands] = useState([]);
  const [dynamicColors, setDynamicColors] = useState(null);

  useEffect(() => {
    setLocalFilters(prev => ({ ...prev, ...filters }));
  }, [filters]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await api.get('/products/filters');
        const data = res.data.data || res.data;
        if (data.brands) setDynamicBrands(data.brands);
        if (data.colors) {
          setDynamicColors(data.colors.map(c =>
            typeof c === 'string'
              ? { name: c, hex: DEFAULT_COLORS.find(dc => dc.name.toLowerCase() === c.toLowerCase())?.hex || '#ccc' }
              : c
          ));
        }
      } catch {}
    };
    fetchFilterOptions();
  }, []);

  const brands = dynamicBrands.length > 0 ? dynamicBrands : [];
  const colors = dynamicColors || DEFAULT_COLORS;

  const toggleSection = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleArrayFilter = (key, value) => {
    setLocalFilters(prev => {
      const arr = prev[key] || [];
      const updated = arr.includes(value)
        ? arr.filter(v => v !== value)
        : [...arr, value];
      const newFilters = { ...prev, [key]: updated };
      onFilterChange && onFilterChange(newFilters);
      return newFilters;
    });
  };

  const handlePriceChange = (index, value) => {
    setLocalFilters(prev => {
      const range = [...prev.priceRange];
      range[index] = Number(value);
      const newFilters = { ...prev, priceRange: range };
      onFilterChange && onFilterChange(newFilters);
      return newFilters;
    });
  };

  const clearAll = () => {
    const cleared = {
      priceRange: [0, 50000],
      brands: [],
      categories: [],
      frameShapes: [],
      colors: [],
      lensTypes: [],
      genders: [],
      frameSizes: [],
      minRating: 0,
      minDiscount: 0,
    };
    setLocalFilters(cleared);
    onFilterChange && onFilterChange(cleared);
  };

  const activeCount = (localFilters.brands?.length || 0) +
    (localFilters.categories?.length || 0) +
    (localFilters.frameShapes?.length || 0) +
    (localFilters.colors?.length || 0) +
    (localFilters.lensTypes?.length || 0) +
    (localFilters.genders?.length || 0) +
    (localFilters.frameSizes?.length || 0) +
    (localFilters.minRating > 0 ? 1 : 0) +
    (localFilters.minDiscount > 0 ? 1 : 0) +
    (localFilters.priceRange[0] > 0 || localFilters.priceRange[1] < 50000 ? 1 : 0);

  const Section = ({ title, filterKey, children }) => (
    <div style={styles.section}>
      <div style={styles.sectionHeader} onClick={() => toggleSection(filterKey)}>
        <span style={styles.sectionTitle}>{title}</span>
        {expanded[filterKey] ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
      </div>
      {expanded[filterKey] && children}
    </div>
  );

  const sidebarContent = (
    <>
      <div style={styles.header}>
        <span style={styles.title}>
          <FiFilter /> Filters
          {activeCount > 0 && (
            <span style={{ background: '#2874f0', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
              {activeCount}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeCount > 0 && (
            <button style={styles.clearBtn} onClick={clearAll}>CLEAR ALL</button>
          )}
          <button style={styles.closeMobile} className="filter-close-mobile" onClick={onMobileClose}>
            <FiX />
          </button>
        </div>
      </div>

      <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <Section title="Price Range" filterKey="price">
          <div style={styles.rangeWrap}>
            <div style={styles.rangeLabels}>
              <span>₹{localFilters.priceRange[0].toLocaleString()}</span>
              <span>₹{localFilters.priceRange[1].toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="500"
              value={localFilters.priceRange[0]}
              onChange={(e) => handlePriceChange(0, e.target.value)}
              style={styles.rangeInput}
            />
            <input
              type="range"
              min="0"
              max="50000"
              step="500"
              value={localFilters.priceRange[1]}
              onChange={(e) => handlePriceChange(1, e.target.value)}
              style={{ ...styles.rangeInput, marginTop: '8px' }}
            />
            <div style={styles.priceInputs}>
              <input
                type="number"
                placeholder="Min"
                value={localFilters.priceRange[0] || ''}
                onChange={(e) => handlePriceChange(0, e.target.value)}
                style={styles.priceInput}
              />
              <span style={{ color: '#888', fontSize: '13px' }}>to</span>
              <input
                type="number"
                placeholder="Max"
                value={localFilters.priceRange[1] === 50000 ? '' : localFilters.priceRange[1]}
                onChange={(e) => handlePriceChange(1, e.target.value)}
                style={styles.priceInput}
              />
            </div>
          </div>
        </Section>

        {brands.length > 0 && (
          <Section title="Brand" filterKey="brands">
            {brands.map((brand) => (
              <label key={brand} style={styles.checkboxWrap}>
                <input
                  type="checkbox"
                  checked={localFilters.brands?.includes(brand)}
                  onChange={() => toggleArrayFilter('brands', brand)}
                  style={styles.checkbox}
                />
                {brand}
              </label>
            ))}
          </Section>
        )}

        <Section title="Category" filterKey="category">
          {['Sunglasses', 'Eyeglasses', 'Contact Lenses', 'Reading Glasses', 'Sports', 'Kids'].map((cat) => (
            <label key={cat} style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={localFilters.categories?.includes(cat)}
                onChange={() => toggleArrayFilter('categories', cat)}
                style={styles.checkbox}
              />
              {cat}
            </label>
          ))}
        </Section>

        <Section title="Frame Shape" filterKey="frameShape">
          {DEFAULT_FRAME_SHAPES.map((shape) => (
            <label key={shape} style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={localFilters.frameShapes?.includes(shape)}
                onChange={() => toggleArrayFilter('frameShapes', shape)}
                style={styles.checkbox}
              />
              {shape}
            </label>
          ))}
        </Section>

        <Section title="Frame Color" filterKey="color">
          <div style={styles.colorGrid}>
            {colors.map((color) => (
              <div
                key={color.name}
                style={styles.colorItem}
                onClick={() => toggleArrayFilter('colors', color.name)}
              >
                <div
                  style={{
                    ...styles.colorSwatch,
                    background: color.hex,
                    ...(localFilters.colors?.includes(color.name) ? styles.colorSwatchActive : {}),
                  }}
                />
                <span>{color.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Lens Type" filterKey="lensType">
          {DEFAULT_LENS_TYPES.map((type) => (
            <label key={type} style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={localFilters.lensTypes?.includes(type)}
                onChange={() => toggleArrayFilter('lensTypes', type)}
                style={styles.checkbox}
              />
              {type}
            </label>
          ))}
        </Section>

        <Section title="Gender" filterKey="gender">
          {DEFAULT_GENDERS.map((g) => (
            <label key={g} style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={localFilters.genders?.includes(g)}
                onChange={() => toggleArrayFilter('genders', g)}
                style={styles.checkbox}
              />
              {g}
            </label>
          ))}
        </Section>

        <Section title="Frame Size" filterKey="frameSize">
          {DEFAULT_FRAME_SIZES.map((size) => (
            <label key={size} style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={localFilters.frameSizes?.includes(size)}
                onChange={() => toggleArrayFilter('frameSizes', size)}
                style={styles.checkbox}
              />
              {size}
            </label>
          ))}
        </Section>

        <Section title="Rating" filterKey="rating">
          {RATING_OPTIONS.map((opt) => (
            <label key={opt.value} style={styles.checkboxWrap}>
              <input
                type="radio"
                name="rating"
                checked={localFilters.minRating === opt.value}
                onChange={() => {
                  const newFilters = { ...localFilters, minRating: localFilters.minRating === opt.value ? 0 : opt.value };
                  setLocalFilters(newFilters);
                  onFilterChange && onFilterChange(newFilters);
                }}
                style={styles.checkbox}
              />
              {opt.label}
            </label>
          ))}
        </Section>

        <Section title="Discount" filterKey="discount">
          {DISCOUNT_OPTIONS.map((opt) => (
            <label key={opt.value} style={styles.checkboxWrap}>
              <input
                type="radio"
                name="discount"
                checked={localFilters.minDiscount === opt.value}
                onChange={() => {
                  const newFilters = { ...localFilters, minDiscount: localFilters.minDiscount === opt.value ? 0 : opt.value };
                  setLocalFilters(newFilters);
                  onFilterChange && onFilterChange(newFilters);
                }}
                style={styles.checkbox}
              />
              {opt.label}
            </label>
          ))}
        </Section>
      </div>
    </>
  );

  return (
    <>
      <div style={styles.sidebar} className="filter-sidebar-desktop">
        {sidebarContent}
      </div>

      {mobileOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1500, display: 'block' }} className="filter-mobile-overlay" onClick={onMobileClose}>
          <div
            style={{
              ...styles.sidebar,
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100vh',
              zIndex: 1501,
              borderRadius: 0,
              width: '300px',
            }}
            className="filter-sidebar-mobile"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
            <button style={styles.applyBtn} onClick={onMobileClose}>
              Apply Filters
            </button>
          </div>
        </div>
      )}

      <button
        style={styles.mobileToggle}
        className="filter-mobile-toggle"
        onClick={() => {}}
      >
        <FiFilter />
      </button>

      <style>{`
        @media (max-width: 768px) {
          .filter-sidebar-desktop { display: none !important; }
          .filter-mobile-toggle { display: flex !important; }
          .filter-close-mobile { display: block !important; }
        }
        @media (min-width: 769px) {
          .filter-mobile-overlay { display: none !important; }
          .filter-mobile-toggle { display: none !important; }
        }
      `}</style>
    </>
  );
}
