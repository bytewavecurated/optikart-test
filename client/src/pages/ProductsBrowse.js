import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { FiFilter, FiX, FiChevronDown } from 'react-icons/fi';
import { products } from '../services/api';
import { listOf } from '../services/apiResponse.js';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { resolveCategory, facetsForCategory, fixedFiltersFor, PRICE_RANGES } from '../utils/catalogTaxonomy';

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Customer Rating' },
  { value: 'discount', label: 'Discount' }
];

const PRICE_BANDS = PRICE_RANGES;


const chipStyle = (active) => ({
  display: 'block', padding: '9px 14px', borderRadius: '999px', fontSize: '13px',
  fontWeight: 600, textDecoration: 'none', border: '1px solid',
  borderColor: active ? 'var(--primary)' : 'var(--border)',
  background: active ? 'var(--primary-light)' : 'var(--bg-white)',
  color: active ? 'var(--primary-dark)' : 'var(--text-primary)'
});

export default function ProductsBrowse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { category: categorySlug } = useParams();
  const [items, setItems] = useState([]);
  // A facet call that fails must not leave last visit's options on screen
  // looking current; the panel says what happened instead.
  const [facetError, setFacetError] = useState(false);
  const [facets, setFacets] = useState({ brands: [], frameShapes: [], frameTypes: [], materials: [], genders: [], frameSizes: [], frameColors: [] });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const brand = searchParams.get('brand') || '';
  const sellerCode = searchParams.get('sellerCode') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'popularity';
  const priceBand = searchParams.get('price') || '';

  // Every facet in the URL is read generically so links from the home page work.
  // One descriptor drives the headline, the filters and the fixed constraints,
  // so a powered-sunglasses list can never show rim-type facets meant for frames.
  const descriptor = useMemo(() => resolveCategory(categorySlug || searchParams.get('category') || ''), [categorySlug, searchParams]);
  const facetGroups = useMemo(() => facetsForCategory(descriptor), [descriptor]);
  const fixedFilters = useMemo(() => fixedFiltersFor(descriptor), [descriptor]);

  const facetValues = useMemo(() => {
    const out = {};
    facetGroups.forEach((f) => { out[f.key] = searchParams.get(f.key) || ''; });
    return out;
  }, [searchParams, facetGroups]);

  /*
   * Facets are refetched with the shopper's current selection.
   *
   * They used to be fetched once, unscoped, on mount - so the brand row listed
   * every brand on the site whatever the category, and tapping one that sells
   * nothing here returned "no products" with a filter chip that looked like the
   * shopper's mistake. The endpoint now counts each facet with the OTHER chosen
   * filters applied, which is what makes the list both accurate and still
   * changeable: choose a brand and the material row narrows, while brand keeps
   * its other options so the choice can be revised.
   */
  useEffect(() => {
    let cancelled = false;
    const fetchFacets = async () => {
      try {
        const res = await products.getFilters({
          ...(category ? { category } : {}),
          ...(brand ? { brand } : {}),
          ...Object.fromEntries(Object.entries(facetValues).filter(([k, v]) => v && k !== 'brand')),
          ...(priceBand && priceBand.includes('-')
            ? { minPrice: priceBand.split('-')[0], maxPrice: priceBand.split('-')[1] }
            : {})
        });
        if (!cancelled && res.data?.filters) {
          setFacets((prev) => ({ ...prev, ...res.data.filters }));
          setFacetError(false);
        }
      } catch (err) {
        console.error('Filters fetch error:', err);
        if (!cancelled) setFacetError(true);
      }
    };
    fetchFacets();
    return () => { cancelled = true; };
  }, [category, brand, facetValues, priceBand]);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      setLoading(true);
      const params = { page, limit: 24, sort };
      if (brand) params.brand = brand;
      if (sellerCode) params.sellerCode = sellerCode;
      if (category && !descriptor?.category) params.category = category;
      if (descriptor?.category) params.category = descriptor.category;
      Object.entries(fixedFilters).forEach(([k, v]) => { params[k] = v; });
      if (searchParams.get('powered') === 'true') params.powered = 'true';
      facetGroups.forEach((f) => {
        if (facetValues[f.key]) params[f.key] = facetValues[f.key];
      });
      if (priceBand) {
        const band = PRICE_BANDS.find((b) => b.label === priceBand);
        if (band) {
          if (band.min) params.minPrice = band.min;
          if (band.max) params.maxPrice = band.max;
        }
      }
      try {
        const res = await products.getAll(params);
        if (cancelled) return;
        setItems(listOf(res.data));
        setTotal(res.data.pagination?.total || 0);
      } catch (err) {
        console.error('Products fetch error:', err);
        if (!cancelled) { setItems([]); setTotal(0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProducts();
    setPage(1);
    return () => { cancelled = true; };
  }, [brand, category, sort, priceBand, facetValues, sellerCode, descriptor, fixedFilters, facetGroups, searchParams]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const clearAll = () => {
    const keep = new URLSearchParams();
    if (category) keep.set('category', category);
    if (sellerCode) keep.set('sellerCode', sellerCode);
    setSearchParams(keep);
  };

  const activeCount = [brand, ...Object.values(facetValues), priceBand].filter(Boolean).length;

  /*
   * The descriptor already carries the display name the taxonomy was built from,
   * so /category/sports-eyewear headlines as "Sports Eyewear" instead of the slug
   * with a hardcoded " Glasses" suffix bolted on.
   */
  const heading = (() => {
    if (descriptor?.label || descriptor?.name) return descriptor.label || descriptor.name;
    const raw = category || categorySlug;
    if (raw) return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return brand || (sellerCode ? 'Seller Store' : 'All Products');
  })();

  const filterPanel = (
    <div style={{ display: 'grid', gap: 22 }}>
      {brand && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>Brand</div>
          <button onClick={() => updateParam('brand', '')} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 13 }}>
            {brand} <FiX size={14} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          </button>
        </div>
      )}

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Price</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {PRICE_BANDS.map((b) => (
            <label key={b.label} style={{ fontSize: 14, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="priceband" checked={priceBand === b.label} onChange={() => updateParam('price', priceBand === b.label ? '' : b.label)} />
              {b.label}
            </label>
          ))}
        </div>
      </div>

      {facetGroups.map((group) => {
        // Dynamic facets read their values from the live facet response;
        // fixed facets (correction type, age band, bottle size) are declared.
        const options = group.optionsKey ? (facets[group.optionsKey] || []) : (group.values || []).map((o) => (typeof o === 'string' ? o : o.v));
        /*
         * A brand list is the one facet long enough to need structure: 20+ names
         * in a wrapping row is a hunt, and grouped under their initial letter it
         * is a scan. The grouping comes from the server's scoped list, so the
         * letters shown only ever contain brands that can actually be bought with
         * the filters already applied.
         */
        // Brand is the one facet long enough to need an index: 20+ names in a
        // wrapping row is a hunt, grouped under their initial it is a scan. The
        // grouping comes from the server's scoped list, so a letter only appears
        // when a brand under it can actually be bought with the filters applied.
        const letters = group.optionsKey === 'brands'
          ? Object.entries(facets.brandsByLetter || {}).filter(([, list]) => list && list.length)
          : null;
        if (!options.length) return null;

        const chip = (opt) => (
          <Link
            key={`${group.key}-${opt}`}
            to="?"
            onClick={(e) => {
              e.preventDefault();
              updateParam(group.key, facetValues[group.key] === opt ? '' : opt);
            }}
            style={chipStyle(facetValues[group.key] === opt)}
          >
            {opt}
          </Link>
        );

        return (
          <div key={group.key}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(letters
                ? letters.flatMap(([letter, list]) => [
                    <span
                      key={`letter-${letter}`}
                      style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-light)', letterSpacing: '.5px', minWidth: 10 }}
                    >
                      {letter}
                    </span>,
                    ...list.map((opt) => chip(opt))
                  ])
                : options.map(chip))}
            </div>
          </div>
        );
      })}

      {activeCount > 0 && (
        <button onClick={clearAll} className="btn btn-outline" style={{ justifyContent: 'center' }}>
          Clear All Filters
        </button>
      )}
      <style>{`@media (min-width: 901px) { .browse-filters-mobile { display: none !important; } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <Header />
      <main style={{ flex: 1 }} className="container" >
        <div style={{ padding: '18px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Home</Link>
          {' / '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{heading}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{heading}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {loading ? 'Loading products...' : `${total} product${total === 1 ? '' : 's'} found`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowFilters((v) => !v)} className="btn btn-outline browse-filter-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FiFilter size={16} /> Filters {activeCount > 0 ? `(${activeCount})` : ''}
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sort</span>
              <select
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="input"
                style={{ width: 'auto', padding: '8px 12px', fontSize: 14 }}
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="browse-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
          <aside className="browse-filters card card-pad" style={{ position: 'sticky', top: 90 }}>
            {filterPanel}
          </aside>

          <section>
            {showFilters && (
              <div className="card browse-filters-mobile" style={{ padding: 20, marginBottom: 18 }}>{filterPanel}</div>
            )}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ height: 320, borderRadius: 'var(--radius)', background: 'var(--border-light)' }} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                <h3 style={{ marginBottom: 8 }}>No products match these filters</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 18 }}>Try removing a filter or two to widen the results.</p>
                <button onClick={clearAll} className="btn btn-primary">Clear Filters</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                  {items.map((product) => <ProductCard key={product._id} product={product} />)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 32 }}>
                  <button className="btn btn-outline" disabled={page <= 1} onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo(0, 0); }}>Previous</button>
                  <span style={{ padding: '10px 14px', fontSize: 14 }}>Page {page}</span>
                  <button className="btn btn-outline" disabled={items.length < 24} onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}>Next</button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 900px) {
          .browse-layout { grid-template-columns: 1fr !important; }
          .browse-filters { display: none !important; }
        }
        @media (min-width: 901px) {
          .browse-filters-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
