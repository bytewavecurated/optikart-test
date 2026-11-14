import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiFilter } from 'react-icons/fi';
import { products } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';

const CategoryPage = () => {
  const { category } = useParams();
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('popularity');
  const [brands, setBrands] = useState([]);
  /*
   * Brands are the facet most likely to lie: a brand that sells nothing in this
   * category still appeared in the list, and choosing it gave "no products".
   * They now come from the facet endpoint, which computes the brand list with
   * the shopper's other filters applied, already grouped by initial so a long
   * list is scannable instead of scrollable.
   */
  const [brandsByLetter, setBrandsByLetter] = useState({});
  const [facetFailed, setFacetFailed] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { category, sort };
        if (selectedBrands.length > 0) params.brands = selectedBrands.join(',');
        if (priceRange !== 'all') {
          const [min, max] = priceRange.split('-').map(Number);
          if (min) params.minPrice = min;
          if (max) params.maxPrice = max;
        }
        const facetParams = {
          category,
          ...(selectedBrands.length ? { brand: selectedBrands[0] } : {}),
          ...(priceRange !== 'all' ? { minPrice: priceRange.split('-')[0], maxPrice: priceRange.split('-')[1] } : {})
        };
        const [prodRes, facetRes] = await Promise.all([
          products.getByCategory(category, params),
          products.getFilters(facetParams),
        ]);
        setProductsList(prodRes.data.products || []);
        const list = facetRes?.data?.filters?.brands;
        if (Array.isArray(list)) {
          setBrands(list);
          setBrandsByLetter(facetRes.data.filters.brandsByLetter || {});
          setFacetFailed(false);
        } else {
          // A brand list left over from the previous category is not current
          // data; keep it out of sight rather than offering it as if it were.
          setBrands([]);
          setBrandsByLetter({});
          setFacetFailed(true);
        }
      } catch (err) {
        console.error('Browse failed:', err);
        setBrands([]);
        setBrandsByLetter({});
        setFacetFailed(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [category, sort, selectedBrands, priceRange]);

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const categoryName = category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <nav style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
            <Link to="/" style={{ color: 'var(--primary)' }}>Home</Link> / <span>{categoryName}</span>
          </nav>

          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>{categoryName}</h1>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', alignItems: 'start' }} className="category-grid">
            <div className="card" style={{ padding: '16px', position: 'sticky', top: '80px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><FiFilter size={14} /> Filters</h3>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Sort By</h4>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="input" style={{ fontSize: '13px', padding: '8px' }}>
                  <option value="popularity">Popularity</option>
                  <option value="priceLow">Price: Low to High</option>
                  <option value="priceHigh">Price: High to Low</option>
                  <option value="newest">Newest</option>
                  <option value="rating">Rating</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Price Range</h4>
                {[{ label: 'All', value: 'all' }, { label: 'Under ₹500', value: '0-500' }, { label: '₹500 - ₹1000', value: '500-1000' }, { label: '₹1000 - ₹2000', value: '1000-2000' }, { label: 'Above ₹2000', value: '2000-99999' }].map((r) => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="radio" name="price" value={r.value} checked={priceRange === r.value} onChange={() => setPriceRange(r.value)} style={{ accentColor: 'var(--primary)' }} />
                    {r.label}
                  </label>
                ))}
              </div>

              {brands.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                    Brand
                    <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 11.5, marginLeft: 6 }}>
                      {selectedBrands.length > 0 ? `${selectedBrands.length} selected` : 'available in this category'}
                    </span>
                  </h4>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {Object.entries(brandsByLetter).map(([letter, group]) => (
                      <div key={letter}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '.6px', padding: '6px 0 2px' }}>{letter}</div>
                        {group.map((brand) => (
                          <label key={brand} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} style={{ accentColor: 'var(--primary)' }} />
                            {brand}
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                  {selectedBrands.length > 0 && (
                    <button type="button" onClick={() => setSelectedBrands([])} style={{ marginTop: '6px', background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '12px', cursor: 'pointer' }}>
                      Clear brands
                    </button>
                  )}
                </div>
              )}
              {/*
               * Shown when the brand list came back empty or the facet call
               * failed. Silence here reads as "this category has no brands";
               * the honest message says the filters excluded them all, which is
               * a different problem with a different fix.
               */}
              {brands.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  {facetFailed
                    ? 'The brand list could not be loaded right now. Products below are unfiltered by brand and will update when you reload.'
                    : 'No brands match these filters. Clear the price range or brand selection, or browse another category.'}
                </p>
              )}
            </div>

            <div>
              {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card" style={{ height: '280px' }}><div className="skeleton" style={{ height: '200px' }} /><div style={{ padding: '12px' }}><div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} /><div className="skeleton" style={{ height: '14px', width: '50%' }} /></div></div>
                  ))}
                </div>
              ) : productsList.length === 0 ? (
                <div className="empty-state">
                  <h3>No products in this category</h3>
                  <p>Check back later for new arrivals</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {productsList.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`@media (max-width: 768px) { .category-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default CategoryPage;
