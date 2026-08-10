import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiToggleLeft, FiToggleRight, FiAlertCircle } from 'react-icons/fi';
import { saleEvents } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'sunglasses', label: 'Sunglasses' },
  { value: 'eyeglasses', label: 'Eyeglasses' },
  { value: 'contact-lenses', label: 'Contact Lenses' },
  { value: 'reading-glasses', label: 'Reading Glasses' },
  { value: 'sports', label: 'Sports' },
  { value: 'kids', label: 'Kids' },
  { value: 'all', label: 'All Categories' },
];

const SaleEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categories: [],
    discount: '',
    startDate: '',
    endDate: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const res = await saleEvents.getAll();
      // Handle different response structures
      const eventData = res.data?.events || res.data?.data || res.data || [];
      setEvents(Array.isArray(eventData) ? eventData : []);
    } catch (err) {
      console.error('Failed to fetch sale events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingEvent(null);
    setFormData({ name: '', description: '', categories: [], discount: '', startDate: '', endDate: '' });
    setShowForm(true);
  };

  const openEditForm = (event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description || '',
      categories: event.categories || [],
      discount: event.discount || '',
      startDate: event.startDate ? event.startDate.split('T')[0] : '',
      endDate: event.endDate ? event.endDate.split('T')[0] : '',
    });
    setShowForm(true);
  };

  const handleCategoryToggle = (cat) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.discount || !formData.startDate || !formData.endDate) {
      toast.error('Fill all required fields');
      return;
    }
    if (formData.categories.length === 0) {
      toast.error('Select at least one category');
      return;
    }
    const discountNum = Number(formData.discount);
    if (discountNum < 1 || discountNum > 90) {
      toast.error('Discount must be between 1 and 90');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        categories: formData.categories,
        discount: discountNum,
        startDate: formData.startDate,
        endDate: formData.endDate,
      };

      if (editingEvent) {
        await saleEvents.update(editingEvent._id, payload);
        toast.success('Event updated');
      } else {
        await saleEvents.create(payload);
        toast.success('Event created');
      }
      setShowForm(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save event');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sale event?')) return;
    try {
      await saleEvents.delete(id);
      toast.success('Event deleted');
      fetchEvents();
    } catch (err) {
      toast.error('Failed to delete event');
    }
  };

  const handleToggle = async (id) => {
    try {
      await saleEvents.toggle(id);
      toast.success('Event status updated');
      fetchEvents();
    } catch (err) {
      toast.error('Failed to toggle event');
    }
  };

  const activeEvents = events.filter((e) => e.isActive);
  const now = new Date();

  const getStatus = (event) => {
    if (!event.isActive) return { label: 'Inactive', color: '#999' };
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (now < start) return { label: 'Upcoming', color: '#ff9f00' };
    if (now > end) return { label: 'Ended', color: '#999' };
    return { label: 'Active', color: '#26a541' };
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Sale Events</h1>
            <button onClick={openCreateForm} className="btn btn-primary"><FiPlus /> Create Sale Event</button>
          </div>

          {activeEvents.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #2874f0, #1a5dc7)', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <FiAlertCircle size={18} />
                <span style={{ fontWeight: 700, fontSize: '15px' }}>Active Sale Events</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {activeEvents.map((e) => (
                  <span key={e._id} style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }}>
                    {e.name} — {e.discount}% OFF
                  </span>
                ))}
              </div>
            </div>
          )}

          {showForm && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
              <div className="card" style={{ padding: '24px', maxWidth: '520px', width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
                <button onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                  <FiX size={20} />
                </button>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editingEvent ? 'Edit Sale Event' : 'Create Sale Event'}</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="input-group">
                    <label>Event Name *</label>
                    <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Summer Sale 2026" />
                  </div>

                  <div className="input-group">
                    <label>Description</label>
                    <textarea className="input" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description..." />
                  </div>

                  <div className="input-group">
                    <label>Categories *</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {CATEGORIES.map((cat) => (
                        <label key={cat.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: formData.categories.includes(cat.value) ? 'var(--primary-light)' : 'transparent' }}>
                          <input
                            type="checkbox"
                            checked={formData.categories.includes(cat.value)}
                            onChange={() => handleCategoryToggle(cat.value)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Discount Percentage (1-90) *</label>
                    <input className="input" type="number" min="1" max="90" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} placeholder="e.g. 30" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-group">
                      <label>Start Date *</label>
                      <input className="input" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                    </div>
                    <div className="input-group">
                      <label>End Date *</label>
                      <input className="input" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button onClick={handleSave} className="btn btn-primary" disabled={formLoading}>
                      {formLoading ? 'Saving...' : editingEvent ? 'Update' : 'Create'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <h3>No sale events yet</h3>
              <p>Create your first sale event to get started</p>
            </div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                    {['Event Name', 'Categories', 'Discount', 'Start Date', 'End Date', 'Status', 'Products', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const status = getStatus(event);
                    return (
                      <tr key={event._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>{event.name}</div>
                          {event.description && <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>{event.description}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(event.categories || []).map((cat) => (
                              <span key={cat} style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '11px', padding: '2px 8px', borderRadius: '3px', textTransform: 'capitalize' }}>{cat}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>{event.discount}%</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{new Date(event.startDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{new Date(event.endDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: status.color, color: '#fff', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '3px' }}>{status.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{event.affectedProducts ?? '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button onClick={() => handleToggle(event._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: event.isActive ? 'var(--primary)' : 'var(--text-light)' }} title={event.isActive ? 'Deactivate' : 'Activate'}>
                              {event.isActive ? <FiToggleRight size={22} /> : <FiToggleLeft size={22} />}
                            </button>
                            <button onClick={() => openEditForm(event)} className="btn btn-outline btn-sm"><FiEdit2 size={12} /></button>
                            <button onClick={() => handleDelete(event._id)} className="btn btn-danger btn-sm"><FiTrash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

export default SaleEvents;
