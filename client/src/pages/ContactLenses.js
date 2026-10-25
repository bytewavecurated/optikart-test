import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { products as productsApi } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';

const ContactLenses = () => {
  const navigate = useNavigate();
  const [lenses, setLenses] = useState([]);
  const [solutions, setSolutions] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [filters, setFilters] = useState({
    power: '',
    brand: '',
    boxQuantity: ''
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await productsApi.getAll({ category: 'contactlenses', limit: 100 });
      const products = res.data.data || [];
      
      setLenses(products.filter(p => p.subCategory === 'lenses'));
      setSolutions(products.filter(p => p.subCategory === 'solutions'));
      setAccessories(products.filter(p => p.subCategory === 'accessories'));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const lensTypes = [
    { id: 'distance', name: 'Distance Power', description: 'For nearsightedness & farsightedness', icon: '👁️' },
    { id: 'toric', name: 'Toric/Cylindrical', description: 'For astigmatism correction', icon: '🔄' },
    { id: 'multifocal', name: 'Multi-focal', description: 'For presbyopia (reading + distance)', icon: '📏' },
    { id: 'color-zero', name: 'Color Lenses (Zero Power)', description: 'Cosmetic colored lenses', icon: '🎨' },
    { id: 'color-power', name: 'Color Lenses (With Power)', description: 'Colored lenses with prescription', icon: '✨' }
  ];

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    // In a real implementation, this would navigate to a detailed selection flow
    toast.success(`Selected: ${lensTypes.find(t => t.id === typeId)?.name}`);
  };

  const filteredLenses = lenses.filter(lens => {
    if (filters.power && lens.powerType !== filters.power) return false;
    if (filters.brand && lens.brand !== filters.brand) return false;
    if (filters.boxQuantity && lens.boxQuantity !== filters.boxQuantity) return false;
    return true;
  });

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

  return (
    <>
      <Header />
      <div className="container page-wrapper">
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Contact Lenses</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Choose the right contact lenses for your needs</p>
        </div>

        {/* Lens Types */}
        {!selectedType && (
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Select Lens Type</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              {lensTypes.map((type) => (
                <div
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className="card"
                  style={{ padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>{type.icon}</div>
                  <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', marginBottom: '8px', textAlign: 'center' }}>
                    {type.name}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {type.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distance Power Selection Flow */}
        {selectedType === 'distance' && (
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)' }}>Distance Power Lenses</h2>
              <button onClick={() => setSelectedType(null)} className="btn btn-outline">
                Back to Types
              </button>
            </div>

            {/* Power Selection */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Do you have power?</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div
                  onClick={() => setFilters({ ...filters, power: 'with-power' })}
                  className="card"
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    border: filters.power === 'with-power' ? '2px solid var(--primary)' : '2px solid transparent'
                  }}
                >
                  <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>With Power</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>I have a prescription</p>
                </div>
                <div
                  onClick={() => setFilters({ ...filters, power: 'zero-power' })}
                  className="card"
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    border: filters.power === 'zero-power' ? '2px solid var(--primary)' : '2px solid transparent'
                  }}
                >
                  <h4 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Zero Power</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No prescription needed</p>
                </div>
              </div>
            </div>

            {/* Prescription Entry */}
            {filters.power === 'with-power' && (
              <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Enter Your Prescription</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <h4 style={{ marginBottom: '12px' }}>Right Eye (OD)</h4>
                    <div className="input-group">
                      <label>Sphere (SPH)</label>
                      <input type="text" className="input" placeholder="e.g., -2.50" />
                    </div>
                    <div className="input-group">
                      <label>Cylinder (CYL)</label>
                      <input type="text" className="input" placeholder="e.g., -0.75" />
                    </div>
                    <div className="input-group">
                      <label>Axis</label>
                      <input type="text" className="input" placeholder="e.g., 180" />
                    </div>
                  </div>
                  <div>
                    <h4 style={{ marginBottom: '12px' }}>Left Eye (OS)</h4>
                    <div className="input-group">
                      <label>Sphere (SPH)</label>
                      <input type="text" className="input" placeholder="e.g., -2.25" />
                    </div>
                    <div className="input-group">
                      <label>Cylinder (CYL)</label>
                      <input type="text" className="input" placeholder="e.g., -0.50" />
                    </div>
                    <div className="input-group">
                      <label>Axis</label>
                      <input type="text" className="input" placeholder="e.g., 175" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Box Quantity Selection */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Box Quantity</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {['30 lenses', '6 lenses', '90 lenses'].map((qty) => (
                  <div
                    key={qty}
                    onClick={() => setFilters({ ...filters, boxQuantity: qty })}
                    className="card"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      border: filters.boxQuantity === qty ? '2px solid var(--primary)' : '2px solid transparent'
                    }}
                  >
                    <h4 style={{ fontFamily: 'var(--font-heading)' }}>{qty}</h4>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Brand</h3>
              <select
                className="input"
                value={filters.brand}
                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              >
                <option value="">All Brands</option>
                <option value="Acuvue">Acuvue</option>
                <option value="Bausch+Lomb">Bausch+Lomb</option>
                <option value="CooperVision">CooperVision</option>
                <option value="Alcon">Alcon</option>
              </select>
            </div>

            {/* Product List */}
            {filteredLenses.length > 0 && (
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Available Lenses ({filteredLenses.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {filteredLenses.map((lens) => (
                    <Link key={lens._id} to={`/product/${lens._id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <img
                        src={lens.images?.[0] || '/placeholder.png'}
                        alt={lens.title}
                        style={{ width: '100%', height: '250px', objectFit: 'cover' }}
                      />
                      <div style={{ padding: '16px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{lens.brand}</p>
                        <h4 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{lens.title}</h4>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          {lens.boxQuantity} per box
                        </p>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                          ₹{lens.price}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Solutions Section */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Lens Solutions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {solutions.map((solution) => (
              <Link key={solution._id} to={`/product/${solution._id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <img
                  src={solution.images?.[0] || '/placeholder.png'}
                  alt={solution.title}
                  style={{ width: '100%', height: '250px', objectFit: 'cover' }}
                />
                <div style={{ padding: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{solution.brand}</p>
                  <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{solution.title}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {solution.quantity}
                  </p>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                    ₹{solution.price}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Accessories Section */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>Accessories</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {accessories.map((accessory) => (
              <Link key={accessory._id} to={`/product/${accessory._id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <img
                  src={accessory.images?.[0] || '/placeholder.png'}
                  alt={accessory.title}
                  style={{ width: '100%', height: '250px', objectFit: 'cover' }}
                />
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>{accessory.title}</h3>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                    ₹{accessory.price}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ContactLenses;
