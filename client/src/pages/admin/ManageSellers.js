import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiEye, FiTrash2, FiRefreshCw, FiShield } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import toast from 'react-hot-toast';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';
import {
  PageHead,
  ListToolbar,
  ListPagination,
  StatusPill,
  TableSkeleton,
  EmptyState,
  useListQuery,
} from '../../components/admin/AdminListKit.jsx';

/**
 * Shops, using the model's real truth. This page used to render
 * `seller.businessName` and `seller.status` - neither of which exists on
 * models/Seller.js - so every row's name came out blank, the 'verified'
 * badge was permanently amber (undefined === 'verified' is never true),
 * and the Verify action showed on already-verified shops whose click just
 * re-ran it. What is real (storeName, name, isVerified/isActive/isBanned,
 * the verified timestamp the server also writes) now drives both the
 * columns and the status chips, and the filters are server-side like every
 * other admin page.
 */
const ManageSellers = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [refreshKey, setRefreshKey] = useState(0);
  const list = useListQuery({ limit: 20 });
  const last = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = list.params();
      last.current = JSON.stringify(params);
      const res = await adminApi.getSellers(params);
      const d = res.data || {};
      setRows(listOf(d));
      setMeta({ total: d.total ?? 0, page: d.page ?? 1, totalPages: d.totalPages ?? 1 });
    } catch (error) {
      console.error(error);
      toast.error('Sellers could not be listed');
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify(list.params()) !== last.current) setRefreshKey((k) => k + 1);
    }, 320);
    return () => clearTimeout(t);
  }, [list.q]);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async (seller) => {
    if (!window.confirm(`Verify ${seller.storeName}? This approves the shop for live listings.`)) return;
    try {
      await adminApi.verifySeller(seller._id, 'approved');
      toast.success('Seller verified');
      load();
    } catch (error) {
      toastError(error, 'Failed');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Deactivate this shop? Existing orders are untouched.')) return;
    try {
      await adminApi.deleteSeller(id);
      toast.success('Seller deactivated');
      load();
    } catch (error) {
      toastError(error, 'Failed');
    }
  };

  const badge = (s) =>
    s.isBanned ? (
      <StatusPill tone="bad">Banned</StatusPill>
    ) : s.isActive === false ? (
      <StatusPill tone="idle">Inactive</StatusPill>
    ) : s.isVerified ? (
      <StatusPill tone="ok">Verified</StatusPill>
    ) : (
      <StatusPill tone="warn">Pending review</StatusPill>
    );

  const th = (extra = {}) => ({
    padding: '11px 16px',
    textAlign: 'left',
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: 'var(--text-light)',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    ...extra,
  });
  const td = { padding: '13px 16px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)' };
  const filteredActive = !!(list.q.search || list.q.status || list.q.from || list.q.windowDays);

  return (
    <div>
      <PageHead
        title="Sellers"
        subtitle={`${meta.total.toLocaleString()} shop${meta.total === 1 ? '' : 's'}${filteredActive ? ' matching filters' : ''}`}
        actions={
          <button className="btn btn-outline btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <FiRefreshCw size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
            Refresh
          </button>
        }
      />

      <ListToolbar
        search={list.q.search}
        onSearch={(v) => list.set({ search: v })}
        searchPlaceholder="Store, owner, email, phone, GST, PAN or OPT- code…"
        statuses={[
          { value: 'verified', label: 'Verified' },
          { value: 'pending', label: 'Pending review' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'banned', label: 'Banned' },
        ]}
        status={list.q.status}
        onStatus={(v) => list.set({ status: v })}
        sortOptions={[
          { value: '', label: 'Newest first' },
          { value: 'storeName', label: 'Store A→Z' },
          { value: 'rating', label: 'Top rated' },
          { value: 'sales', label: 'Most sales' },
        ]}
        sort={list.q.sort}
        onSort={(v) => list.set({ sort: v })}
        showWindow
        windowDays={list.q.windowDays}
        onWindow={(w) => list.set({ windowDays: w })}
        customFrom={list.q.from}
        customTo={list.q.to}
        onCustomRange={(from, to) => list.set({ from, to, windowDays: null })}
      />

      <div className="card" style={{ overflow: 'auto' }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: '8px 16px' }}>
            <TableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={filteredActive ? 'No shops match those filters' : 'No shops registered yet'}
            hint={
              filteredActive
                ? 'Widen the window or clear the status filter.'
                : 'Shop sign-ups appear here for verification.'
            }
            action={
              filteredActive ? (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => list.set({ search: '', status: '', windowDays: null, from: '', to: '' })}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th()}>Shop</th>
                <th style={th()}>Owner</th>
                <th style={th()}>Contact</th>
                <th style={th()}>Seller ID</th>
                <th style={th()}>Tax IDs</th>
                <th style={th()}>Status</th>
                <th style={th({ textAlign: 'right' })}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id}>
                  <td style={td}>
                    <span style={{ fontWeight: 700 }}>{s.storeName || '—'}</span>
                    {s.city ? (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-light)' }}>{s.city}</span>
                    ) : null}
                  </td>
                  <td style={td}>{s.name || '—'}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'block' }}>{s.email}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{s.phone}</span>
                  </td>
                  <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{s.sellerId || '—'}</td>
                  <td style={{ ...td, fontSize: 11.5, color: 'var(--text-light)' }}>
                    <span style={{ display: 'block' }}>{s.gstNumber || 'GST —'}</span>
                    <span style={{ display: 'block' }}>{s.panNumber || 'PAN —'}</span>
                  </td>
                  <td style={td}>{badge(s)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        title="Open shop profile"
                        onClick={() => navigate(`/admin/sellers/${s._id}`)}
                      >
                        <FiEye size={13} />
                      </button>
                      {!s.isVerified && !s.isBanned && s.isActive !== false && (
                        <button
                          className="btn btn-outline btn-sm"
                          title="Approve for listings"
                          style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => verify(s)}
                        >
                          <FiCheck size={13} /> Verify
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        title="Deactivate shop"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={() => remove(s._id)}
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length > 0 && (
          <ListPagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={20}
            onPage={(p) => list.set({ page: p })}
            unit="shops"
          />
        )}
      </div>
    </div>
  );
};

export default ManageSellers;
