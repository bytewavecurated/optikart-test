import React, { useState, useRef } from 'react';
import { FiCamera, FiUpload, FiX, FiCheck, FiInfo } from 'react-icons/fi';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { products } from '../services/api';
import toast from 'react-hot-toast';

const FaceShapeGuide = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState(null);

  const faceShapes = {
    oval: {
      name: 'Oval',
      description: 'Balanced proportions with slightly narrower forehead and jaw',
      characteristics: [
        'Face length is greater than the width',
        'Forehead is slightly wider than the jaw',
        'Rounded chin'
      ],
      recommendedFrames: ['rectangle', 'square', 'cat-eye', 'aviator'],
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
    },
    round: {
      name: 'Round',
      description: 'Similar width and length with full cheeks',
      characteristics: [
        'Face width and length are similar',
        'Full, rounded cheeks',
        'Soft, rounded chin'
      ],
      recommendedFrames: ['rectangle', 'square', 'cat-eye', 'geometric'],
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'
    },
    square: {
      name: 'Square',
      description: 'Strong jawline with similar width and length',
      characteristics: [
        'Face width and length are similar',
        'Strong, angular jawline',
        'Broad forehead'
      ],
      recommendedFrames: ['round', 'oval', 'aviator', 'cat-eye'],
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop'
    },
    heart: {
      name: 'Heart',
      description: 'Wider forehead with narrow chin',
      characteristics: [
        'Wider forehead',
        'High, prominent cheekbones',
        'Narrow, pointed chin'
      ],
      recommendedFrames: ['aviator', 'cat-eye', 'round', 'oval'],
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
    },
    oblong: {
      name: 'Oblong',
      description: 'Long face with similar width throughout',
      characteristics: [
        'Face length is significantly greater than width',
        'Straight cheek lines',
        'Longer chin'
      ],
      recommendedFrames: ['square', 'rectangle', 'round', 'aviator'],
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop'
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        setSelectedImage(blob);
        stopCamera();
        analyzeFace(blob);
      }, 'image/jpeg', 0.9);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setSelectedImage(file);
      analyzeFace(file);
    }
  };

  const analyzeFace = async (imageFile) => {
    setIsAnalyzing(true);
    setResult(null);
    setRecommendedProducts([]);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch('http://localhost:5000/api/face-detection/detect', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        fetchRecommendedProducts(data.data.faceShape);
      } else {
        toast.error(data.message || 'Failed to analyze face');
      }
    } catch (error) {
      console.error('Error analyzing face:', error);
      toast.error('Failed to analyze face. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchRecommendedProducts = async (faceShape) => {
    setLoadingProducts(true);
    try {
      const shapes = faceShapes[faceShape];
      if (shapes) {
        const frameShapes = shapes.recommendedFrames.slice(0, 2);
        const response = await products.getAll({ 
          frameShape: frameShapes.join(','),
          limit: 8 
        });
        setRecommendedProducts(response.data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const resetAnalysis = () => {
    setSelectedImage(null);
    setResult(null);
    setRecommendedProducts([]);
    stopCamera();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, background: '#f8f9fa' }}>
        {/* Hero Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '16px' }}>
            Find Your Perfect Frame
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.95, maxWidth: '600px', margin: '0 auto' }}>
            Discover your face shape and get personalized frame recommendations
          </p>
        </div>

        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          {/* Analysis Section */}
          {!result && (
            <div style={{ 
              background: '#fff',
              borderRadius: '16px',
              padding: '40px',
              marginBottom: '40px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
            }}>
              <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>
                Analyze Your Face Shape
              </h2>
              
              {!cameraActive && !selectedImage && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                  <button
                    onClick={startCamera}
                    style={{
                      padding: '30px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <FiCamera size={48} />
                    <span style={{ fontSize: '18px', fontWeight: 600 }}>Use Camera</span>
                    <span style={{ fontSize: '14px', opacity: 0.9 }}>Take a photo now</span>
                  </button>

                  <label
                    style={{
                      padding: '30px',
                      background: '#f8f9fa',
                      border: '2px dashed #dee2e6',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#667eea';
                      e.currentTarget.style.background = '#f0f4ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#dee2e6';
                      e.currentTarget.style.background = '#f8f9fa';
                    }}
                  >
                    <FiUpload size={48} style={{ color: '#667eea' }} />
                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#212121' }}>Upload Image</span>
                    <span style={{ fontSize: '14px', color: '#757575' }}>Choose from gallery</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}

              {cameraActive && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: '100%',
                        maxWidth: '640px',
                        borderRadius: '12px',
                        transform: 'scaleX(-1)'
                      }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button
                      onClick={captureImage}
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
                      Capture Photo
                    </button>
                    <button
                      onClick={stopCamera}
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

              {isAnalyzing && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 20px'
                  }} />
                  <p style={{ fontSize: '18px', color: '#757575' }}>Analyzing your face shape...</p>
                </div>
              )}
            </div>
          )}

          {/* Result Section */}
          {result && (
            <div style={{ 
              background: '#fff',
              borderRadius: '16px',
              padding: '40px',
              marginBottom: '40px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>
                  Your Face Shape: {faceShapes[result.faceShape]?.name || result.faceShape}
                </h2>
                <button
                  onClick={resetAnalysis}
                  style={{
                    padding: '10px 20px',
                    background: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FiX /> Try Again
                </button>
              </div>

              <div style={{ 
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                borderRadius: '12px',
                padding: '30px',
                marginBottom: '30px'
              }}>
                <p style={{ fontSize: '18px', lineHeight: 1.6, margin: 0 }}>
                  {result.description}
                </p>
              </div>

              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                  Frame Recommendations
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {result.recommendedFrames.map((frame, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '16px',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <FiCheck style={{ color: '#4caf50', flexShrink: 0 }} />
                      <span style={{ fontSize: '16px', textTransform: 'capitalize' }}>{frame}</span>
                    </div>
                  ))}
                </div>
              </div>

              {recommendedProducts.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>
                    Recommended Frames For You
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                    {recommendedProducts.map((product) => (
                      <ProductCard key={product._id} product={product} />
                    ))}
                  </div>
                </div>
              )}

              {loadingProducts && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner spinner-lg" />
                  <p style={{ marginTop: '16px', color: '#757575' }}>Loading recommended products...</p>
                </div>
              )}
            </div>
          )}

          {/* Face Shapes Guide */}
          <div style={{ 
            background: '#fff',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              Understanding Face Shapes
            </h2>
            <p style={{ fontSize: '16px', color: '#757575', textAlign: 'center', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
              Learn about different face shapes and which frames complement them best
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {Object.entries(faceShapes).map(([key, shape]) => (
                <div
                  key={key}
                  style={{
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    padding: '24px',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#667eea' }}>
                    {shape.name}
                  </h3>
                  <p style={{ fontSize: '14px', color: '#757575', marginBottom: '16px', lineHeight: 1.6 }}>
                    {shape.description}
                  </p>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#212121' }}>
                      Characteristics:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {shape.characteristics.map((char, index) => (
                        <li key={index} style={{ fontSize: '13px', color: '#757575', marginBottom: '4px' }}>
                          {char}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#212121' }}>
                      Best Frames:
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {shape.recommendedFrames.map((frame, index) => (
                        <span
                          key={index}
                          style={{
                            padding: '4px 12px',
                            background: '#667eea',
                            color: '#fff',
                            borderRadius: '16px',
                            fontSize: '12px',
                            textTransform: 'capitalize'
                          }}
                        >
                          {frame}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FaceShapeGuide;
