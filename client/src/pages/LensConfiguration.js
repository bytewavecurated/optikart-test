import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEye, FiCheck, FiArrowLeft, FiInfo, FiUpload } from 'react-icons/fi';
import { lensConfiguration as lensApi, products as productsApi } from '../services/api';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { oneOf } from '../services/apiResponse.js';

const LENS_TYPES = [
  { value: 'single-vision', label: 'Single Vision', description: 'One prescription power across the entire lens. Best for basic nearsightedness or farsightedness.', basePrice: 499 },
  { value: 'bifocal', label: 'Bifocal', description: 'Two distinct zones for near and far vision. Ideal if you need both reading and distance correction.', basePrice: 1299 },
  { value: 'progressive', label: 'Progressive', description: 'Seamless transition from distance to near vision with no visible lines. Premium all-in-one solution.', basePrice: 2499 },
  { value: 'reading', label: 'Reading', description: 'Dedicated near-vision lenses for close-up tasks like reading, sewing, or screen work.', basePrice: 399 },
  { value: 'computer', label: 'Computer / Digital', description: 'Optimized for intermediate screen distance. Reduces eye strain from prolonged digital device use.', basePrice: 899 },
];

const LENS_MATERIALS = [
  { value: 'cr39', label: 'CR-39', description: 'Standard plastic lens. Affordable with good optical clarity.', multiplier: 1 },
  { value: 'polycarbonate', label: 'Polycarbonate', description: 'Impact-resistant and lightweight. Great for active lifestyles and safety.', multiplier: 1.3 },
  { value: 'high-index-1.67', label: 'High Index 1.67', description: 'Thinner and lighter than standard lenses. Ideal for moderate prescriptions.', multiplier: 1.6 },
  { value: 'high-index-1.74', label: 'High Index 1.74', description: 'The thinnest option available. Best for strong prescriptions.', multiplier: 2 },
  { value: 'trivex', label: 'Trivex', description: 'Ultra-lightweight with superior impact resistance. Excellent optical quality.', multiplier: 1.5 },
  { value: 'glass', label: 'Glass', description: 'Scratch-resistant with excellent optical clarity. Heavier than plastic options.', multiplier: 1.2 },
];

const LENS_COATINGS = [
  { value: 'standard', label: 'Standard', description: 'Basic lens coating with essential protection.', price: 0 },
  { value: 'anti-reflective', label: 'Anti-Reflective', description: 'Reduces glare and reflections. Improves clarity and reduces eye strain.', price: 599 },
  { value: 'blue-cut', label: 'Blue Cut', description: 'Filters harmful blue light from screens and digital devices.', price: 799 },
  { value: 'photochromic', label: 'Photochromic', description: 'Automatically darkens in sunlight. Works as both regular and sunglasses.', price: 1499 },
  { value: 'polarized', label: 'Polarized', description: 'Eliminates glare from reflective surfaces. Perfect for driving and outdoor activities.', price: 1199 },
  { value: 'uv-protection', label: 'UV Protection', description: 'Blocks 100% of harmful UVA and UVB rays.', price: 399 },
];

const STEPS = [
  { number: 1, label: 'Lens Type' },
  { number: 2, label: 'Material' },
  { number: 3, label: 'Coating' },
  { number: 4, label: 'Prescription' },
  { number: 5, label: 'Summary' },
];

const LensConfiguration = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [existingConfigId, setExistingConfigId] = useState(null);

  const [selectedType, setSelectedType] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedCoating, setSelectedCoating] = useState('');

  const [prescription, setPrescription] = useState({
    rightSphere: '', rightCylinder: '', rightAxis: '', rightAddition: '',
    leftSphere: '', leftCylinder: '', leftAxis: '', leftAddition: '',
    pd: '',
  });
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [useFileUpload, setUseFileUpload] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productRes, pricingRes] = await Promise.all([
          productsApi.getById(id),
          lensApi.getPricing(),
        ]);
        setProduct(oneOf(productRes.data));
        setPricing(oneOf(pricingRes.data));

        try {
          const existingRes = await lensApi.getByProduct(id);
          const existing = oneOf(existingRes.data);
        if (existing) {
            const config = existing;
            setExistingConfigId(config._id);
            if (config.lensType) setSelectedType(config.lensType);
            if (config.lensMaterial) setSelectedMaterial(config.lensMaterial);
            if (config.lensCoating) setSelectedCoating(config.lensCoating);
            if (config.prescription) setPrescription((prev) => ({ ...prev, ...config.prescription }));
            if (config.pd) setPrescription((prev) => ({ ...prev, pd: config.pd }));
          }
        } catch {
          // no existing config
        }
      } catch (err) {
        toast.error('Failed to load product details');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const calculateTotal = () => {
    if (!product || !selectedType) return 0;
    const framePrice = product.price || 0;
    const typeObj = LENS_TYPES.find((t) => t.value === selectedType);
    const materialObj = LENS_MATERIALS.find((m) => m.value === selectedMaterial);
    const coatingObj = LENS_COATINGS.find((c) => c.value === selectedCoating);

    const baseLensPrice = typeObj?.basePrice || 0;
    const materialMultiplier = materialObj?.multiplier || 1;
    const coatingPrice = coatingObj?.price || 0;

    return framePrice + Math.round(baseLensPrice * materialMultiplier) + coatingPrice;
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1: return !!selectedType;
      case 2: return !!selectedMaterial;
      case 3: return !!selectedCoating;
      case 4:
        if (useFileUpload) return !!prescriptionFile;
        return !!prescription.pd && (
          !!prescription.rightSphere || !!prescription.leftSphere
        );
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!isStepValid(currentStep)) {
      toast.error('Please complete all required fields before proceeding');
      return;
    }
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('product', id);
      formData.append('lensType', selectedType);
      formData.append('lensMaterial', selectedMaterial);
      formData.append('lensCoating', selectedCoating);
      formData.append('prescription', JSON.stringify(prescription));
      formData.append('pd', prescription.pd);
      formData.append('totalPrice', calculateTotal());
      if (prescriptionFile) {
        formData.append('prescriptionFile', prescriptionFile);
      }

      if (existingConfigId) {
        await lensApi.update(existingConfigId, formData);
        toast.success('Lens configuration updated!');
      } else {
        const res = await lensApi.create(formData);
        setExistingConfigId(oneOf(res.data)?._id);
        toast.success('Lens configuration saved!');
      }
      navigate(`/product/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a JPG, PNG, or PDF file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB');
        return;
      }
      setPrescriptionFile(file);
    }
  };

  const handlePrescriptionChange = (field, value) => {
    setPrescription((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" />
            <p style={{ marginTop: '16px', color: 'var(--text-light)' }}>Loading configuration...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) return null;

  const total = calculateTotal();
  const typeObj = LENS_TYPES.find((t) => t.value === selectedType);
  const materialObj = LENS_MATERIALS.find((m) => m.value === selectedMaterial);
  const coatingObj = LENS_COATINGS.find((c) => c.value === selectedCoating);
  const lensCost = typeObj ? Math.round(typeObj.basePrice * (materialObj?.multiplier || 1)) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <button
            onClick={() => navigate(`/product/${id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', marginBottom: '16px', padding: 0 }}
          >
            <FiArrowLeft size={16} /> Back to Product
          </button>

          <div className="card" style={{ marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '16px', padding: '20px', alignItems: 'center' }} className="product-info-row">
              <img
                src={product.images?.[0] || '/placeholder-glasses.png'}
                alt={product.name}
                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-light)', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{product.name}</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{product.brand}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>₹{product.price}</span>
                  {product.originalPrice && (
                    <span style={{ fontSize: '13px', color: 'var(--text-light)', textDecoration: 'line-through' }}>₹{product.originalPrice}</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>₹{total}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }} className="step-indicators">
            {STEPS.map((step) => (
              <div
                key={step.number}
                onClick={() => {
                  if (step.number < currentStep || isStepValid(currentStep)) {
                    setCurrentStep(step.number);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  textAlign: 'center',
                  borderRadius: '8px',
                  cursor: step.number <= currentStep ? 'pointer' : 'default',
                  background: step.number === currentStep ? 'var(--primary)' : step.number < currentStep ? 'var(--primary-light, rgba(99,102,241,0.1))' : 'var(--bg-primary)',
                  color: step.number === currentStep ? '#fff' : step.number < currentStep ? 'var(--primary)' : 'var(--text-light)',
                  transition: 'all 0.2s ease',
                  border: step.number === currentStep ? 'none' : '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Step {step.number}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, marginTop: '2px' }}>{step.label}</div>
              </div>
            ))}
          </div>

          {currentStep === 1 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FiEye size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Select Lens Type</h2>
              </div>
              <div style={{ display: 'grid', gap: '12px' }} className="option-grid">
                {LENS_TYPES.map((type) => (
                  <div
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '8px',
                      border: `2px solid ${selectedType === type.value ? 'var(--primary)' : 'var(--border-light)'}`,
                      background: selectedType === type.value ? 'rgba(99,102,241,0.04)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>{type.label}</span>
                        {selectedType === type.value && <FiCheck size={16} style={{ color: 'var(--primary)' }} />}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>{type.description}</p>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      ₹{type.basePrice}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FiInfo size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Select Lens Material</h2>
              </div>
              <div style={{ display: 'grid', gap: '12px' }} className="option-grid">
                {LENS_MATERIALS.map((material) => (
                  <div
                    key={material.value}
                    onClick={() => setSelectedMaterial(material.value)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '8px',
                      border: `2px solid ${selectedMaterial === material.value ? 'var(--primary)' : 'var(--border-light)'}`,
                      background: selectedMaterial === material.value ? 'rgba(99,102,241,0.04)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>{material.label}</span>
                        {selectedMaterial === material.value && <FiCheck size={16} style={{ color: 'var(--primary)' }} />}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>{material.description}</p>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: material.multiplier > 1 ? 'var(--text-secondary)' : 'var(--success)', whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '4px 10px', borderRadius: '20px' }}>
                      {material.multiplier === 1 ? 'Included' : `×${material.multiplier}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FiEye size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Select Lens Coating</h2>
              </div>
              <div style={{ display: 'grid', gap: '12px' }} className="option-grid">
                {LENS_COATINGS.map((coating) => (
                  <div
                    key={coating.value}
                    onClick={() => setSelectedCoating(coating.value)}
                    style={{
                      padding: '16px 20px',
                      borderRadius: '8px',
                      border: `2px solid ${selectedCoating === coating.value ? 'var(--primary)' : 'var(--border-light)'}`,
                      background: selectedCoating === coating.value ? 'rgba(99,102,241,0.04)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>{coating.label}</span>
                        {selectedCoating === coating.value && <FiCheck size={16} style={{ color: 'var(--primary)' }} />}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0, lineHeight: 1.5 }}>{coating.description}</p>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: coating.price === 0 ? 'var(--success)' : 'var(--primary)', whiteSpace: 'nowrap' }}>
                      {coating.price === 0 ? 'Free' : `₹${coating.price}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FiInfo size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Enter Prescription</h2>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button
                  onClick={() => setUseFileUpload(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${!useFileUpload ? 'var(--primary)' : 'var(--border-light)'}`,
                    background: !useFileUpload ? 'rgba(99,102,241,0.04)' : 'var(--bg-primary)',
                    color: !useFileUpload ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Enter Manually
                </button>
                <button
                  onClick={() => setUseFileUpload(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${useFileUpload ? 'var(--primary)' : 'var(--border-light)'}`,
                    background: useFileUpload ? 'rgba(99,102,241,0.04)' : 'var(--bg-primary)',
                    color: useFileUpload ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Upload File
                </button>
              </div>

              {!useFileUpload ? (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Right Eye (OD)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }} className="rx-grid">
                      {[
                        { field: 'rightSphere', label: 'Sphere (SPH)' },
                        { field: 'rightCylinder', label: 'Cylinder (CYL)' },
                        { field: 'rightAxis', label: 'Axis' },
                        { field: 'rightAddition', label: 'Addition (ADD)' },
                      ].map(({ field, label }) => (
                        <div key={field}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-light)', marginBottom: '4px' }}>{label}</label>
                          <input
                            type="text"
                            value={prescription[field]}
                            onChange={(e) => handlePrescriptionChange(field, e.target.value)}
                            placeholder="e.g. -2.50"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              fontSize: '14px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Left Eye (OS)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }} className="rx-grid">
                      {[
                        { field: 'leftSphere', label: 'Sphere (SPH)' },
                        { field: 'leftCylinder', label: 'Cylinder (CYL)' },
                        { field: 'leftAxis', label: 'Axis' },
                        { field: 'leftAddition', label: 'Addition (ADD)' },
                      ].map(({ field, label }) => (
                        <div key={field}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-light)', marginBottom: '4px' }}>{label}</label>
                          <input
                            type="text"
                            value={prescription[field]}
                            onChange={(e) => handlePrescriptionChange(field, e.target.value)}
                            placeholder="e.g. -1.75"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              fontSize: '14px',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ maxWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-light)', marginBottom: '4px' }}>Pupillary Distance (PD) <span style={{ color: 'red' }}>*</span></label>
                    <input
                      type="text"
                      value={prescription.pd}
                      onChange={(e) => handlePrescriptionChange('pd', e.target.value)}
                      placeholder="e.g. 62"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>Usually between 54-74mm. Check your previous prescription.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: '12px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: prescriptionFile ? 'rgba(99,102,241,0.04)' : 'var(--bg-primary)',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => document.getElementById('rx-file-input').click()}
                  >
                    <FiUpload size={32} style={{ color: prescriptionFile ? 'var(--primary)' : 'var(--text-light)', marginBottom: '12px' }} />
                    {prescriptionFile ? (
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', margin: '0 0 4px' }}>{prescriptionFile.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: 0 }}>Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Upload your prescription</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: 0 }}>JPG, PNG, or PDF up to 5MB</p>
                      </div>
                    )}
                    <input
                      id="rx-file-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FiCheck size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Configuration Summary</h2>
              </div>

              <div style={{ display: 'grid', gap: '16px' }} className="summary-grid">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Frame</div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{product.name}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>₹{product.price}</div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Lens Type</div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{typeObj?.label || '-'}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>₹{typeObj?.basePrice || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Material</div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{materialObj?.label || '-'}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
                      {materialObj?.multiplier === 1 ? 'No additional cost' : `${materialObj?.multiplier}× multiplier`}
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Coating</div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>{coatingObj?.label || '-'}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: coatingObj?.price === 0 ? 'var(--success)' : 'var(--primary)', marginTop: '4px' }}>
                      {coatingObj?.price === 0 ? 'Free' : `₹${coatingObj?.price || 0}`}
                    </div>
                  </div>
                </div>

                {!useFileUpload && (prescription.rightSphere || prescription.leftSphere || prescription.pd) && (
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>Prescription Details</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Eye</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>SPH</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>CYL</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Axis</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>ADD</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>Right (OD)</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.rightSphere || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.rightCylinder || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.rightAxis || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.rightAddition || '-'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>Left (OS)</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.leftSphere || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.leftCylinder || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.leftAxis || '-'}</td>
                            <td style={{ textAlign: 'center', padding: '6px 8px' }}>{prescription.leftAddition || '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>PD: </span>
                      <span>{prescription.pd || '-'} mm</span>
                    </div>
                  </div>
                )}

                {useFileUpload && prescriptionFile && (
                  <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Prescription File</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{prescriptionFile.name}</div>
                  </div>
                )}

                <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--bg-dark)', color: '#fff' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px', opacity: 0.7 }}>Price Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ opacity: 0.8 }}>Frame Price</span>
                      <span>₹{product.price}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ opacity: 0.8 }}>Lens ({typeObj?.label})</span>
                      <span>₹{typeObj?.basePrice || 0}</span>
                    </div>
                    {materialObj && materialObj.multiplier > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ opacity: 0.8 }}>Material Upgrade ({materialObj.label} ×{materialObj.multiplier})</span>
                        <span>₹{lensCost - (typeObj?.basePrice || 0)}</span>
                      </div>
                    )}
                    {coatingObj && coatingObj.price > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ opacity: 0.8 }}>Coating ({coatingObj.label})</span>
                        <span>₹{coatingObj.price}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
                      <span>Total</span>
                      <span>₹{total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', gap: '12px' }}>
            <button
              onClick={currentStep === 1 ? () => navigate(`/product/${id}`) : handleBack}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FiArrowLeft size={16} />
              {currentStep === 1 ? 'Back to Product' : 'Back'}
            </button>

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid(currentStep)}
                style={{
                  padding: '12px 32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isStepValid(currentStep) ? 'var(--primary)' : 'var(--border)',
                  color: isStepValid(currentStep) ? '#fff' : 'var(--text-light)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isStepValid(currentStep) ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                }}
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '12px 32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: saving ? 'var(--border)' : 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <FiCheck size={16} /> Save & Continue
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .product-info-row {
            flex-direction: column !important;
            text-align: center;
          }
          .step-indicators {
            flex-wrap: wrap;
          }
          .step-indicators > div {
            flex: 1 1 calc(33% - 4px) !important;
            min-width: 0;
          }
          .option-grid {
            grid-template-columns: 1fr !important;
          }
          .rx-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .summary-grid > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .rx-grid {
            grid-template-columns: 1fr !important;
          }
          .step-indicators > div {
            flex: 1 1 calc(50% - 4px) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LensConfiguration;
