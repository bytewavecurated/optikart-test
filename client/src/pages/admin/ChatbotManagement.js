import React, { useState, useEffect } from 'react';
import { FiEdit2, FiSave, FiX, FiPlus, FiMessageCircle } from 'react-icons/fi';
import { chatbot } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const ChatbotManagement = () => {
  const [knowledgeBase, setKnowledgeBase] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  const fetchKnowledgeBase = async () => {
    try {
      const res = await chatbot.getKnowledgeBase();
      setKnowledgeBase(res.data.data || {});
    } catch (err) {
      console.error(err);
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category, key, currentValue) => {
    setEditingCell({ category, key });
    setEditValue(currentValue);
  };

  const handleSave = async () => {
    if (!editingCell) return;
    
    try {
      await chatbot.updateKnowledgeBase({
        category: editingCell.category,
        key: editingCell.key,
        value: editValue
      });
      
      // Update local state
      setKnowledgeBase(prev => ({
        ...prev,
        [editingCell.category]: {
          ...prev[editingCell.category],
          [editingCell.key]: editValue
        }
      }));
      
      toast.success('Knowledge base updated');
      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      toast.error('Failed to update knowledge base');
    }
  };

  const handleCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const categories = ['products', 'policies', 'services', 'faq'];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner spinner-lg" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <FiMessageCircle size={28} style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Chatbot Knowledge Base</h1>
          </div>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Manage the chatbot's responses by editing the knowledge base below. Changes will be reflected immediately.
          </p>

          {categories.map(category => (
            <div key={category} className="card" style={{ marginBottom: '24px' }}>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: 600, 
                marginBottom: '16px', 
                textTransform: 'capitalize',
                color: 'var(--text-primary)',
                borderBottom: '2px solid var(--primary)',
                paddingBottom: '8px'
              }}>
                {category}
              </h2>
              
              <div style={{ display: 'grid', gap: '12px' }}>
                {knowledgeBase[category] && Object.entries(knowledgeBase[category]).map(([key, value]) => (
                  <div key={key} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '200px 1fr auto', 
                    gap: '16px', 
                    alignItems: 'start',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: 600, 
                      color: 'var(--text-secondary)',
                      textTransform: 'capitalize'
                    }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    
                    {editingCell?.category === category && editingCell?.key === key ? (
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid var(--primary)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          resize: 'vertical',
                          minHeight: '60px'
                        }}
                        autoFocus
                      />
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        {value}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {editingCell?.category === category && editingCell?.key === key ? (
                        <>
                          <button 
                            onClick={handleSave}
                            className="btn btn-success btn-sm"
                            title="Save"
                          >
                            <FiSave size={14} />
                          </button>
                          <button 
                            onClick={handleCancel}
                            className="btn btn-outline btn-sm"
                            title="Cancel"
                          >
                            <FiX size={14} />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleEdit(category, key, value)}
                          className="btn btn-outline btn-sm"
                          title="Edit"
                        >
                          <FiEdit2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card" style={{ background: 'var(--primary-light)', border: '2px solid var(--primary)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--primary)' }}>
              💡 Tips for Editing Knowledge Base
            </h3>
            <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
              <li>Keep responses concise and helpful</li>
              <li>Use proper grammar and punctuation</li>
              <li>Include relevant keywords for better matching</li>
              <li>Test the chatbot after making changes</li>
              <li>Changes are saved immediately</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChatbotManagement;
