import React, { useState, useEffect } from 'react';
import SupplyDeclaration from '../../components/SupplyDeclaration';
import { useNavigate } from 'react-router-dom';
import { FiPackage, FiToggleLeft, FiToggleRight, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { toastError } from '../../services/errors.js';

const ManufacturerSellerDashboard = () => {
  const [availableProducts, setAvailableProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { manufacturerSeller, manufacturerSellerLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAvailableProducts();
    fetchMyProducts();
  }, []);

  const fetchAvailableProducts = async () => {
    try {
      const response = await api.get('/manufacturer-seller/available-products');
      setAvailableProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching available products:', error);
    }
  };

  const fetchMyProducts = async () => {
    try {
      const response = await api.get('/manufacturer-seller/products');
      setMyProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching my products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    manufacturerSellerLogout();
    navigate('/manufacturer-seller/login');
  };

  /*
   * Listing a brand frame here is a claim about supply, so the claim has to be
   * stated before anything is sent: the brand confirms it supplied this shop
   * and the platform verifies the listing after that. Until both have, the copy
   * is not visible to customers, which is the point - a shop cannot put a
   * brand's frames in front of buyers on an unchecked assertion.
   *
   * Toggling off now pauses. It used to delete the listing document, taking the
   * price history, the variant stock ledger and any order line pointing at it
   * with it, and a shop that sold out for a week lost the record of having
   * stocked the frame at all.
   */
  const [declaring, setDeclaring] = useState(null);
  const [proof, setProof] = useState({ kind: '', reference: '', note: '' });
  const [busyId, setBusyId] = useState('');

  const handleToggleProduct = async (productId, productData) => {
    const existing = myProducts.find((p) => p.manufacturerProduct === productId);

    if (existing) {
      try {
        setBusyId(productId);
        const res = await api.post(`/manufacturer-seller/products/${productId}/toggle`, {});
        toast.info(res.data?.message || 'Listing paused. Your price and stock are kept.');
        await fetchMyProducts();
      } catch (error) {
        toastError(error, 'The listing could not be paused.');
      } finally {
        setBusyId('');
      }
      return;
    }

    setDeclaring({ productId, productData });
    setProof({ kind: '', reference: '', note: '' });
  };

  const submitDeclaration = async () => {
    const { productId, productData } = declaring;
    try {
      setBusyId(productId);
      const res = await api.post(`/manufacturer-seller/products/${productId}/toggle`, {
        price: productData.price,
        stock: 100,
        colors: productData.colors,
        sizes: productData.sizes,
        proofKind: proof.kind,
        proofReference: proof.reference,
        proofNote: proof.note
      });
      toast.success(res.data?.message || 'Sent to the brand for approval.');
      setDeclaring(null);
      await fetchMyProducts();
    } catch (error) {
      // A refused declaration keeps the form open: the shop has already typed
      // the reference, and losing it over a validation message is its own bug.
      toastError(error, 'The declaration was not accepted.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const myProductIds = myProducts.map(p => p.manufacturerProduct);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-white)', boxShadow: 'var(--shadow-sm)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>My Inventory</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            {manufacturerSeller?.storeName} | ID: {manufacturerSeller?.manufacturerSellerId}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>{manufacturerSeller?.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{manufacturerSeller?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', background: 'var(--danger)', color: 'var(--text-white)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--brand-tint)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Available Products</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{availableProducts.length}</h3>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--success-light)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <FiPackage size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>My Products</p>
                <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{myProducts.length}</h3>
              </div>
            </div>
          </div>
        </div>

        {declaring && (
          <SupplyDeclaration
            value={proof}
            onChange={setProof}
            productName={declaring.productData?.title}
            busy={!!busyId}
            onSubmit={submitDeclaration}
            onCancel={() => setDeclaring(null)}
          />
        )}

        {/* Available Products from Manufacturer */}
        <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius)', padding: '24px', boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', color: 'var(--text-primary)' }}>
            Available Products from Manufacturer
          </h2>

          {availableProducts.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>No products available from your manufacturer yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {availableProducts.map((product) => {
                const existing = myProducts.find((x) => String(x.manufacturerProduct || '') === String(product._id));
                const isInInventory = !!existing || myProductIds.includes(product._id);
                const listingState = existing?.listing?.state;
                const stateLabel = {
                  live: 'Live in your store',
                  paused: 'Paused by you',
                  awaiting_manufacturer: 'Waiting on the brand',
                  awaiting_admin: 'Waiting on OptiKart',
                  rejected: 'Refused by the brand'
                }[listingState] || (isInInventory ? 'Listed' : 'Not listed');
                
                return (
                  <div key={product._id} style={{ background: 'var(--bg-page)', borderRadius: 'var(--radius)', padding: '16px', border: isInInventory ? '2px solid var(--success)' : '2px solid var(--border)' }}>
                    {product.images?.[0] && (
                      <img 
                        src={product.images[0]} 
                        alt={product.title} 
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '12px' }} 
                      />
                    )}
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>{product.title}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Brand: {product.brand}</p>
                    <p style={{ fontSize: 12, marginBottom: '8px', color: existing ? 'var(--primary)' : 'var(--text-secondary)' }}>
                      {stateLabel}
                      {listingState && listingState !== 'live' ? ' - customers cannot buy it yet' : ''}
                    </p>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>₹{product.price}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Colors: {product.colors?.map(c => c.name).join(', ') || 'N/A'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Sizes: {product.sizes?.join(', ') || 'N/A'}
                    </p>
                    <button
                      onClick={() => handleToggleProduct(product._id, product)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: existing ? 'var(--danger)' : 'var(--success)',
                        color: 'var(--text-white)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontWeight: '600'
                      }}
                    >
                      {isInInventory ? (
                        <>
                          <FiToggleRight size={20} /> Remove from Inventory
                        </>
                      ) : (
                        <>
                          <FiToggleLeft size={20} /> Add to Inventory
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ManufacturerSellerDashboard;
