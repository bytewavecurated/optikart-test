import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiSearch,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiFilter,
  FiX,
} from 'react-icons/fi';

/**
 * The admin list kit: one professional language for every table page.
 *
 * WHY A KIT AND NOT PER-PAGE MARKUP: twelve admin screens had grown twelve
 * slightly different table headers, twelve search boxes (some server-side,
 * some client-side over only page 1 - a filter that lies), and pagination
 * that said "Page 1" instead of showing where you are. One component means
 * one behavior, and the behavior now matches what the server actually
 * supports: search/sort/status/window/pagination are QUERY PARAMETERS, so
 * they filter the whole population, not whatever happened to load.
 *
 * The visual target is the Cash Reconciliation page (the one operators
 * already like): clear page header, compact controls, calm pills, and real
 * numbers where decorative ones used to sit.
 */

export function PageHead({ title, subtitle, actions, backTo }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.015em' }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 720 }}>{subtitle}</p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {backTo !== undefined && (
          <button
            onClick={() => window.history.back()}
            className="btn btn-outline btn-sm"
            title="Go back"
            aria-label="Go back"
            style={{ minWidth: 0 }}
          >
            <FiChevronLeft size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> Back
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

const WINDOW_PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  statuses,
  status,
  onStatus,
  sortOptions,
  sort,
  onSort,
  showWindow,
  windowDays,
  onWindow,
  customFrom,
  customTo,
  onCustomRange,
  right,
}) {
  const debouncedRef = useRef(null);
  const [localSearch, setLocalSearch] = useState(search || '');

  useEffect(() => {
    if (search === localSearch) return;
    setLocalSearch(search);
  }, [search]);

  const emitSearch = (value) => {
    setLocalSearch(value);
    clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => onSearch(value.trim()), 350);
  };

  useEffect(() => () => clearTimeout(debouncedRef.current), []);

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '12px 14px',
        background: 'var(--bg-white)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        marginBottom: 14,
      }}
    >
      <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 420 }}>
        <FiSearch
          size={15}
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-light)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={localSearch}
          onChange={(e) => emitSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search"
          style={{
            width: '100%',
            padding: '9px 30px 9px 34px',
            border: '1px solid var(--border)',
            borderRadius: 999,
            fontSize: 13,
            background: 'var(--bg-secondary)',
          }}
        />
        {localSearch && (
          <button
            onClick={() => emitSearch('')}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-light)',
              display: 'flex',
            }}
          >
            <FiX size={14} />
          </button>
        )}
      </div>

      {statuses && (
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Status filter"
          className="input"
          style={{ width: 'auto', minWidth: 130, padding: '8px 10px', fontSize: 13, borderRadius: 999 }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value || 'all'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {sortOptions && (
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          aria-label="Sort by"
          className="input"
          style={{ width: 'auto', minWidth: 120, padding: '8px 10px', fontSize: 13, borderRadius: 999 }}
        >
          {sortOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {showWindow && (
        <span role="group" aria-label="Time window" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {WINDOW_PRESETS.map((preset) => {
            const active = windowDays === preset.days;
            return (
              <button
                key={preset.label}
                onClick={() => onWindow(active ? null : preset.days)}
                aria-pressed={active}
                style={{
                  padding: '7px 11px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            );
          })}
          <input
            type="date"
            aria-label="From date"
            value={customFrom || ''}
            onChange={(e) => onCustomRange && onCustomRange(e.target.value, customTo)}
            style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
          />
          <span style={{ alignSelf: 'center', color: 'var(--text-light)', fontSize: 12 }}>→</span>
          <input
            type="date"
            aria-label="To date"
            value={customTo || ''}
            onChange={(e) => onCustomRange && onCustomRange(customFrom, e.target.value)}
            style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
          />
        </span>
      )}

      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>{right}</span>
    </div>
  );
}

/**
 * Pagination as numbered pills. The old control said "Page 1" with Prev/Next
 * like a PDF viewer; ops live inside long tables, and the numbers are the
 * information (Lenskart-style: 1 2 3 … last, current filled). Middle pages
 * collapse with a gap so a 400-page result never renders 400 buttons.
 */
export function ListPagination({ page, totalPages, total, limit, onPage, unit = 'rows' }) {
  if (!totalPages || totalPages <= 1) {
    return total ? (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 12,
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        <span>
          Showing {Math.min(limit || total, total)} of {total.toLocaleString()} {unit}
        </span>
      </div>
    ) : null;
  }

  const nums = useMemo(() => {
    const items = [];
    const push = (n) => items.push(n);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
      return items;
    }
    push(1);
    if (page > 3) push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
    if (page < totalPages - 2) push('…');
    push(totalPages);
    return items;
  }, [page, totalPages]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 14,
      }}
    >
      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        Page {page} of {totalPages.toLocaleString()} · {total.toLocaleString()} {unit}
      </span>
      <div role="navigation" aria-label="Pagination" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPage(1)}
          className="pg-btn"
          style={{ opacity: page <= 1 ? 0.35 : 1 }}
        >
          <FiChevronsLeft size={14} />
        </button>
        <button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="pg-btn"
          style={{ opacity: page <= 1 ? 0.35 : 1 }}
        >
          <FiChevronLeft size={14} />
        </button>
        {nums.map((n, idx) =>
          n === '…' ? (
            <span key={`g-${idx}`} style={{ color: 'var(--text-light)', fontSize: 13, padding: '0 2px' }}>
              …
            </span>
          ) : (
            <button
              key={n}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => onPage(n)}
              className="pg-btn"
              style={
                n === page ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : undefined
              }
            >
              {n}
            </button>
          )
        )}
        <button
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="pg-btn"
        >
          <FiChevronRight size={14} />
        </button>
        <button
          aria-label="Last page"
          disabled={page >= totalPages}
          onClick={() => onPage(totalPages)}
          className="pg-btn"
        >
          <FiChevronsRight size={14} />
        </button>
      </div>
      <style>{`
        .pg-btn {
          min-width: 34px; height: 34px; padding: 0 8px; border-radius: 9px;
          border: 1px solid var(--border); background: var(--bg-white); color: var(--text-primary);
          font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
          transition: border-color .15s ease, background .15s ease;
        }
        .pg-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .pg-btn:disabled { cursor: default; }
      `}</style>
    </div>
  );
}

export function StatusPill({ tone, children }) {
  const colors = {
    ok: { bg: 'rgba(16,185,129,.12)', fg: '#047857' },
    warn: { bg: 'rgba(245,158,11,.14)', fg: '#92400e' },
    bad: { bg: 'rgba(239,68,68,.12)', fg: '#b91c1c' },
    idle: { bg: 'var(--bg-secondary)', fg: 'var(--text-secondary)' },
    brand: { bg: 'var(--brand-tint)', fg: 'var(--brand)' },
  }[tone || 'idle'];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '.01em',
        background: colors.bg,
        color: colors.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="sk"
          style={{ height: 40, borderRadius: 10, background: 'var(--bg-secondary)', opacity: 1 - i * 0.11 }}
        />
      ))}
    </div>
  );
}

/**
 * useListQuery: the small state machine every page shares. Query state mirrors
 * to URL-free internal state (admin pages don't need deep links today); the
 * `params()` it returns is the ONLY thing callers put into the API - so the
 * "one source of truth for filters" property holds wherever the hook is used.
 */
export function useListQuery({
  search: initialSearch = '',
  status = '',
  sort = '',
  windowDays = null,
  from = '',
  to = '',
  limit = 20,
} = {}) {
  const [q, setQ] = useState({ search: initialSearch, status, sort, windowDays, from, to, page: 1, limit });
  const set = (patch) =>
    setQ((cur) => {
      const next = { ...cur, ...patch };
      if (patch.windowDays !== undefined || patch.from !== undefined || patch.to !== undefined) {
        const w = patch.windowDays;
        if (w) {
          const d = new Date();
          next.to = toISO(d);
          next.from = toISO(new Date(d.getTime() - w * 86400000));
        } else if (w !== undefined && !w) {
          next.from = patch.from !== undefined ? patch.from : '';
          next.to = patch.to !== undefined ? patch.to : '';
        } else if (patch.windowDays === undefined) {
          /* custom dates win over a stale preset chip */
        }
      }
      if (
        'search' in patch ||
        'status' in patch ||
        'sort' in patch ||
        'windowDays' in patch ||
        'from' in patch ||
        'to' in patch
      )
        next.page = 1;
      return next;
    });
  const params = () => {
    const out = { page: q.page, limit: q.limit };
    if (q.search) out.search = q.search;
    if (q.status) out.status = q.status;
    if (q.sort) out.sort = q.sort;
    if (q.from) out.from = q.from;
    if (q.to) out.to = q.to;
    return out;
  };
  return { q, set, params };
}

const toISO = (d) => new Date(d).toISOString();

export function EmptyState({ icon, title, hint, action } = {}) {
  return (
    <div style={{ textAlign: 'center', padding: '34px 18px', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.65 }}>{icon || <FiFilter size={26} />}</div>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{title || 'Nothing here yet'}</div>
      {hint && <div style={{ marginTop: 6, fontSize: 13, maxWidth: 420, marginInline: 'auto' }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
