import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiTrendingUp, FiClock, FiChevronRight } from 'react-icons/fi';

const TRENDING = [
  'Ray-Ban Aviator',
  'Blue cut glasses',
  'Contact lenses monthly',
  'Kids sunglasses',
  'Polarized sunglasses',
  'Computer glasses',
];

const STYLES = {
  wrapper: {
    position: 'relative',
    width: '100%',
    fontFamily: "'Roboto', sans-serif",
  },
  form: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  icon: {
    position: 'absolute',
    left: '12px',
    color: '#2874f0',
    fontSize: '18px',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '10px 40px 10px 40px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  inputFocused: {
    borderColor: '#2874f0',
    boxShadow: '0 0 0 2px rgba(40,116,240,0.15)',
  },
  clearBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#fff',
    borderRadius: '0 0 4px 4px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    maxHeight: '400px',
    overflowY: 'auto',
    marginTop: '2px',
  },
  section: {
    padding: '12px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 16px 8px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    textDecoration: 'none',
    color: '#333',
    fontSize: '14px',
  },
  itemIcon: {
    color: '#888',
    fontSize: '16px',
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
  },
  itemHighlight: {
    fontWeight: 600,
    color: '#2874f0',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#ccc',
    cursor: 'pointer',
    padding: '2px',
    fontSize: '14px',
  },
  categoryTag: {
    fontSize: '11px',
    color: '#888',
    background: '#f1f3f6',
    padding: '2px 8px',
    borderRadius: '3px',
  },
  footer: {
    padding: '12px 16px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#2874f0',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
};

export default function SearchBar({ placeholder = 'Search for eyewear, brands and more' }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('recentSearches') || '[]');
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const mockSuggestions = [
        { text: `${query} sunglasses`, category: 'Sunglasses' },
        { text: `${query} eyeglasses`, category: 'Eyeglasses' },
        { text: `${query} men`, category: 'Men' },
        { text: `${query} women`, category: 'Women' },
        { text: `${query} blue cut`, category: 'Lenses' },
      ].filter(s => s.text.toLowerCase().includes(query.toLowerCase()));
      setSuggestions(mockSuggestions);
      setLoading(false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setFocused(false);
    }
  };

  const handleItemClick = (text) => {
    setQuery(text);
    const updated = [text, ...recentSearches.filter(s => s !== text)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
    navigate(`/search?q=${encodeURIComponent(text)}`);
    setFocused(false);
  };

  const removeRecent = (e, term) => {
    e.stopPropagation();
    setRecentSearches(recentSearches.filter(s => s !== term));
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches.filter(s => s !== term)));
  };

  const showDropdown = focused && (query || recentSearches.length > 0);

  return (
    <div style={STYLES.wrapper} ref={wrapperRef}>
      <form onSubmit={handleSubmit} style={STYLES.form}>
        <FiSearch style={STYLES.icon} />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          style={{
            ...STYLES.input,
            ...(focused ? STYLES.inputFocused : {}),
          }}
        />
        {query && (
          <button
            type="button"
            style={STYLES.clearBtn}
            onClick={() => { setQuery(''); setFocused(true); }}
          >
            <FiX />
          </button>
        )}
      </form>

      {showDropdown && (
        <div style={STYLES.dropdown}>
          {query && suggestions.length > 0 && (
            <div style={STYLES.section}>
              <div style={STYLES.sectionTitle}>
                <FiTrendingUp /> Suggestions
              </div>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  style={STYLES.item}
                  className="search-item"
                  onClick={() => handleItemClick(s.text)}
                >
                  <FiSearch style={STYLES.itemIcon} />
                  <span style={STYLES.itemText}>
                    <span style={STYLES.itemHighlight}>{s.text.split(' ')[0]}</span>
                    {' '}{s.text.split(' ').slice(1).join(' ')}
                  </span>
                  <span style={STYLES.categoryTag}>{s.category}</span>
                </div>
              ))}
            </div>
          )}

          {!query && recentSearches.length > 0 && (
            <div style={STYLES.section}>
              <div style={STYLES.sectionTitle}>
                <FiClock /> Recent Searches
              </div>
              {recentSearches.map((term, i) => (
                <div
                  key={i}
                  style={STYLES.item}
                  className="search-item"
                  onClick={() => handleItemClick(term)}
                >
                  <FiClock style={STYLES.itemIcon} />
                  <span style={STYLES.itemText}>{term}</span>
                  <button
                    style={STYLES.removeBtn}
                    onClick={(e) => removeRecent(e, term)}
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div style={STYLES.section}>
              <div style={STYLES.sectionTitle}>
                <FiTrendingUp /> Trending
              </div>
              {TRENDING.map((term, i) => (
                <div
                  key={i}
                  style={STYLES.item}
                  className="search-item"
                  onClick={() => handleItemClick(term)}
                >
                  <FiTrendingUp style={STYLES.itemIcon} />
                  <span style={STYLES.itemText}>{term}</span>
                </div>
              ))}
            </div>
          )}

          {query && (
            <div
              style={STYLES.footer}
              onClick={handleSubmit}
            >
              Search for "{query}" <FiChevronRight />
            </div>
          )}
        </div>
      )}

      <style>{`
        .search-item:hover { background: #f5f8ff !important; }
      `}</style>
    </div>
  );
}
