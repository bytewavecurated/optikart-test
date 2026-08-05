import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiCamera, FiX, FiRotateCw, FiDownload } from 'react-icons/fi';
import Webcam from 'react-webcam';
import { products } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const VirtualTryOn = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const webcamRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      setCameraActive(true);
      if (productsList.length === 0) {
        setLoading(true);
        const res = await products.getAll({ limit: 20 });
        setProductsList(res.data.data || []);
        setLoading(false);
      }
    } catch (err) {
      toast.error('Failed to start camera');
      setCameraActive(false);
    }
  }, [productsList.length]);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setCameraActive(false);
    }
  }, []);

  const retake = () => {
    setCapturedImage(null);
    setSelectedProduct(null);
    setCameraActive(true);
  };

  const handleTryOn = (product) => {
    setSelectedProduct(product);
    toast.success(`Trying on: ${product.name}`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Virtual Try-On</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '24px' }}>See how eyewear looks on you before buying</p>

          {!cameraActive && !capturedImage && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <FiCamera size={48} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Try Eyewear Virtually</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Use your camera to see how different frames look on your face</p>
              <button onClick={startCamera} className="btn btn-primary btn-lg"><FiCamera /> Start Camera</button>
            </div>
          )}

          {cameraActive && (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user', width: 640, height: 480 }} style={{ width: '100%', borderRadius: '8px' }} />
                {selectedProduct && (
                  <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                    <img src={selectedProduct.images?.[0]} alt="" style={{ width: '200px', opacity: 0.7, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={capture} className="btn btn-primary"><FiCamera /> Capture</button>
                <button onClick={() => { setCameraActive(false); setCapturedImage(null); }} className="btn btn-outline"><FiX /> Close</button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                <img src={capturedImage} alt="Captured" style={{ width: '100%', borderRadius: '8px' }} />
                {selectedProduct && (
                  <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                    <img src={selectedProduct.images?.[0]} alt="" style={{ width: '200px', opacity: 0.8, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
                <button onClick={retake} className="btn btn-outline"><FiRotateCw /> Retake</button>
                <button onClick={() => { const link = document.createElement('a'); link.download = 'optikart-tryon.jpg'; link.href = capturedImage; link.click(); }} className="btn btn-primary"><FiDownload /> Save</button>
              </div>
            </div>
          )}

          {(capturedImage || cameraActive) && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Select Eyewear to Try</h3>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                  {productsList.map((product) => (
                    <button key={product._id} onClick={() => handleTryOn(product)} style={{ padding: '8px', border: `2px solid ${selectedProduct?._id === product._id ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', background: selectedProduct?._id === product._id ? 'var(--primary-light)' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <img src={product.images?.[0]} alt={product.name} style={{ width: '100%', height: '80px', objectFit: 'contain', marginBottom: '4px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 500 }} className="truncate">{product.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VirtualTryOn;
