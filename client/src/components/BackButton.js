import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

/**
 * "Back" control for interior pages, placed at the top left.
 *
 * It uses history.back() when the visitor arrived from somewhere inside the app,
 * and falls back to a supplied link when they landed on the page directly (a
 * fresh tab or a shared URL), where there is no history to go back to.
 */
export default function BackButton({ to, fallbackTo = '/', label = 'Back', style, variant = 'text' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const destination = to || fallbackTo;
  // The initial history entry of a full page load belongs to this document, so
  // a larger length is the only reliable signal that there is somewhere to go.
  const canGoBack = typeof window !== 'undefined' && window.history.length > 2;

  const go = (e) => {
    e.preventDefault();
    if (canGoBack) navigate(-1);
    else navigate(destination);
  };

  if (location.pathname === '/') return null;

  const base = variant === 'pill'
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-white)',
        color: 'var(--text-primary)'
      }
    : { background: 'none', border: 'none', padding: '6px 0' };

  return (
    <button
      onClick={go}
      aria-label="Go back to the previous page"
      style={{
        ...base,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 13.5,
        fontWeight: 600,
        color: variant === 'pill' ? 'var(--text-primary)' : 'var(--text-secondary)',
        ...style
      }}
    >
      <FiArrowLeft size={16} />
      {label}
    </button>
  );
}
