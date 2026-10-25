import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi';

const AdvancedSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    frameShape: '',
    frameType: '',
    frameMaterial: '',
    gender: '',
    priceMin: '',
    priceMax: '',
    color: '',
    rating: ''
  });

  const categories = ['sunglasses', 'eyeglasses', 'contactlenses', 'readingglasses', 'sportseyewear'];
  const frameShapes = ['Rectangle', 'Cat Eye', 'Oval', 'Aviator', 'Round', 'Wayfarer', 'Geometric', 'Square'];
  const frameTypes = ['Full Rim', 'Half Rim', 'Rimless'];
  const materials = ['Acetate', 'Metal', 'Polycarbonate', 'Stainless Steel', 'TR90', 'Titanium', 'Plastic', 'Wood'];
  const genders = ['Men', 'Women', 'Unisex', 'Kids'];
  const colors = ['Black', 'Brown', 'Gold', 'Silver', 'Blue', 'Red', 'Green', 'Pink', 'Transparent'];

  useEffect(() => {
    // Parse URL params on mount
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    setSearchQuery(query);
    
    const newFilters = {
      category: params.get('category') || '',
      brand: params.get('brand') || '',
      frameShape: params.get('frameShape') || '',
      frameType: params.get('frameType') || '',
      frameMaterial: params.get('frameMaterial') || '',
      gender: params.get('gender') || '',
      priceMin: params.get('priceMin') || '',
      priceMax: params.get('priceMax') || '',
      color: params.get('color') || '',
      rating: params.get('rating') || ''
    };
    setFilters(newFilters);
  }, [location.search]);

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilters();
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set('q', searchQuery);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    navigate(`/products?${params.toString()}`);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      brand: '',
      frameShape: '',
      frameType: '',
      frameMaterial: '',
      gender: '',
      priceMin: '',
      priceMax: '',
      color: '',
      rating: ''
    });
    setSearchQuery('');
    navigate('/products');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || searchQuery !== '';

  return (
    <>
      {/* Search Bar */}
      <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}>
        <form onSubmit={handleSearch}>
          <FiSearch style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} size={20} />
          <input
            type="text"
            placeholder="Search products, brands, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
            style={{ paddingLeft: '48px', paddingRight: '120px', fontSize: '16px', height: '56px' }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="btn btn-outline"
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <FiFilter size={16} /> Filters
          </button>
        </form>
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div className="card" style={{ padding: '24px', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)' }}>Advanced Filters</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="btn btn-sm btn-outline">
                  <FiX size={14} /> Clear All
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="btn btn-sm btn-outline">
                Close
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Category */}
            <div className="input-group">
              <label>Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="input"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div className="input-group">
              <label>Brand</label>
              <input
                type="text"
                value={filters.brand}
                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                className="input"
                placeholder="e.g., Ray-Ban"
              />
            </div>

            {/* Frame Shape */}
            <div className="input-group">
              <label>Frame Shape</label>
              <select
                value={filters.frameShape}
                onChange={(e) => setFilters({ ...filters, frameShape: e.target.value })}
                className="input"
              >
                <option value="">All Shapes</option>
                {frameShapes.map(shape => (
                  <option key={shape} value={shape}>{shape}</option>
                ))}
              </select>
            </div>

            {/* Frame Type */}
            <div className="input-group">
              <label>Frame Type</label>
              <select
                value={filters.frameType}
                onChange={(e) => setFilters({ ...filters, frameType: e.target.value })}
                className="input"
              >
                <option value="">All Types</option>
                {frameTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Material */}
            <div className="input-group">
              <label>Material</label>
              <select
                value={filters.frameMaterial}
                onChange={(e) => setFilters({ ...filters, frameMaterial: e.target.value })}
                className="input"
              >
                <option value="">All Materials</option>
                {materials.map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div className="input-group">
              <label>Gender</label>
              <select
                value={filters.gender}
                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                className="input"
              >
                <option value="">All Genders</option>
                {genders.map(gender => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="input-group">
              <label>Color</label>
              <select
                value={filters.color}
                onChange={(e) => setFilters({ ...filters, color: e.target.value })}
                className="input"
              >
                <option value="">All Colors</option>
                {colors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="input-group">
              <label>Min Price (₹)</label>
              <input
                type="number"
                value={filters.priceMin}
                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                className="input"
                placeholder="0"
              />
            </div>

            <div className="input-group">
              <label>Max Price (₹)</label>
              <input
                type="number"
                value={filters.priceMax}
                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                className="input"
                placeholder="10000"
              />
            </div>

            {/* Rating */}
            <div className="input-group">
              <label>Min Rating</label>
              <select
                value={filters.rating}
                onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
                className="input"
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
                <option value="1">1+ Star</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={applyFilters} className="btn btn-primary">
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn-outline">
                Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AdvancedSearch;
