import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiCamera, FiFile, FiX, FiCheck, FiEye } from 'react-icons/fi';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const LENS_OPTIONS = [
  { value: 'single', label: 'Single Vision', desc: 'One prescription throughout the lens' },
  { value: 'bifocal', label: 'Bifocal', desc: 'Two prescriptions: distance + reading' },
  { value: 'progressive', label: 'Progressive', desc: 'Seamless transition, no visible line' },
];

const styles = {
  container: {
    fontFamily: "'Roboto', sans-serif",
    background: '#fff',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    padding: '24px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '24px',
  },
  dropzone: {
    border: '2px dashed #c2c2c2',
    borderRadius: '8px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: '#fafafa',
    marginBottom: '20px',
  },
  dropzoneActive: {
    borderColor: '#2874f0',
    background: '#f0f6ff',
  },
  dropzoneIcon: {
    fontSize: '48px',
    color: '#2874f0',
    marginBottom: '12px',
  },
  dropzoneText: {
    fontSize: '16px',
    color: '#333',
    fontWeight: 500,
    marginBottom: '8px',
  },
  dropzoneSubtext: {
    fontSize: '13px',
    color: '#888',
  },
  orDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '16px 0',
    color: '#888',
    fontSize: '13px',
  },
  orLine: {
    flex: 1,
    height: '1px',
    background: '#e0e0e0',
  },
  cameraBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    border: '1px solid #c2c2c2',
    borderRadius: '4px',
    background: '#fff',
    color: '#333',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  preview: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#f0f6ff',
    borderRadius: '4px',
    border: '1px solid #d0e0ff',
    marginBottom: '20px',
  },
  previewIcon: {
    fontSize: '24px',
    color: '#2874f0',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  previewSize: {
    fontSize: '12px',
    color: '#888',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#e43f5a',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#212121',
    marginBottom: '12px',
    marginTop: '24px',
  },
  lensGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  lensCard: {
    padding: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
  },
  lensCardActive: {
    borderColor: '#2874f0',
    background: '#f0f6ff',
  },
  lensLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '4px',
  },
  lensDesc: {
    fontSize: '11px',
    color: '#888',
    lineHeight: '1.4',
  },
  powerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '24px',
  },
  eyeSection: {
    background: '#fafafa',
    borderRadius: '4px',
    padding: '16px',
  },
  eyeTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#333',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
    marginBottom: '8px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#888',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  fieldInput: {
    padding: '8px 10px',
    border: '1px solid #d0d0d0',
    borderRadius: '3px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    color: '#e43f5a',
    fontSize: '12px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  success: {
    color: '#388e3c',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
    padding: '10px',
    background: '#e8f5e9',
    borderRadius: '4px',
  },
};

export default function PrescriptionUpload({ onUpload, onPrescriptionChange }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [lensType, setLensType] = useState('single');
  const [power, setPower] = useState({
    left: { sphere: '', cylinder: '', axis: '' },
    right: { sphere: '', cylinder: '', axis: '' },
  });
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const validateFile = useCallback((f) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please upload a PDF, JPG, or PNG file');
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('File size must be less than 5MB');
      return false;
    }
    setError('');
    return true;
  }, []);

  const handleFile = useCallback((f) => {
    if (validateFile(f)) {
      setFile(f);
      setUploaded(false);
      onUpload && onUpload(f);
    }
  }, [validateFile, onUpload]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploaded(false);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePowerChange = (eye, field, value) => {
    setPower(prev => ({
      ...prev,
      [eye]: { ...prev[eye], [field]: value },
    }));
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Upload Prescription</h3>
      <p style={styles.subtitle}>Upload your eye prescription or enter power details below</p>

      <div
        style={{
          ...styles.dropzone,
          ...(dragActive ? styles.dropzoneActive : {}),
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={styles.dropzoneIcon}>
          <FiUpload />
        </div>
        <div style={styles.dropzoneText}>
          Drag & drop your prescription here
        </div>
        <div style={styles.dropzoneSubtext}>
          Supports PDF, JPG, PNG (max 5MB)
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      <div style={styles.orDivider}>
        <div style={styles.orLine} />
        <span>OR</span>
        <div style={styles.orLine} />
      </div>

      <button
        style={styles.cameraBtn}
        onClick={() => cameraInputRef.current?.click()}
      >
        <FiCamera /> Capture with Camera
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      {file && (
        <div style={styles.preview}>
          <FiFile style={styles.previewIcon} />
          <div style={styles.previewInfo}>
            <div style={styles.previewName}>{file.name}</div>
            <div style={styles.previewSize}>{formatSize(file.size)}</div>
          </div>
          <button style={styles.removeBtn} onClick={removeFile}>
            <FiX />
          </button>
        </div>
      )}

      {error && <div style={styles.error}>⚠ {error}</div>}

      <h4 style={styles.sectionTitle}>Lens Preference</h4>
      <div style={styles.lensGrid} className="lens-grid">
        {LENS_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            style={{
              ...styles.lensCard,
              ...(lensType === opt.value ? styles.lensCardActive : {}),
            }}
            onClick={() => setLensType(opt.value)}
          >
            <div style={styles.lensLabel}>{opt.label}</div>
            <div style={styles.lensDesc}>{opt.desc}</div>
          </div>
        ))}
      </div>

      <h4 style={styles.sectionTitle}>Enter Power Details (Optional)</h4>
      <div style={styles.powerGrid} className="power-grid">
        {['left', 'right'].map((eye) => (
          <div key={eye} style={styles.eyeSection}>
            <div style={styles.eyeTitle}>
              <FiEye /> {eye === 'left' ? 'Left Eye (OS)' : 'Right Eye (OD)'}
            </div>
            <div style={styles.fieldRow}>
              {['sphere', 'cylinder', 'axis'].map((field) => (
                <div key={field} style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>{field}</label>
                  <input
                    type="text"
                    placeholder={field === 'axis' ? '0-180' : '±0.00'}
                    value={power[eye][field]}
                    onChange={(e) => handlePowerChange(eye, field, e.target.value)}
                    style={styles.fieldInput}
                    onFocus={(e) => e.target.style.borderColor = '#2874f0'}
                    onBlur={(e) => e.target.style.borderColor = '#d0d0d0'}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {uploaded && (
        <div style={styles.success}>
          <FiCheck /> Prescription uploaded successfully!
        </div>
      )}

      <style>{`
        @media (max-width: 600px) {
          .lens-grid { grid-template-columns: 1fr !important; }
          .power-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
