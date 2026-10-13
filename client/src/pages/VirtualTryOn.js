import React, { useState, useRef, useEffect } from 'react';
import { FiCamera, FiDownload, FiRefreshCw, FiX, FiCheck } from 'react-icons/fi';
import { products } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const VirtualTryOn = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capturedImage, setCapturedImage] = useState(null);
  const [savedPhotos, setSavedPhotos] = useState([]);
  const [currentAngle, setCurrentAngle] = useState('front'); // front, left, right

  useEffect(() => {
    fetchProducts();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await products.getAll({ limit: 20 });
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      
      // Draw video frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Draw product overlay (AR simulation)
      if (selectedProduct) {
        drawProductOverlay(context, canvas.width, canvas.height);
      }
      
      const imageData = canvas.toDataURL('image/png');
      setCapturedImage(imageData);
      
      toast.success('Photo captured!');
    }
  };

  const drawProductOverlay = (context, width, height) => {
    if (!selectedProduct || !selectedProduct.images || selectedProduct.images.length === 0) return;

    // Simulate AR overlay by drawing product image
    const overlayWidth = width * 0.4;
    const overlayHeight = overlayWidth * 0.3;
    const x = (width - overlayWidth) / 2;
    const y = height * 0.3;

    // Draw semi-transparent background
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x, y, overlayWidth, overlayHeight);

    // Note: In a real AR implementation, you would:
    // 1. Use face detection to locate facial landmarks
    // 2. Calculate proper positioning and scaling
    // 3. Apply perspective transformation
    // 4. Use WebGL or Canvas for real-time rendering
    // This is a simplified simulation
  };

  const savePhoto = () => {
    if (capturedImage) {
      const photo = {
        id: Date.now(),
        image: capturedImage,
        product: selectedProduct,
        angle: currentAngle,
        timestamp: new Date().toISOString()
      };
      
      setSavedPhotos([...savedPhotos, photo]);
      setCapturedImage(null);
      toast.success('Photo saved!');
    }
  };

  const deletePhoto = (photoId) => {
    setSavedPhotos(savedPhotos.filter(p => p.id !== photoId));
    toast.success('Photo deleted');
  };

  const rotateView = (angle) => {
    setCurrentAngle(angle);
    toast.success(`Switched to ${angle} view`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, background: '#f8f9fa' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>
            Virtual Try-On
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Try on eyewear virtually using your camera
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
            {/* Camera View */}
            <div>
              <div style={{ 
                background: '#000', 
                borderRadius: '12px', 
                overflow: 'hidden', 
                position: 'relative',
                aspectRatio: '16/9',
                marginBottom: '16px'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    transform: 'scaleX(-1)' // Mirror effect
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {!isStreaming && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff'
                  }}>
                    <button
                      onClick={startCamera}
                      style={{
                        padding: '16px 32px',
                        background: 'var(--action)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <FiCamera size={20} />
                      Start Camera
                    </button>
                  </div>
                )}

                {isStreaming && selectedProduct && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}>
                    Trying: {selectedProduct.title}
                  </div>
                )}
              </div>

              {/* Controls */}
              {isStreaming && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button
                    onClick={capturePhoto}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'var(--action)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <FiCamera size={18} />
                    Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    style={{
                      padding: '12px 24px',
                      background: 'var(--danger)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <FiX size={18} />
                    Stop
                  </button>
                </div>
              )}

              {/* Angle Selection */}
              {isStreaming && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {['front', 'left', 'right'].map(angle => (
                    <button
                      key={angle}
                      onClick={() => rotateView(angle)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: currentAngle === angle ? 'var(--action)' : '#fff',
                        color: currentAngle === angle ? '#fff' : 'var(--text-primary)',
                        border: `1px solid ${currentAngle === angle ? 'var(--action)' : 'var(--border)'}`,
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {angle} View
                    </button>
                  ))}
                </div>
              )}

              {/* Captured Image Preview */}
              {capturedImage && (
                <div style={{ 
                  background: '#fff', 
                  borderRadius: '12px', 
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                    Captured Photo
                  </h3>
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    style={{ 
                      width: '100%', 
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={savePhoto}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'var(--success)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <FiCheck size={18} />
                      Save Photo
                    </button>
                    <button
                      onClick={() => setCapturedImage(null)}
                      style={{
                        padding: '10px 20px',
                        background: '#fff',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Retake
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Photos */}
              {savedPhotos.length > 0 && (
                <div style={{ 
                  background: '#fff', 
                  borderRadius: '12px', 
                  padding: '16px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                    Saved Photos ({savedPhotos.length})
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {savedPhotos.map(photo => (
                      <div key={photo.id} style={{ position: 'relative' }}>
                        <img 
                          src={photo.image} 
                          alt="Saved" 
                          style={{ 
                            width: '100%', 
                            aspectRatio: '16/9',
                            objectFit: 'cover',
                            borderRadius: '8px'
                          }}
                        />
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <FiX size={16} />
                        </button>
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          left: '8px',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          textTransform: 'capitalize'
                        }}>
                          {photo.angle}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Product Selection */}
            <div>
              <div style={{ 
                background: '#fff', 
                borderRadius: '12px', 
                padding: '16px',
                position: 'sticky',
                top: '20px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                  Select Product
                </h3>
                
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="spinner" />
                  </div>
                ) : (
                  <div style={{ 
                    maxHeight: '600px', 
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {products.map(product => (
                      <div
                        key={product._id}
                        onClick={() => setSelectedProduct(product)}
                        style={{
                          padding: '12px',
                          border: `2px solid ${selectedProduct?._id === product._id ? 'var(--action)' : 'var(--border)'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {product.images && product.images.length > 0 && (
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            style={{
                              width: '100%',
                              height: '120px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              marginBottom: '8px'
                            }}
                          />
                        )}
                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                          {product.title}
                        </h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          {product.brand}
                        </p>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--action)' }}>
                          ₹{product.price}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VirtualTryOn;
