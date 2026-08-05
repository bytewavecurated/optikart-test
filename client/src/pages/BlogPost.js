import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiClock, FiHeart, FiMessageSquare, FiShare2 } from 'react-icons/fi';
import { blog } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await blog.getBySlug(slug);
        setPost(res.data.data);
      } catch (err) {
        toast.error('Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
    window.scrollTo(0, 0);
  }, [slug]);

  const handleLike = async () => {
    try {
      await blog.like(post._id);
      setPost({ ...post, likes: (post.likes || 0) + 1 });
    } catch (err) {
      toast.error('Failed to like post');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await blog.comment(post._id, { content: comment });
      setComment('');
      toast.success('Comment added');
      const res = await blog.getBySlug(slug);
      setPost(res.data.data);
    } catch (err) {
      toast.error('Failed to add comment');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper" style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner spinner-lg" /></main>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="container page-wrapper">
          <div className="empty-state"><h3>Post not found</h3><Link to="/blog" className="btn btn-primary">Back to Blog</Link></div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <article style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
          <Link to="/blog" style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '16px', display: 'inline-block' }}>Back to Blog</Link>
          <span className="badge badge-primary" style={{ marginBottom: '12px', display: 'inline-block' }}>{post.category}</span>
          <h1 style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.3, marginBottom: '12px' }}>{post.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-light)', marginBottom: '24px' }}>
            <span>By {post.author?.name || 'OptiKart Team'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiClock size={12} /> {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <img src={post.coverImage || '/placeholder-blog.jpg'} alt={post.title} style={{ width: '100%', height: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '24px' }} />
          <div style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: post.content }} />

          <div style={{ display: 'flex', gap: '16px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--primary)', cursor: 'pointer', background: 'none' }}>
              <FiHeart size={16} /> {post.likes || 0} Likes
            </button>
            <button onClick={() => navigator.clipboard.writeText(window.location.href)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', background: 'none' }}>
              <FiShare2 size={16} /> Share
            </button>
          </div>

          <div style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiMessageSquare /> Comments ({post.comments?.length || 0})
            </h3>
            {isAuthenticated && (
              <form onSubmit={handleComment} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment..." style={{ flex: 1 }} />
                <button type="submit" className="btn btn-primary">Post</button>
              </form>
            )}
            {post.comments?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {post.comments.map((c, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{c.userName || 'Anonymous'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{c.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>No comments yet. Be the first to comment!</p>
            )}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
