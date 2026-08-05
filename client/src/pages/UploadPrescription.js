import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUpload, FiCheck, FiFile, FiX, FiEdit2, FiTrash2, FiEye, FiPlus, FiCalendar } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const UploadPrescription = () => {
  const { user, isAuthenticated } = useAuth();
  const [savedPrescriptions, setSavedPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [prescriptionType, setPrescriptionType] = useState('single_vision');
  const [lensType, setLensType] = useState('');
  const [eyePower, setEyePower] = useState({
    rightEye: { sph: '', cyl: '', axis: '' },
    leftEye: { sph: '', cyl: '', axis: '' },
    pd: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchPrescriptions();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchPrescriptions = async () => {
    try {
      const res = await auth.getPrescriptions();
      if (res.data.success) {
        setSavedPrescriptions(res.data.prescriptions || []);
      }
    } catch (err) {
      console.error('Failed to fetch prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const validFiles = newFiles.filter((f) => {
      const isValid = f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'application/pdf';
      return isValid && f.size <= 5 * 1024 * 1024;
    });
    if (validFiles.length !== newFiles.length) {
      toast.error('Only JPEG, PNG, PDF files allowed (max 5MB each)');
    }
    setFiles(validFiles.slice(0, 3));
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFiles([]);
    setNotes('');
    setPrescriptionType('single_vision');
    setLensType('');
    setEyePower({ rightEye: { sph: '', cyl: '', axis: '' }, leftEye: { sph: '', cyl: '', axis: '' }, pd: '' });
    setEditingId(null);
    setShowUploadForm(false);
  };

  const handleUpload = async () => {
    if (files.length === 0 && !editingId) {
      toast.error('Please upload at least one file');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please login to save prescriptions');
      return;
    }

    setUploading(true);
    try {
      // Convert files to base64 for storage
      const fileUrls = [];
      for (const file of files) {
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        fileUrls.push(base64);
      }

      const prescriptionData = {
        fileUrl: fileUrls[0] || (editingId ? savedPrescriptions.find(p => p._id === editingId)?.fileUrl : ''),
        prescriptionType,
        lensType,
        notes,
        eyePower
      };

      if (editingId) {
        const res = await auth.updatePrescription(editingId, prescriptionData);
        if (res.data.success) {
          toast.success('Prescription updated successfully!');
        }
      } else {
        const res = await auth.addPrescription(prescriptionData);
        if (res.data.success) {
          toast.success('Prescription saved to your account!');
        }
      }

      resetForm();
      fetchPrescriptions();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to save prescription');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (prescription) => {
    setEditingId(prescription._id);
    setPrescriptionType(prescription.prescriptionType || 'single_vision');
    setLensType(prescription.lensType || '');
    setNotes(prescription.notes || '');
    setEyePower(prescription.eyePower || { rightEye: { sph: '', cyl: '', axis: '' }, leftEye: { sph: '', cyl: '', axis: '' }, pd: '' });
    setShowUploadForm(true);
  };

  const handleDelete = async (prescriptionId) => {
    if (!window.confirm('Are you sure you want to delete this prescription?')) return;
    try {
      const res = await auth.deletePrescription(prescriptionId);
      if (res.data.success) {
        toast.success('Prescription deleted');
        fetchPrescriptions();
      }
    } catch (err) {
      toast.error('Failed to delete prescription');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <div className="container page-wrapper">
            <div style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center' }}>
              <FiFile style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Login to Manage Prescriptions</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Sign in to upload, save, and manage your eye prescriptions securely in your account.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', padding: '12px 32px' }}>Login / Sign Up</Link>
            </div>
          </div>
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
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>My Prescriptions</h1>
                <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>
                  Your prescriptions are saved securely to your account
                </p>
              </div>
              {!showUploadForm && (
                <button onClick={() => setShowUploadForm(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPlus size={16} /> Add New Prescription
                </button>
              )}
            </div>

            {/* Upload/Edit Form */}
            {showUploadForm && (
              <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                    {editingId ? 'Update Prescription' : 'Upload New Prescription'}
                  </h3>
                  <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                    <FiX size={20} />
                  </button>
                </div>

                {/* File Upload */}
                <div
                  style={{ border: '2px dashed var(--border)', borderRadius: '8px', padding: '32px', textAlign: 'center', marginBottom: '20px', cursor: 'pointer' }}
                  onClick={() => document.getElementById('fileInput').click()}
                >
                  <FiUpload size={32} style={{ color: 'var(--primary)', marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                    {files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload prescription'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-light)' }}>JPEG, PNG, or PDF (Max 5MB each)</p>
                  <input id="fileInput" type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                </div>

                {files.length > 0 && (
                  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {files.map((file, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FiFile size={14} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontSize: '13px' }}>{file.name}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} style={{ color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          <FiX size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prescription Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Prescription Type</label>
                    <select className="input" value={prescriptionType} onChange={(e) => setPrescriptionType(e.target.value)}>
                      <option value="single_vision">Single Vision</option>
                      <option value="bifocal">Bifocal</option>
                      <option value="progressive">Progressive</option>
                      <option value="contact_lens">Contact Lens</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Lens Preference</label>
                    <select className="input" value={lensType} onChange={(e) => setLensType(e.target.value)}>
                      <option value="">Select lens type</option>
                      <option value="nonpowered">Non-Powered</option>
                      <option value="powered">Powered</option>
                      <option value="photochromic">Photochromic</option>
                      <option value="polarized">Polarized</option>
                      <option value="bluCut">Blue Cut</option>
                    </select>
                  </div>
                </div>

                {/* Eye Power */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Eye Power (optional)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Right Eye (OD)</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>SPH</label>
                          <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.rightEye.sph} onChange={(e) => setEyePower({ ...eyePower, rightEye: { ...eyePower.rightEye, sph: e.target.value } })} placeholder="-2.00" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>CYL</label>
                          <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.rightEye.cyl} onChange={(e) => setEyePower({ ...eyePower, rightEye: { ...eyePower.rightEye, cyl: e.target.value } })} placeholder="-0.50" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>Axis</label>
                          <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.rightEye.axis} onChange={(e) => setEyePower({ ...eyePower, rightEye: { ...eyePower.rightEye, axis: e.target.value } })} placeholder="180" />
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Left Eye (OS)</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>SPH</label>
                          <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.leftEye.sph} onChange={(e) => setEyePower({ ...eyePower, leftEye: { ...eyePower.leftEye, sph: e.target.value } })} placeholder="-1.75" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>CYL</label>
                          <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.leftEye.cyl} onChange={(e) => setEyePower({ ...eyePower, leftEye: { ...eyePower.leftEye, cyl: e.target.value } })} placeholder="-0.75" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>Axis</label>
                          <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.leftEye.axis} onChange={(e) => setEyePower({ ...eyePower, leftEye: { ...eyePower.leftEye, axis: e.target.value } })} placeholder="175" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', maxWidth: '120px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-light)' }}>PD (mm)</label>
                    <input className="input" style={{ padding: '6px 8px', fontSize: '12px' }} value={eyePower.pd} onChange={(e) => setEyePower({ ...eyePower, pd: e.target.value })} placeholder="62" />
                  </div>
                </div>

                {/* Notes */}
                <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label>Additional Notes (optional)</label>
                  <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions..." />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handleUpload} disabled={uploading} className="btn btn-primary" style={{ flex: 1 }}>
                    {uploading ? 'Saving...' : editingId ? 'Update Prescription' : 'Save Prescription'}
                  </button>
                  <button onClick={resetForm} className="btn btn-outline">Cancel</button>
                </div>
              </div>
            )}

            {/* Saved Prescriptions List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : savedPrescriptions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Saved Prescriptions ({savedPrescriptions.length})</h3>
                {savedPrescriptions.map((rx) => (
                  <div key={rx._id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <FiFile size={16} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>
                          {rx.prescriptionType ? rx.prescriptionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Prescription'}
                        </span>
                        {rx.lensType && (
                          <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--primary-light, #e3f0ff)', color: 'var(--primary)', borderRadius: '12px', fontWeight: 500 }}>
                            {rx.lensType}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-light)', marginBottom: '6px' }}>
                        <FiCalendar size={12} />
                        <span>Uploaded: {formatDate(rx.uploadedAt)}</span>
                      </div>
                      {rx.notes && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{rx.notes}</p>}
                      {rx.eyePower && (rx.eyePower.rightEye?.sph || rx.eyePower.leftEye?.sph) && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 500 }}>Power: </span>
                          {rx.eyePower.rightEye?.sph && <span>R: {rx.eyePower.rightEye.sph} </span>}
                          {rx.eyePower.leftEye?.sph && <span>L: {rx.eyePower.leftEye.sph}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(rx)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>
                        <FiEdit2 size={12} /> Edit
                      </button>
                      <button onClick={() => handleDelete(rx._id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#fff', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--danger)' }}>
                        <FiTrash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !showUploadForm ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <FiFile style={{ fontSize: '48px', color: 'var(--text-light)', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No Prescriptions Saved</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Upload your eye prescription to order powered glasses easily.
                </p>
                <button onClick={() => setShowUploadForm(true)} className="btn btn-primary">
                  Upload Your First Prescription
                </button>
              </div>
            ) : null}

            {/* Info Card */}
            <div className="card" style={{ padding: '20px', marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>What to include in your prescription</h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', listStyle: 'none', padding: 0 }}>
                {['Sphere (SPH) power for each eye', 'Cylinder (CYL) power if you have astigmatism', 'Axis for cylinder correction', 'Addition (ADD) power for reading/bifocals', 'Pupillary Distance (PD)'].map((item, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <FiCheck size={14} style={{ color: 'var(--success)', flexShrink: 0 }} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UploadPrescription;
