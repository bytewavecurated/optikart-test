import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { blog as blogApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const BlogManagement = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ title: '', slug: '', excerpt: '', content: '', category: '', coverImage: '' });

  useEffect(() => { fetchPosts(); }, []);
  const fetchPosts = async () => {
    try { const res = await blogApi.getAll(); setPosts(res.data.data || []); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) { toast.error('Fill required fields'); return; }
    try {
      if (editing) { await blogApi.update(editing._id, formData); toast.success('Updated'); }
      else { await blogApi.create(formData); toast.success('Created'); }
      setShowForm(false); setEditing(null); setFormData({ title: '', slug: '', excerpt: '', content: '', category: '', coverImage: '' }); fetchPosts();
    } catch (err) { toast.error('Failed'); }
  };

  const handleEdit = (post) => {
    setEditing(post);
    setFormData({ title: post.title, slug: post.slug, excerpt: post.excerpt || '', content: post.content, category: post.category || '', coverImage: post.coverImage || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try { await blogApi.delete(id); toast.success('Deleted'); fetchPosts(); } catch (err) { toast.error('Failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Blog Management ({posts.length})</h1>
            <button onClick={() => { setShowForm(true); setEditing(null); setFormData({ title: '', slug: '', excerpt: '', content: '', category: '', coverImage: '' }); }} className="btn btn-primary"><FiPlus /> New Post</button>
          </div>
          {showForm && (
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editing ? 'Edit' : 'New'} Post</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group"><label>Title *</label><input className="input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
                <div className="input-group"><label>Slug</label><input className="input" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="auto-generated if empty" /></div>
                <div className="input-group"><label>Category</label><input className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} /></div>
                <div className="input-group"><label>Cover Image URL</label><input className="input" value={formData.coverImage} onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })} /></div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Excerpt</label><textarea className="input" rows={2} value={formData.excerpt} onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} /></div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Content * (HTML)</label><textarea className="input" rows={8} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={handleSave} className="btn btn-primary">{editing ? 'Update' : 'Publish'}</button>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Title', 'Category', 'Likes', 'Comments', 'Date', 'Actions'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{post.title}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{post.category || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{post.likes || 0}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{post.comments?.length || 0}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{new Date(post.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px' }}><div style={{ display: 'flex', gap: '6px' }}><button onClick={() => handleEdit(post)} className="btn btn-outline btn-sm"><FiEdit2 size={12} /></button><button onClick={() => handleDelete(post._id)} className="btn btn-danger btn-sm"><FiTrash2 size={12} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogManagement;
