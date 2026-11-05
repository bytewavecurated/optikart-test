import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 16px',
    fontFamily: "var(--font-body)",
  },
  button: {
    background: 'var(--bg-white)',
    border: '1px solid #c2c2c2',
    borderRadius: 'var(--radius-xs)',
    padding: '12px 48px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--brand)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    minWidth: '200px',
    justifyContent: 'center',
  },
  buttonHover: {
    background: 'var(--brand-tint)',
    borderColor: 'var(--brand)',
  },
  buttonDisabled: {
    background: 'var(--bg-subtle)',
    color: 'var(--text-light)',
    cursor: 'not-allowed',
    borderColor: 'var(--border)',
  },
  spinner: {
    display: 'inline-block',
    width: '18px',
    height: '18px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--brand)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    marginTop: '12px',
    fontSize: '13px',
    color: 'var(--text-light)',
  },
};

export default function LoadMore({
  onLoadMore,
  loading = false,
  hasMore = true,
  label = 'Load More',
  loadedLabel = 'No More Products',
}) {
  const [hovered, setHovered] = React.useState(false);

  if (!hasMore && !loading) {
    return (
      <div style={styles.container}>
        <button
          style={{ ...styles.button, ...styles.buttonDisabled }}
          disabled
        >
          {loadedLabel}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.button,
          ...(loading ? styles.buttonDisabled : {}),
          ...(hovered && !loading ? styles.buttonHover : {}),
        }}
        onClick={() => !loading && onLoadMore && onLoadMore()}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {loading ? (
          <>
            <span style={styles.spinner} />
            Loading...
          </>
        ) : (
          <>
            <FiRefreshCw size={16} />
            {label}
          </>
        )}
      </button>
      {!hasMore && !loading && (
        <span style={styles.text}>You've reached the end</span>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
