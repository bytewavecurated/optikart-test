import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products as productsApi, cart as cartApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiArrowRight, FiUpload, FiCheck } from 'react-icons/fi';
import { oneOf } from '../services/apiResponse';

const LENS_TYPES = [
  { id: 'single-vision', name: 'Single Vision', price: 799, description: 'For distance or reading' },
  { id: 'bifocal', name: 'Bifocal', price: 1499, description: 'Two prescriptions in one lens' },
  { id: 'progressive', name: 'Progressive', price: 2499, description: 'Seamless multi-distance vision' },
  { id: 'computer', name: 'Computer/Gaming', price: 1299, description: 'Reduced eye strain for screens' }
];

const LENS_MATERIALS = [
  { id: 'cr39', name: 'CR-39', price: 0, description: 'Standard plastic lens' },
  { id: 'polycarbonate', name: 'Polycarbonate', price: 500, description: 'Impact resistant, lightweight' },
  { id: 'high-index-1.67', name: 'High Index 1.67', price: 1500, description: 'Thin and light for strong prescriptions' },
  { id: 'high-index-1.74', name: 'High Index 1.74', price: 2500, description: 'Ultra-thin for very strong prescriptions' },
  { id: 'trivex', name: 'Trivex', price: 2000, description: 'Lightweight, excellent optics' }
];

const LENS_COATINGS = [
  { id: 'standard', name: 'Standard', price: 0, description: 'Basic coating' },
  { id: 'anti-reflective', name: 'Anti-Reflective', price: 800, description: 'Reduces glare and reflections' },
  { id: 'blue-cut', name: 'Blue Cut', price: 1200, description: 'Blocks harmful blue light' },
  { id: 'photochromic', name: 'Photochromic', price: 2000, description: 'Transitions from clear to dark' },
  { id: 'polarized', name: 'Polarized', price: 1800, description: 'Reduces glare from surfaces' }
];

const LensSelection = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedLensType, setSelectedLensType] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedCoating, setSelectedCoating] = useState(null);
  const [prescriptionMethod, setPrescriptionMethod] = useState(null); // 'manual' or 'upload'
  const [prescription, setPrescription] = useState({
    rightEye: { sphere: '', cylinder: '', axis: '', addition: '' },
    leftEye: { sphere: '', cylinder: '', axis: '', addition: '' },
    pd: ''
  });
  const [prescriptionFile, setPrescriptionFile] = useState(null);

  React.useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const res = await productsApi.getById(productId);
      setProduct(oneOf(res.data, 'product'));
    } catch (error) {
      toast.error('Failed to load product');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!product) return 0;
    let total = product.price;
    if (selectedLensType) total += selectedLensType.price;
    if (selectedMaterial) total += selectedMaterial.price;
    if (selectedCoating) total += selectedCoating.price;
    return total;
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to cart');
      navigate('/login');
      return;
    }

    if (!selectedLensType || !selectedMaterial || !selectedCoating) {
      toast.error('Please complete lens selection');
      return;
    }

    if (prescriptionMethod === 'manual') {
      if (!prescription.rightEye.sphere || !prescription.leftEye.sphere || !prescription.pd) {
        toast.error('Please complete prescription details');
        return;
      }
    }

    if (prescriptionMethod === 'upload' && !prescriptionFile) {
      toast.error('Please upload prescription');
      return;
    }

    try {
      const cartData = {
        productId,
        quantity: 1,
        lensConfiguration: {
          lensType: selectedLensType.id,
          material: selectedMaterial.id,
          coating: selectedCoating.id,
          prescription: prescriptionMethod === 'manual' ? prescription : null,
          prescriptionFile: prescriptionMethod === 'upload' ? prescriptionFile : null
        }
      };

      await cartApi.addWithLens(cartData);
      toast.success('Added to cart with lens configuration');
      navigate('/cart');
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner"></div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <div className="container page-wrapper">
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p>Product not found</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <button onClick={() => navigate(`/product/${productId}`)} className="btn btn-outline btn-sm">
            <FiArrowLeft size={14} /> Back to Product
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Choose Your Lenses</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>{product.title}</p>

            {/* Step Indicator */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              {[1, 2, 3, 4].map((s) => (
                <div key={s} style={{ flex: 1, height: '4px', background: step >= s ? 'var(--primary)' : 'var(--border)', borderRadius: '2px' }} />
              ))}
            </div>

            {/* Step 1: Lens Type */}
            {step === 1 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Select Lens Type</h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {LENS_TYPES.map((lens) => (
                    <div
                      key={lens.id}
                      onClick={() => setSelectedLensType(lens)}
                      className="card"
                      style={{
                        padding: '20px',
                        cursor: 'pointer',
                        border: selectedLensType?.id === lens.id ? '2px solid var(--primary)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>{lens.name}</h3>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{lens.description}</p>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                          +₹{lens.price}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => selectedLensType && setStep(2)}
                  disabled={!selectedLensType}
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: '24px', width: '100%' }}
                >
                  Continue <FiArrowRight size={16} />
                </button>
              </div>
            )}

            {/* Step 2: Lens Material */}
            {step === 2 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Select Lens Material</h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {LENS_MATERIALS.map((material) => (
                    <div
                      key={material.id}
                      onClick={() => setSelectedMaterial(material)}
                      className="card"
                      style={{
                        padding: '20px',
                        cursor: 'pointer',
                        border: selectedMaterial?.id === material.id ? '2px solid var(--primary)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>{material.name}</h3>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{material.description}</p>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                          {material.price > 0 ? `+₹${material.price}` : 'Included'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button onClick={() => setStep(1)} className="btn btn-outline btn-lg">
                    <FiArrowLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => selectedMaterial && setStep(3)}
                    disabled={!selectedMaterial}
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1 }}
                  >
                    Continue <FiArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Lens Coating */}
            {step === 3 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Select Lens Coating</h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {LENS_COATINGS.map((coating) => (
                    <div
                      key={coating.id}
                      onClick={() => setSelectedCoating(coating)}
                      className="card"
                      style={{
                        padding: '20px',
                        cursor: 'pointer',
                        border: selectedCoating?.id === coating.id ? '2px solid var(--primary)' : '2px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>{coating.name}</h3>
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{coating.description}</p>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                          {coating.price > 0 ? `+₹${coating.price}` : 'Included'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button onClick={() => setStep(2)} className="btn btn-outline btn-lg">
                    <FiArrowLeft size={16} /> Back
                  </button>
                  <button
                    onClick={() => selectedCoating && setStep(4)}
                    disabled={!selectedCoating}
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1 }}
                  >
                    Continue <FiArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Prescription */}
            {step === 4 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Enter Prescription</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div
                    onClick={() => setPrescriptionMethod('manual')}
                    className="card"
                    style={{
                      padding: '20px',
                      cursor: 'pointer',
                      border: prescriptionMethod === 'manual' ? '2px solid var(--primary)' : '2px solid transparent',
                      textAlign: 'center'
                    }}
                  >
                    <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Enter Manually</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Type your prescription values</p>
                  </div>
                  <div
                    onClick={() => setPrescriptionMethod('upload')}
                    className="card"
                    style={{
                      padding: '20px',
                      cursor: 'pointer',
                      border: prescriptionMethod === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                      textAlign: 'center'
                    }}
                  >
                    <FiUpload size={32} style={{ marginBottom: '8px' }} />
                    <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Upload Prescription</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Upload image or PDF</p>
                  </div>
                </div>

                {prescriptionMethod === 'manual' && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div className="card" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Right Eye (OD)</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="input-group">
                          <label>Sphere (SPH)</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.rightEye.sphere}
                            onChange={(e) => setPrescription({ ...prescription, rightEye: { ...prescription.rightEye, sphere: e.target.value } })}
                            placeholder="e.g., -2.50"
                          />
                        </div>
                        <div className="input-group">
                          <label>Cylinder (CYL)</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.rightEye.cylinder}
                            onChange={(e) => setPrescription({ ...prescription, rightEye: { ...prescription.rightEye, cylinder: e.target.value } })}
                            placeholder="e.g., -0.75"
                          />
                        </div>
                        <div className="input-group">
                          <label>Axis</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.rightEye.axis}
                            onChange={(e) => setPrescription({ ...prescription, rightEye: { ...prescription.rightEye, axis: e.target.value } })}
                            placeholder="e.g., 180"
                          />
                        </div>
                        <div className="input-group">
                          <label>Addition (ADD)</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.rightEye.addition}
                            onChange={(e) => setPrescription({ ...prescription, rightEye: { ...prescription.rightEye, addition: e.target.value } })}
                            placeholder="e.g., +2.00"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ padding: '20px' }}>
                      <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Left Eye (OS)</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="input-group">
                          <label>Sphere (SPH)</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.leftEye.sphere}
                            onChange={(e) => setPrescription({ ...prescription, leftEye: { ...prescription.leftEye, sphere: e.target.value } })}
                            placeholder="e.g., -2.25"
                          />
                        </div>
                        <div className="input-group">
                          <label>Cylinder (CYL)</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.leftEye.cylinder}
                            onChange={(e) => setPrescription({ ...prescription, leftEye: { ...prescription.leftEye, cylinder: e.target.value } })}
                            placeholder="e.g., -0.50"
                          />
                        </div>
                        <div className="input-group">
                          <label>Axis</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.leftEye.axis}
                            onChange={(e) => setPrescription({ ...prescription, leftEye: { ...prescription.leftEye, axis: e.target.value } })}
                            placeholder="e.g., 175"
                          />
                        </div>
                        <div className="input-group">
                          <label>Addition (ADD)</label>
                          <input
                            type="text"
                            className="input"
                            value={prescription.leftEye.addition}
                            onChange={(e) => setPrescription({ ...prescription, leftEye: { ...prescription.leftEye, addition: e.target.value } })}
                            placeholder="e.g., +2.00"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Pupillary Distance (PD)</label>
                      <input
                        type="text"
                        className="input"
                        value={prescription.pd}
                        onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })}
                        placeholder="e.g., 62"
                      />
                    </div>
                  </div>
                )}

                {prescriptionMethod === 'upload' && (
                  <div className="card" style={{ padding: '20px' }}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPrescriptionFile(e.target.files[0])}
                      className="input"
                    />
                    {prescriptionFile && (
                      <p style={{ marginTop: '12px', color: 'var(--success)' }}>
                        <FiCheck size={16} /> {prescriptionFile.name} uploaded
                      </p>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button onClick={() => setStep(3)} className="btn btn-outline btn-lg">
                    <FiArrowLeft size={16} /> Back
                  </button>
                  <button
                    onClick={handleAddToCart}
                    className="btn btn-primary btn-lg"
                    style={{ flex: 1 }}
                  >
                    <FiCheck size={16} /> Add to Cart
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div>
            <div className="card" style={{ padding: '24px', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>Order Summary</h3>
              
              <img
                src={product.images?.[0] || '/placeholder.png'}
                alt={product.title}
                style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: 'var(--radius)', marginBottom: '16px' }}
              />

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Frame Price</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>₹{product.price}</div>
              </div>

              {selectedLensType && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Lens Type</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedLensType.name} (+₹{selectedLensType.price})</div>
                </div>
              )}

              {selectedMaterial && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Material</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedMaterial.name} {selectedMaterial.price > 0 && `(+₹${selectedMaterial.price})`}</div>
                </div>
              )}

              {selectedCoating && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Coating</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedCoating.name} {selectedCoating.price > 0 && `(+₹${selectedCoating.price})`}</div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--primary)' }}>₹{calculateTotal()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 968px) {
            .container > div {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
      <Footer />
    </>
  );
};

export default LensSelection;
