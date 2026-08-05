import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiSearch, FiCheck, FiX, FiTrash2 } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const ManageSellers = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef(null);

  const fetchSellers = useCallback(async (searchQuery = '', statusFilter = 'all', pageNum = 1) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await adminApi.getSellers(params);
      setSellers(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSellers(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSellers(search, filter, 1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, filter, fetchSellers]);

  const handleVerify = async (id, status) => {
    try { await adminApi.verifySeller(id, status); toast.success(`Seller ${status}`); fetchSellers(search, filter, page); } catch (err) { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this seller?')) return;
    try { await adminApi.deleteSeller(id); toast.success('Seller deleted'); fetchSellers(search, filter, page); } catch (err) { toast.error('Failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Manage Sellers</h1>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['all', 'pending', 'verified', 'rejected'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '13px', border: `1px solid ${filter === s ? 'var(--primary)' : 'var(--border)'}`, background: filter === s ? 'var(--primary-light)' : '#fff', color: filter === s ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>
          <div style={{ position: 'relative', maxWidth: '500px', marginBottom: '20px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input className="input" placeholder="Search by name, email, phone, store, seller ID, GST, PAN..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '38px' }} />
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <>
              <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['Business', 'Email', 'Phone', 'Seller ID', 'Status', 'Actions'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {sellers.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontSize: '14px' }}>No sellers found</td></tr>
                    ) : sellers.map((seller) => (
                      <tr key={seller._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}><div style={{ fontSize: '14px', fontWeight: 500 }}>{seller.businessName}</div><div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{seller.ownerName}</div></td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{seller.email}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{seller.phone}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{seller.sellerId || '-'}</td>
                        <td style={{ padding: '12px 16px' }}><span className={`badge ${seller.status === 'verified' ? 'badge-success' : seller.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>{seller.status}</span></td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {seller.status !== 'verified' && <button onClick={() => handleVerify(seller._id, 'verified')} className="btn btn-success btn-sm"><FiCheck size={12} /></button>}
                            {seller.status !== 'rejected' && <button onClick={() => handleVerify(seller._id, 'rejected')} className="btn btn-danger btn-sm"><FiX size={12} /></button>}
                            <button onClick={() => handleDelete(seller._id)} className="btn btn-outline btn-sm"><FiTrash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                  <button onClick={() => { setPage(p => Math.max(1, p - 1)); fetchSellers(search, filter, p - 1); }} disabled={page === 1} className="btn btn-outline btn-sm">Previous</button>
                  <span style={{ padding: '6px 12px', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                  <button onClick={() => { setPage(p => p + 1); fetchSellers(search, filter, p + 1); }} disabled={page === totalPages} className="btn btn-outline btn-sm">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageSellers;
