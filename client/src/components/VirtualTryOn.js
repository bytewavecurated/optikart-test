import React, { useState, useRef, useEffect } from 'react';
import { FiCamera, FiCircle, FiMaximize2, FiRefreshCw, FiX, FiCheck } from 'react-icons/fi';

const SAMPLE_FRAMES = [
  { id: 1, name: 'Aviator Classic', color: '#FFD700', bridge: 18, lensW: 58 },
  { id: 2, name: 'Wayfarer', color: '#1a1a1a', bridge: 20, lensW: 52 },
  { id: 3, name: 'Round Metal', color: '#C0C0C0', bridge: 22, lensW: 48 },
  { id: 4, name: 'Cat Eye', color: '#e43f5a', bridge: 18, lensW: 50 },
  { id: 5, name: 'Rectangle', color: '#8B4513', bridge: 16, lensW: 54 },
  { id: 6, name: 'Oval', color: '#2874f0', bridge: 20, lensW: 50 },
];

const styles = {
  container: {
    fontFamily: "'Roboto', sans-serif",
    background: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  header: {
    background: '#2874f0',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
  },
  viewport: {
    position: 'relative',
    width: '100%',
    height: '400px',
    background: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  faceOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '240px',
    height: '280px',
    border: '2px dashed rgba(255,255,255,0.4)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  faceGuideText: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    background: 'rgba(0,0,0,0.5)',
    padding: '6px 16px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
  },
  glassesOverlay: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  controls: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  captureBtn: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: '#fff',
    border: '4px solid rgba(255,255,255,0.5)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  captureInner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: '#fff',
    border: '2px solid #e0e0e0',
  },
  controlBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    backdropFilter: 'blur(4px)',
  },
  frameSelector: {
    padding: '16px 24px',
    background: '#f8f9fa',
    borderTop: '1px solid #e0e0e0',
  },
  frameSelectorTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '12px',
  },
  frameGrid: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
  },
  frameCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    minWidth: '80px',
    padding: '10px 8px',
    borderRadius: '8px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: '#fff',
  },
  frameCardActive: {
    borderColor: '#2874f0',
    background: '#f0f6ff',
  },
  framePreview: {
    width: '60px',
    height: '24px',
    borderRadius: '12px',
    border: '3px solid',
    position: 'relative',
  },
  frameBridge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '3px',
    background: 'currentColor',
    borderRadius: '2px',
  },
  frameName: {
    fontSize: '11px',
    color: '#666',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  permissionScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    background: '#f8f9fa',
    gap: '16px',
    padding: '40px',
    textAlign: 'center',
  },
  permIcon: {
    fontSize: '64px',
    color: '#2874f0',
  },
  permTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#333',
  },
  permText: {
    fontSize: '14px',
    color: '#888',
    maxWidth: '300px',
    lineHeight: '1.5',
  },
  permBtn: {
    background: '#2874f0',
    color: '#fff',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '4px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  note: {
    padding: '12px 24px',
    background: '#fff8e1',
    borderTop: '1px solid #ffe082',
    fontSize: '12px',
    color: '#f57c00',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

function GlassesSVG({ frame, size = 1 }) {
  const w = frame.lensW * size;
  const b = frame.bridge * size;
  const totalW = w * 2 + b;

  return (
    <svg width={totalW} height={w * 0.7} viewBox={`0 0 ${totalW} ${w * 0.7}`}>
      <ellipse
        cx={w / 2}
        cy={w * 0.35}
        rx={w / 2 - 2}
        ry={w * 0.3}
        fill="none"
        stroke={frame.color}
        strokeWidth="3"
        opacity="0.85"
      />
      <ellipse
        cx={w + b + w / 2}
        cy={w * 0.35}
        rx={w / 2 - 2}
        ry={w * 0.3}
        fill="none"
        stroke={frame.color}
        strokeWidth="3"
        opacity="0.85"
      />
      <line
        x1={w - 2}
        y1={w * 0.35}
        x2={w + b + 2}
        y2={w * 0.35}
        stroke={frame.color}
        strokeWidth="3"
        opacity="0.85"
      />
      <line x1="0" y1={w * 0.2} x2={w * 0.1} y2={w * 0.35} stroke={frame.color} strokeWidth="2" opacity="0.6" />
      <line x1={totalW} y1={w * 0.2} x2={totalW - w * 0.1} y2={w * 0.35} stroke={frame.color} strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

export default function VirtualTryOn() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(SAMPLE_FRAMES[0]);
  const [captured, setCaptured] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setPermissionGranted(true);
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);
    setCaptured(canvas.toDataURL('image/png'));
    stopCamera();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Virtual Try-On</div>
          <div style={styles.subtitle}>See how glasses look on you</div>
        </div>
      </div>

      <div style={styles.viewport}>
        {!permissionGranted && !captured && (
          <div style={styles.permissionScreen}>
            <div style={styles.permIcon}>
              <FiCamera />
            </div>
            <div style={styles.permTitle}>Camera Access Required</div>
            <div style={styles.permText}>
              Allow camera access to try on glasses virtually. Your privacy is important — no images are stored or shared.
            </div>
            <button style={styles.permBtn} onClick={startCamera}>
              Enable Camera
            </button>
          </div>
        )}

        {permissionGranted && cameraActive && !captured && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={styles.video}
            />
            <div style={styles.faceOverlay} />
            <div style={styles.glassesOverlay}>
              <GlassesSVG frame={selectedFrame} size={1.5} />
            </div>
            <div style={styles.controls}>
              <button style={styles.controlBtn} onClick={retake}>
                <FiRefreshCw />
              </button>
              <button style={styles.captureBtn} onClick={capturePhoto}>
                <div style={styles.captureInner} />
              </button>
              <button style={styles.controlBtn}>
                <FiMaximize2 />
              </button>
            </div>
            <div style={styles.faceGuideText}>
              Position your face within the oval guide
            </div>
          </>
        )}

        {captured && (
          <>
            <img src={captured} alt="Captured" style={styles.capturedImage} />
            <div style={styles.glassesOverlay}>
              <GlassesSVG frame={selectedFrame} size={1.5} />
            </div>
            <div style={styles.controls}>
              <button style={styles.controlBtn} onClick={retake}>
                <FiRefreshCw />
              </button>
              <button style={{ ...styles.captureBtn, background: '#388e3c', border: '4px solid rgba(56,142,60,0.3)' }}>
                <FiCheck size={24} color="#fff" />
              </button>
            </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={styles.frameSelector}>
        <div style={styles.frameSelectorTitle}>Choose a Frame</div>
        <div style={styles.frameGrid}>
          {SAMPLE_FRAMES.map((frame) => (
            <div
              key={frame.id}
              style={{
                ...styles.frameCard,
                ...(selectedFrame.id === frame.id ? styles.frameCardActive : {}),
              }}
              onClick={() => setSelectedFrame(frame)}
            >
              <div style={{ ...styles.framePreview, borderColor: frame.color }}>
                <div style={{ ...styles.frameBridge, color: frame.color }} />
              </div>
              <span style={styles.frameName}>{frame.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.note}>
        <FiCircle size={8} fill="#f57c00" />
        This is a preview. For accurate fitting, visit your nearest store.
      </div>
    </div>
  );
}
