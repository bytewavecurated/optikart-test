import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrash2, FiEye, FiShield, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
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
 * Users, as an operations table rather than a screenshot of one:
 * every control below is a SERVER QUERY PARAMETER (search, status, sort,
 * joined-window, page). The previous draft paginated after filtering on the
 * client, which only ever saw whatever page 1 returned - a filter where page
 * 2 is invisible is a filter that lies, and it is exactly what the kit was
 * built to end.
 */
const ManageUsers = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 20 });
  const [refreshKey, setRefreshKey] = useState(0);
  const list = useListQuery({ search: '', limit: 20 });
  const lastParams = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = list.params();
      lastParams.current = JSON.stringify(params);
      const res = await adminApi.getUsers(params);
      const d = res.data || {};
      setRows(listOf(d));
      setMeta({ total: d.total ?? 0, page: d.page ?? 1, totalPages: d.totalPages ?? 1, limit: d.limit ?? 20 });
      if (Array.isArray(d.badFilterParams) && d.badFilterParams.length) {
        d.badFilterParams.forEach((p) => console.warn('[users filter]', p));
      }
    } catch (error) {
      console.error(error);
      toast.error('Users could not be listed');
    } finally {
      setLoading(false);
    }
    // the captured query params come through refreshKey by design: every
    // control change bumps it via the debounce effect below.
  }, [refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify(list.params()) !== lastParams.current) setRefreshKey((k) => k + 1);
    }, 320);
    return () => clearTimeout(t);
  }, [list.q]);

  useEffect(() => {
    load();
  }, [load]);

  const removeUser = async (id) => {
    if (!window.confirm('Deactivate this account? Their orders and history remain.')) return;
    try {
      await adminApi.deleteUser(id);
      toast.success('User deactivated');
      load();
    } catch (error) {
      toastError(error, 'Failed');
    }
  };

  const ban = async (user, kind) => {
    const map = {
      shadow: { isBanned: false, isShadowBanned: true, banReason: 'Shadow-banned by admin' },
      ban: { isBanned: true, isShadowBanned: false, banReason: 'Banned by admin' },
      unban: { isBanned: false, isShadowBanned: false, banReason: '' },
    };
    const labels = { shadow: 'shadow-ban', ban: 'ban', unban: 'unban' };
    if (!window.confirm(`Are you sure you want to ${labels[kind]} ${user.name || user.email}?`)) return;
    try {
      await adminApi.banUser(user._id, map[kind]);
      toast.success(`User ${labels[kind]}ned successfully`);
      load();
    } catch (error) {
      toastError(error, 'Failed to update user status');
    }
  };

  const badge = (u) =>
    u.isBanned ? (
      <StatusPill tone="bad">Banned</StatusPill>
    ) : u.isShadowBanned ? (
      <StatusPill tone="warn">Shadow banned</StatusPill>
    ) : u.isActive === false ? (
      <StatusPill tone="idle">Inactive</StatusPill>
    ) : (
      <StatusPill tone="ok">Active</StatusPill>
    );

  const th = (extra = {}) => ({
    padding: '11px 16px',
    textAlign: 'left',
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: 'var(--text-light)',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    ...extra,
  });
  const td = { padding: '13px 16px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)' };

  const filtered = !!(list.q.search || list.q.status || list.q.from || list.q.windowDays);

  return (
    <div>
      <PageHead
        title="Users"
        subtitle={`${meta.total.toLocaleString()} customer account${meta.total === 1 ? '' : 's'}`}
        actions={
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Reload this view"
          >
            <FiRefreshCw size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
            Refresh
          </button>
        }
      />

      <ListToolbar
        search={list.q.search}
        onSearch={(v) => list.set({ search: v })}
        searchPlaceholder="Search name, email, phone, or USR code…"
        statuses={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive / banned' },
        ]}
        status={list.q.status}
        onStatus={(v) => list.set({ status: v })}
        sortOptions={[
          { value: '', label: 'Newest first' },
          { value: 'name', label: 'Name A→Z' },
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
            title={filtered ? 'No users match those filters' : 'No customer accounts yet'}
            hint={
              filtered
                ? 'Widen the search, or clear the status / joined-window filters.'
                : 'Real sign-ups appear here. Search, filters and pages run on the server, over every account.'
            }
            action={
              filtered ? (
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
                <th style={th()}>User</th>
                <th style={th()}>Email</th>
                <th style={th()}>Phone</th>
                <th style={th()}>Joined</th>
                <th style={th()}>Status</th>
                <th style={th({ textAlign: 'right' })}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--brand-tint)',
                          color: 'var(--brand)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {(u.name || 'U').charAt(0).toUpperCase()}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, display: 'block' }}>{u.name}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-light)' }}>
                          {u.userId || (u._id || '').slice(-8)}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={td}>{u.phone || '—'}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td style={td}>{badge(u)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        title="Open profile"
                        onClick={() => navigate(`/admin/users/${u._id}`)}
                      >
                        <FiEye size={13} />
                      </button>
                      {!u.isBanned && !u.isShadowBanned ? (
                        <>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Shadow ban (quiet throttle)"
                            style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}
                            onClick={() => ban(u, 'shadow')}
                          >
                            <FiEyeOff size={13} />
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Ban account"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => ban(u, 'ban')}
                          >
                            <FiShield size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-outline btn-sm"
                          title="Lift ban"
                          style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                          onClick={() => ban(u, 'unban')}
                        >
                          <FiShield size={13} />
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        title="Deactivate"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={() => removeUser(u._id)}
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
            limit={meta.limit}
            onPage={(p) => list.set({ page: p })}
            unit="users"
          />
        )}
      </div>
    </div>
  );
};

export default ManageUsers;
