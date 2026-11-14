import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiSearch, FiFilter, FiGrid, FiList } from 'react-icons/fi';
import { products } from '../services/api';
import { useUserBehavior } from '../contexts/UserBehaviorContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { listOf } from '../services/apiResponse.js';

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  // Filters arriving from the gender picker and the category rails.
  const genderParam = searchParams.get('gender') || '';
  const categoryParam = searchParams.get('category') || '';
  const brandParam = searchParams.get('brand') || '';
  const shapeParam = searchParams.get('frameShape') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('popularity');
  const [priceRange, setPriceRange] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  /*
   * Facets for the controls below. They come from the server's scoped facet
   * endpoint rather than a list typed into this file, for two reasons: a
   * hand-copied taxonomy had already drifted once in this project (the brand
   * facet existed for contact lenses and solution but was missing from every
   * eyewear list, so the control rendered nothing on the biggest categories),
   * and an option that cannot return a product is not a filter - it is a dead
   * end the shopper has to discover.
   */
  const [facets, setFacets] = useState({ brands: [], categories: [], frameShapes: [], frameTypes: [], materials: [], genders: [], frameColors: [] });
  const { addSearchQuery } = useUserBehavior();

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      
      // Track search query
      if (query) {
        addSearchQuery(query);
      }
      
      try {
        // The API's text-search parameter is `search`, not `q`.
        const params = { sort, limit: 48 };
        if (query) params.search = query;
        if (genderParam) params.gender = genderParam;
        if (categoryParam) params.category = categoryParam;
        if (brandParam) params.brand = brandParam;
        if (shapeParam) params.frameShape = shapeParam;
        if (searchParams.get('frameType')) params.frameType = searchParams.get('frameType');
        if (searchParams.get('material')) params.material = searchParams.get('material');
        if (searchParams.get('frameColor')) params.frameColor = searchParams.get('frameColor');
        if (priceRange !== 'all') {
          const [min, max] = priceRange.split('-').map(Number);
          if (min) params.minPrice = min;
          if (max) params.maxPrice = max;
        }
        const res = await products.getAll(params);
        setResults(listOf(res.data));
        setTotal(res.data.pagination?.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, sort, priceRange, genderParam, categoryParam, brandParam, shapeParam]);

  useEffect(() => {
    let cancelled = false;
    const facetParams = {
      ...(categoryParam ? { category: categoryParam } : {}),
      ...(genderParam ? { gender: genderParam } : {}),
      ...(brandParam ? { brand: brandParam } : {}),
      ...(shapeParam ? { frameShape: shapeParam } : {})
    };
    products.getFilters(facetParams)
      .then((res) => {
        if (!cancelled && res.data?.filters) setFacets((prev) => ({ ...prev, ...res.data.filters }));
      })
      .catch(() => { /* the controls are unavailable; the search results are not */ });
    return () => { cancelled = true; };
  }, [categoryParam, genderParam, brandParam, shapeParam]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 600 }}>
                {query ? `Search results for "${query}"` : 'All Products'}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>{total} products found</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="input" style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}>
                <option value="relevance">Relevance</option>
                <option value="priceLow">Price: Low to High</option>
                <option value="priceHigh">Price: High to Low</option>
                <option value="newest">Newest First</option>
                <option value="rating">Top Rated</option>
                <option value="popularity">Popularity</option>
              </select>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '8px', background: viewMode === 'grid' ? 'var(--primary-light)' : 'var(--bg-white)', borderRadius: 'var(--radius-xs)', border: `1px solid ${viewMode === 'grid' ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer' }}><FiGrid size={16} /></button>
                <button onClick={() => setViewMode('list')} style={{ padding: '8px', background: viewMode === 'list' ? 'var(--primary-light)' : 'var(--bg-white)', borderRadius: 'var(--radius-xs)', border: `1px solid ${viewMode === 'list' ? 'var(--primary)' : 'var(--border)'}`, cursor: 'pointer' }}><FiList size={16} /></button>
              </div>
            </div>
          </div>

          {/*
           * Facet controls. Every choice is written into the URL, so the
           * browser's Back returns to the previous set of filters instead of
           * leaving the page, and a filtered view can be shared or reloaded -
           * neither of which holds when filters live only in component state.
           */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            {[
              { key: 'category', label: 'Category', value: categoryParam, options: facets.categories },
              { key: 'brand', label: 'Brand', value: brandParam, options: facets.brands },
              { key: 'gender', label: 'Gender', value: genderParam, options: facets.genders },
              { key: 'frameShape', label: 'Face shape', value: shapeParam, options: facets.frameShapes },
              { key: 'frameType', label: 'Frame type', value: searchParams.get('frameType') || '', options: facets.frameTypes },
              { key: 'material', label: 'Material', value: searchParams.get('material') || '', options: facets.materials },
              { key: 'frameColor', label: 'Colour', value: searchParams.get('frameColor') || '', options: facets.frameColors }
            ].filter((group) => group.options && group.options.length > 1).map((group) => (
              <label key={group.key} style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {group.label}
                <select
                  className="input"
                  style={{ minWidth: 128, marginTop: 3 }}
                  value={group.value}
                  onChange={(e) => {
                    const next = new URLSearchParams(searchParams);
                    if (e.target.value) next.set(group.key, e.target.value);
                    else next.delete(group.key);
                    setSearchParams(next, { replace: false });
                  }}
                >
                  <option value="">Any</option>
                  {group.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
            ))}
            {(categoryParam || brandParam || genderParam || shapeParam || searchParams.get('frameType') || searchParams.get('material') || searchParams.get('frameColor')) && (
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  ['category', 'brand', 'gender', 'frameShape', 'frameType', 'material', 'frameColor'].forEach((k) => next.delete(k));
                  setSearchParams(next, { replace: false });
                }}
                className="btn btn-quiet"
                style={{ padding: '8px 12px', fontSize: 12.5 }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[{ label: 'All Prices', value: 'all' }, { label: 'Under ₹500', value: '0-500' }, { label: '₹500 - ₹1000', value: '500-1000' }, { label: '₹1000 - ₹2000', value: '1000-2000' }, { label: 'Above ₹2000', value: '2000-99999' }].map((range) => (
              <button key={range.value} onClick={() => setPriceRange(range.value)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-xl)', fontSize: '13px', border: `1px solid ${priceRange === range.value ? 'var(--primary)' : 'var(--border)'}`, background: priceRange === range.value ? 'var(--primary-light)' : 'var(--bg-white)', color: priceRange === range.value ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                {range.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card" style={{ height: '280px' }}>
                  <div className="skeleton" style={{ height: '200px' }} />
                  <div style={{ padding: '12px' }}><div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} /><div className="skeleton" style={{ height: '14px', width: '50%' }} /></div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <FiSearch style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>No products found</h3>
              <p>Try adjusting your search or filters</p>
              <Link to="/" className="btn btn-primary">Browse All Products</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : '1fr', gap: '16px' }}>
              {results.map((product) => (
                <ProductCard key={product._id} product={product} listView={viewMode === 'list'} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchResults;
