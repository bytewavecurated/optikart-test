import React, { useMemo } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/**
 * Storefront pagination as numbers, not words.
 *
 * (The product pages shipped "Page {N}" with two buttons: the shopper could
 * never see where the catalogue went, and on wide result sets the Next button
 * kept working past the end because the page only knew whether the current
 * batch was full. Same property as the admin kit's ListPagination, tuned for
 * a customer-facing rhythm: compact, keyboard- and screen-reader-labelled,
 * and honest about the boundary pages.)
 */
export default function NumberedPages({ page, totalPages = 1, onMove }) {
  const pagesList = useMemo(() => {
    const n = Math.max(1, totalPages);
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const out = [1];
    if (page > 3) out.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(n - 1, page + 1); i++) out.push(i);
    if (page < n - 2) out.push('…');
    out.push(n);
    return out;
  }, [page, totalPages]);

  const btn = (active) => ({
    minWidth: 38,
    height: 38,
    padding: '0 10px',
    borderRadius: 10,
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : 'var(--bg-white)',
    color: active ? '#fff' : 'var(--text-primary)',
    fontWeight: active ? 700 : 600,
    fontSize: 13.5,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color .14s ease, background .14s ease',
  });

  return (
    <nav
      aria-label="Product pages"
      style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
    >
      <button
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onMove(page - 1)}
        style={{ ...btn(false), opacity: page <= 1 ? 0.35 : 1 }}
      >
        <FiChevronLeft size={15} />
      </button>
      {pagesList.map((p, idx) =>
        p === '…' ? (
          <span key={`gap-${idx}`} style={{ color: 'var(--text-light)', fontSize: 13, padding: '0 2px' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onMove(p)}
            style={btn(p === page)}
          >
            {p}
          </button>
        )
      )}
      <button
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onMove(page + 1)}
        style={{ ...btn(false), opacity: page >= totalPages ? 0.35 : 1 }}
      >
        <FiChevronRight size={15} />
      </button>
    </nav>
  );
}
