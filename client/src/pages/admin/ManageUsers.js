import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiSearch, FiTrash2 } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef(null);

  const fetchUsers = useCallback(async (searchQuery = '', pageNum = 1) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: 20 };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await adminApi.getUsers(params);
      setUsers(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers(search, 1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, fetchUsers]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try { await adminApi.deleteUser(id); toast.success('User deleted'); fetchUsers(search, page); } catch (err) { toast.error('Failed'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Manage Users</h1>
          <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '20px' }}>
            <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input className="input" placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '38px' }} />
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div> : (
            <>
              <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>{['User', 'Email', 'Phone', 'Joined', 'Actions'].map((h) => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontSize: '14px' }}>No users found</td></tr>
                    ) : users.map((user) => (
                      <tr key={user._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>{(user.name || 'U')[0].toUpperCase()}</div><span style={{ fontSize: '14px', fontWeight: 500 }}>{user.name}</span></div></td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{user.email}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{user.phone || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px' }}><button onClick={() => handleDelete(user._id)} className="btn btn-danger btn-sm"><FiTrash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                  <button onClick={() => { setPage(p => Math.max(1, p - 1)); fetchUsers(search, page - 1); }} disabled={page === 1} className="btn btn-outline btn-sm">Previous</button>
                  <span style={{ padding: '6px 12px', fontSize: '14px' }}>Page {page} of {totalPages}</span>
                  <button onClick={() => { setPage(p => p + 1); fetchUsers(search, page + 1); }} disabled={page === totalPages} className="btn btn-outline btn-sm">Next</button>
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

export default ManageUsers;
