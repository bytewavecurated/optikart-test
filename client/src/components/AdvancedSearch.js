import React, { useState, useRef, useEffect } from 'react';
import { FiSearch, FiMic, FiCamera, FiX, FiLoader } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AdvancedSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceShape, setFaceShape] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();

  // Voice Search
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

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      handleSearch(transcript);
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

  // Camera Search with Face Shape Detection
  const startCameraSearch = async () => {
    setCameraActive(true);
    setIsAnalyzing(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Simulate face shape detection (in production, use a real face detection API)
      setTimeout(() => {
        const shapes = ['oval', 'round', 'square', 'heart', 'oblong'];
        const detectedShape = shapes[Math.floor(Math.random() * shapes.length)];
        setFaceShape(detectedShape);
        setIsAnalyzing(false);
        toast.success(`Face shape detected: ${detectedShape}`);
      }, 3000);

    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to access camera. Please check permissions.');
      setCameraActive(false);
      setIsAnalyzing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceShape(null);
    setIsAnalyzing(false);
  };

  const captureAndAnalyze = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      // In production, send this image to a face detection API
      // For now, simulate detection
      stopCamera();
      const shapes = ['oval', 'round', 'square', 'heart', 'oblong'];
      const detectedShape = shapes[Math.floor(Math.random() * shapes.length)];
      setFaceShape(detectedShape);
      toast.success(`Face shape detected: ${detectedShape}. Showing recommended frames.`);
      
      // Navigate to search with face shape filter
      navigate(`/search?q=${detectedShape}+face+shape+glasses`);
    }
  };

  const handleSearch = (query) => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopCamera();
    };
  }, []);

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}
      >
        <FiSearch size={18} />
        <span>Search products...</span>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 1000
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '600px',
              padding: '24px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Search Products</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--text-secondary)'
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search for eyewear, brands, styles..."
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={isListening ? stopVoiceSearch : startVoiceSearch}
                disabled={cameraActive}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: isListening ? 'var(--danger)' : 'var(--primary-light)',
                  color: isListening ? '#fff' : 'var(--primary)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: cameraActive ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: cameraActive ? 0.5 : 1
                }}
              >
                {isListening ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    Listening...
                  </>
                ) : (
                  <>
                    <FiMic size={18} />
                    Voice Search
                  </>
                )}
              </button>

              <button
                onClick={startCameraSearch}
                disabled={isListening}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--secondary-light)',
                  color: 'var(--secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isListening ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: isListening ? 0.5 : 1
                }}
              >
                <FiCamera size={18} />
                Camera Search
              </button>
            </div>

            {/* Camera View */}
            {cameraActive && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', display: 'block' }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  {isAnalyzing && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}>
                      <div className="spinner spinner-lg" style={{ marginBottom: '16px' }} />
                      <p style={{ margin: 0, fontSize: '16px' }}>Analyzing face shape...</p>
                    </div>
                  )}

                  {faceShape && !isAnalyzing && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0,0,0,0.8)',
                      padding: '16px',
                      color: '#fff',
                      textAlign: 'center'
                    }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Detected Face Shape:</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, textTransform: 'capitalize' }}>{faceShape}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button
                    onClick={captureAndAnalyze}
                    disabled={isAnalyzing || faceShape}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (isAnalyzing || faceShape) ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      opacity: (isAnalyzing || faceShape) ? 0.5 : 1
                    }}
                  >
                    {isAnalyzing ? 'Analyzing...' : faceShape ? 'Detected' : 'Capture & Analyze'}
                  </button>
                  <button
                    onClick={stopCamera}
                    style={{
                      padding: '12px 24px',
                      background: 'var(--danger)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Search Suggestions */}
            {!cameraActive && (
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '12px' }}>Popular searches:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Sunglasses', 'Eyeglasses', 'Ray-Ban', 'Blue cut', 'Contact lenses', 'Sports eyewear'].map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setSearchQuery(term);
                        handleSearch(term);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AdvancedSearch;
