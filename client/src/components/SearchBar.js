import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiTrendingUp, FiClock, FiChevronRight, FiMic, FiCamera } from 'react-icons/fi';
import toast from 'react-hot-toast';

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
  const [isListening, setIsListening] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

  // Voice search functionality
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice search is not supported in your browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      toast.success('Listening...');
    };

    recognitionRef.current.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      
      // Try to process with backend speech recognition
      try {
        const response = await fetch('http://localhost:5000/api/speech/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.searchQuery) {
            setQuery(data.data.searchQuery);
            navigate(`/search?q=${encodeURIComponent(data.data.searchQuery)}`);
            return;
          }
        }
      } catch (error) {
        console.error('Speech API error:', error);
      }
      
      // Fallback to direct search
      setQuery(transcript);
      navigate(`/search?q=${encodeURIComponent(transcript)}`);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast.error('Voice search failed. Please try again.');
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Camera search functionality
  const startCameraSearch = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
      });
      
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setIsCapturing(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const captureAndAnalyze = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        try {
          const formData = new FormData();
          formData.append('image', blob);

          const response = await fetch('http://localhost:5000/api/face-detection/detect', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();

          if (data.success) {
            stopCameraSearch();
            navigate(`/face-shape-guide?result=${encodeURIComponent(JSON.stringify(data.data))}`);
          } else {
            toast.error(data.message || 'Failed to analyze face');
          }
        } catch (error) {
          console.error('Face detection error:', error);
          toast.error('Failed to analyze face. Please try again.');
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const stopCameraSearch = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
            paddingRight: '100px' // Make room for buttons
          }}
        />
        {query && (
          <button
            type="button"
            style={{...STYLES.clearBtn, right: '70px'}}
            onClick={() => { setQuery(''); setFocused(true); }}
          >
            <FiX />
          </button>
        )}
        
        {/* Voice Search Button */}
        <button
          type="button"
          onClick={isListening ? stopVoiceSearch : startVoiceSearch}
          disabled={isCapturing}
          style={{
            position: 'absolute',
            right: '40px',
            background: isListening ? '#f44336' : 'none',
            border: 'none',
            color: isListening ? '#fff' : '#2874f0',
            cursor: isCapturing ? 'not-allowed' : 'pointer',
            fontSize: '18px',
            padding: '8px',
            borderRadius: '50%',
            transition: 'all 0.2s',
            opacity: isCapturing ? 0.5 : 1
          }}
          title={isListening ? 'Stop listening' : 'Voice search'}
        >
          <FiMic />
        </button>
        
        {/* Camera Search Button */}
        <button
          type="button"
          onClick={startCameraSearch}
          disabled={isListening}
          style={{
            position: 'absolute',
            right: '10px',
            background: 'none',
            border: 'none',
            color: '#2874f0',
            cursor: isListening ? 'not-allowed' : 'pointer',
            fontSize: '18px',
            padding: '8px',
            borderRadius: '50%',
            transition: 'all 0.2s',
            opacity: isListening ? 0.5 : 1
          }}
          title="Face shape analysis"
        >
          <FiCamera />
        </button>
      </form>

      {/* Camera Modal */}
      {isCapturing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '640px',
                maxWidth: '90vw',
                borderRadius: '12px',
                transform: 'scaleX(-1)'
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={captureAndAnalyze}
              style={{
                padding: '12px 32px',
                background: '#667eea',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Capture & Analyze
            </button>
            <button
              onClick={stopCameraSearch}
              style={{
                padding: '12px 32px',
                background: '#f44336',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
