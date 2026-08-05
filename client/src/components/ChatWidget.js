import React, { useState, useRef, useEffect } from 'react';
import { FiMessageCircle, FiX, FiSend, FiChevronRight, FiHelpCircle, FiUser } from 'react-icons/fi';

const USER_FAQS = [
  { q: 'Track my order', a: 'You can track your order from the Orders section in your account.' },
  { q: 'Return policy', a: 'We offer a 30-day easy return policy on all products.' },
  { q: 'Prescription lenses', a: 'Upload your prescription during checkout or after placing the order.' },
  { q: 'Payment options', a: 'We accept UPI, cards, net banking, wallets, and COD.' },
  { q: 'Shipping time', a: 'Standard delivery takes 5-7 business days. Express: 2-3 days.' },
];

const SELLER_FAQS = [
  { q: 'How to list products', a: 'Go to Seller Dashboard > Products > Add New Product.' },
  { q: 'Payment settlement', a: 'Payments are settled every 7 days to your registered bank account.' },
  { q: 'Order management', a: 'Manage orders from Seller Dashboard > Orders section.' },
  { q: 'Return handling', a: 'Process returns within 48 hours from the Returns tab.' },
];

const styles = {
  fab: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#2874f0',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(40,116,240,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    zIndex: 1200,
    transition: 'all 0.3s',
  },
  fabOpen: {
    background: '#e43f5a',
    transform: 'rotate(0deg)',
  },
  window: {
    position: 'fixed',
    bottom: '90px',
    right: '24px',
    width: '380px',
    height: '520px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1200,
    fontFamily: "'Roboto', sans-serif",
    animation: 'chatSlideUp 0.3s ease',
  },
  chatHeader: {
    background: '#2874f0',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#fff',
  },
  chatTitle: {
    fontSize: '16px',
    fontWeight: 700,
  },
  chatSubtitle: {
    fontSize: '12px',
    opacity: 0.8,
    marginTop: '2px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '4px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: '#f5f7fa',
  },
  message: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  botMessage: {
    alignSelf: 'flex-start',
    background: '#fff',
    color: '#333',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  userMessage: {
    alignSelf: 'flex-end',
    background: '#2874f0',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  quickReplies: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '0 16px 12px',
    background: '#f5f7fa',
  },
  quickReply: {
    padding: '6px 12px',
    border: '1px solid #2874f0',
    borderRadius: '20px',
    background: '#fff',
    color: '#2874f0',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #e0e0e0',
    background: '#fff',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #e0e0e0',
    borderRadius: '24px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  sendBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: '#2874f0',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    background: '#c2c2c2',
    cursor: 'not-allowed',
  },
  typing: {
    display: 'flex',
    gap: '4px',
    padding: '10px 14px',
    alignSelf: 'flex-start',
    background: '#fff',
    borderRadius: '12px',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  typingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#888',
    animation: 'typingBounce 1.4s ease-in-out infinite',
  },
};

export default function ChatWidget({ userRole = 'user' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: userRole === 'seller'
        ? 'Hi! Welcome to OptiKart Seller Support. How can I help you today?'
        : 'Hi! Welcome to OptiKart Help Center. How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const faqs = userRole === 'seller' ? SELLER_FAQS : USER_FAQS;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const addBotResponse = (question) => {
    setTyping(true);
    const faq = faqs.find(f => f.q.toLowerCase() === question.toLowerCase());
    const response = faq
      ? faq.a
      : "I'll connect you with a support agent shortly. In the meantime, you can browse our FAQ section for quick answers.";

    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: response }]);
    }, 1200);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), type: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    addBotResponse(input.trim());
  };

  const handleQuickReply = (q) => {
    const userMsg = { id: Date.now(), type: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    addBotResponse(q);
  };

  return (
    <>
      <button
        style={{
          ...styles.fab,
          ...(open ? styles.fabOpen : {}),
        }}
        onClick={() => setOpen(!open)}
        aria-label="Help chat"
      >
        {open ? <FiX /> : <FiMessageCircle />}
      </button>

      {open && (
        <div style={styles.window} className="chat-window">
          <div style={styles.chatHeader}>
            <div>
              <div style={styles.chatTitle}>
                {userRole === 'seller' ? 'Seller Support' : 'Help Center'}
              </div>
              <div style={styles.chatSubtitle}>We typically reply instantly</div>
            </div>
            <button style={styles.closeBtn} onClick={() => setOpen(false)}>
              <FiX />
            </button>
          </div>

          <div style={styles.messages}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.message,
                  ...(msg.type === 'bot' ? styles.botMessage : styles.userMessage),
                }}
              >
                {msg.text}
              </div>
            ))}
            {typing && (
              <div style={styles.typing}>
                <div style={{ ...styles.typingDot, animationDelay: '0s' }} />
                <div style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
                <div style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.quickReplies}>
            {faqs.slice(0, 4).map((faq) => (
              <button
                key={faq.q}
                style={styles.quickReply}
                onClick={() => handleQuickReply(faq.q)}
                className="quick-reply-btn"
              >
                {faq.q} <FiChevronRight size={12} />
              </button>
            ))}
          </div>

          <div style={styles.inputArea}>
            <input
              type="text"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = '#2874f0'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
            <button
              style={{
                ...styles.sendBtn,
                ...(!input.trim() ? styles.sendBtnDisabled : {}),
              }}
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <FiSend size={16} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .quick-reply-btn:hover {
          background: #2874f0 !important;
          color: #fff !important;
        }
        @media (max-width: 480px) {
          .chat-window {
            width: calc(100vw - 32px) !important;
            right: 16px !important;
            bottom: 80px !important;
            height: 70vh !important;
          }
        }
      `}</style>
    </>
  );
}
