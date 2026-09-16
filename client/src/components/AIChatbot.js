import React, { useState, useRef, useEffect } from 'react';
import { FiMessageSquare, FiX, FiSend, FiUser, FiMessageCircle } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm OptiKart AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { user, seller, isAuthenticated } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // Simulate AI response
    setTimeout(() => {
      let botResponse = "I'd be happy to help you with that! ";
      
      if (!isAuthenticated) {
        botResponse += "For more personalized assistance, please login or sign up. ";
      }

      if (inputMessage.toLowerCase().includes('order')) {
        botResponse += "You can track your orders in the 'My Orders' section. ";
      } else if (inputMessage.toLowerCase().includes('product')) {
        botResponse += "We have a wide range of eyewear products. You can browse by category or use our search feature. ";
      } else if (inputMessage.toLowerCase().includes('return')) {
        botResponse += "Our return policy allows returns within 7 days of delivery. Please check the Return Policy page for details. ";
      } else if (inputMessage.toLowerCase().includes('payment')) {
        botResponse += "We accept all major payment methods including credit/debit cards, UPI, and net banking. ";
      } else if (inputMessage.toLowerCase().includes('shipping')) {
        botResponse += "Shipping is free for orders above ₹500. Standard delivery takes 3-5 business days. ";
      } else {
        botResponse += "Is there anything specific you'd like to know about our products or services?";
      }

      const botMessage = {
        id: messages.length + 2,
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isOpen ? <FiX size={24} /> : <FiMessageSquare size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '380px',
            height: '500px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 998,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <FiMessageCircle size={24} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>OptiKart AI Assistant</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {isAuthenticated ? 'Online' : 'Login for personalized help'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  flexDirection: message.sender === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: message.sender === 'user' ? 'var(--secondary)' : 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {message.sender === 'user' ? <FiUser size={16} /> : <FiMessageCircle size={16} />}
                </div>
                <div
                  style={{
                    background: message.sender === 'user' ? 'var(--primary-light)' : '#f5f5f5',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    maxWidth: '70%',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '8px'
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: inputMessage.trim() ? 'var(--primary)' : 'var(--border)',
                color: '#fff',
                border: 'none',
                cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FiSend size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatbot;
