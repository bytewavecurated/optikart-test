import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiHeart, FiSearch, FiX } from 'react-icons/fi';
import { blog } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

const CATEGORIES = ['All', 'Eye Care', 'Style Guide', 'Technology', 'Trends', 'Tips & Tricks', 'News'];
const POSTS_PER_PAGE = 6;

const BlogList = () => {
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await blog.getAll({ limit: 100 });
        setAllPosts(res.data.data || res.data.blogs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const filteredPosts = useMemo(() => {
    let posts = allPosts;
    if (activeCategory !== 'All') {
      posts = posts.filter(p => p.category?.toLowerCase() === activeCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      posts = posts.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return posts;
  }, [allPosts, activeCategory, searchQuery]);

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  useEffect(() => {
    setVisibleCount(POSTS_PER_PAGE);
  }, [searchQuery, activeCategory]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>OptiKart Blog</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>Eye care tips, style guides, and the latest in eyewear technology</p>
          </div>

          <div style={{ position: 'relative', maxWidth: '500px', marginBottom: '20px' }}>
            <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              className="input"
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', paddingRight: searchQuery ? '36px' : '16px' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                <FiX size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: activeCategory === cat ? 'var(--primary)' : 'var(--bg-primary)',
                  color: activeCategory === cat ? '#fff' : 'var(--text-primary)',
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {(searchQuery || activeCategory !== 'All') && (
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>
              {filteredPosts.length} article{filteredPosts.length !== 1 ? 's' : ''} found
              {searchQuery && ` for "${searchQuery}"`}
              {activeCategory !== 'All' && ` in ${activeCategory}`}
            </p>
          )}

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card skeleton" style={{ height: '320px' }} />
              ))}
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <FiSearch style={{ fontSize: '48px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>No articles found</h3>
              <p>{searchQuery ? 'Try a different search term' : 'No articles in this category yet'}</p>
              {(searchQuery || activeCategory !== 'All') && (
                <button onClick={() => { setSearchQuery(''); setActiveCategory('All'); }} className="btn btn-outline" style={{ marginTop: '16px' }}>
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {visiblePosts.map((post) => (
                  <Link key={post._id} to={`/blog/${post.slug}`} className="card" style={{ overflow: 'hidden', transition: 'box-shadow 0.2s', textDecoration: 'none' }}>
                    <div style={{ width: '100%', height: '180px', background: `linear-gradient(135deg, var(--primary), var(--primary-dark, #1a5dc8))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: '32px', fontWeight: 700, opacity: 0.3 }}>{(post.category || 'BLOG').charAt(0)}</span>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', background: 'var(--primary-light, #e3f0ff)', color: 'var(--primary)', marginBottom: '8px', textTransform: 'uppercase' }}>{post.category}</span>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.4, color: 'var(--text-primary)' }}>{post.title}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-light)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiClock size={12} /> {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiHeart size={12} /> {post.likes || 0}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                  <button onClick={() => setVisibleCount(prev => prev + POSTS_PER_PAGE)} className="btn btn-outline" style={{ padding: '10px 32px' }}>
                    See More Articles ({filteredPosts.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogList;
