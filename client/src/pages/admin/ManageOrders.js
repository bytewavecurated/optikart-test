import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw } from 'react-icons/fi';
import { admin as adminApi } from '../../services/api';
import { listOf } from '../../services/apiResponse.js';
import { FILTER_STATUSES } from '../../utils/orderStatuses.js';
import {
  PageHead,
  ListToolbar,
  ListPagination,
  StatusPill,
  TableSkeleton,
  EmptyState,
  useListQuery,
} from '../../components/admin/AdminListKit.jsx';

const STATUS_TONE = {
  pending: 'warn',
  confirmed: 'brand',
  packed: 'brand',
  picked_up: 'brand',
  in_transit: 'brand',
  out_for_delivery: 'brand',
  delivered: 'ok',
  cancelled: 'bad',
  return_requested: 'warn',
  returned: 'idle',
};

/**
 * Orders is the busiest admin table, and until the list-query server facade
 * existed this page could only filter what had already been fetched: the
 * search box matched the current page's rows, the status chips reloaded the
 * WHOLE collection, and the header counted those client-filtered rows as if
 * they were the population. Every control now composes server params
 * (status enum whitelist, escaped search across order number + buyer + shop,
 * placed-window, real pages) and the number shown next to the title is the
 * true total.
 */
const ManageOrders = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [refreshKey, setRefreshKey] = useState(0);
  const list = useListQuery({ limit: 20, sort: '' });
  const last = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = list.params();
      last.current = JSON.stringify(params);
      const res = await adminApi.getOrders(params);
      const d = res.data || {};
      setRows(listOf(d));
      setMeta({ total: d.total ?? 0, page: d.page ?? 1, totalPages: d.totalPages ?? 1 });
    } catch (err) {
      console.error(err);
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
  const td = { padding: '12px 16px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)' };

  const filteredActive = !!(list.q.search || list.q.status || list.q.from || list.q.windowDays);

  return (
    <div>
      <PageHead
        title="Orders"
        subtitle={`${meta.total.toLocaleString()} order${meta.total === 1 ? '' : 's'}${filteredActive ? ' match the current filters' : ''}`}
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
        searchPlaceholder="Order number, customer, email, or shop…"
        statuses={FILTER_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
        status={list.q.status}
        onStatus={(v) => list.set({ status: v })}
        sortOptions={[
          { value: '', label: 'Newest placed' },
          { value: 'updated', label: 'Recently updated' },
          { value: 'amount', label: 'Largest total' },
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
            title={filteredActive ? 'No orders match those filters' : 'No orders yet'}
            hint={
              filteredActive
                ? 'Try a wider window, or clear the status filter.'
                : 'Customer checkouts land here in real time.'
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
                <th style={th()}>Order</th>
                <th style={th()}>Customer</th>
                <th style={th()}>Shop</th>
                <th style={th()}>Items</th>
                <th style={th({ textAlign: 'right' })}>Total</th>
                <th style={th()}>Status</th>
                <th style={th()}>Placed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const items = o.items || [];
                const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
                return (
                  <tr key={o._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/orders/${o._id}`)}>
                    <td style={td}>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {o.orderNumber || (o._id || '').slice(-8)}
                      </span>
                      {o.paymentMode ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 11,
                            color: 'var(--text-light)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {o.paymentMode}
                        </span>
                      ) : null}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'block', fontWeight: 600 }}>
                        {o.user?.name || o.address?.fullName || 'Removed account'}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-light)' }}>{o.user?.email || ''}</span>
                    </td>
                    <td style={{ ...td, maxWidth: 160 }}>{o.seller?.storeName || 'Removed shop'}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>
                      {items.length
                        ? `${items.length} line${items.length === 1 ? '' : 's'} · ${items.reduce((s, i) => s + (i.quantity || 1), 0)} pcs`
                        : '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {money(o.totalAmount ?? o.total)}
                    </td>
                    <td style={td}>
                      <StatusPill tone={STATUS_TONE[o.orderStatus] || 'idle'}>
                        {String(o.orderStatus || '').replace(/_/g, ' ')}
                      </StatusPill>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(o.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
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
            unit="orders"
          />
        )}
      </div>
    </div>
  );
};

export default ManageOrders;
