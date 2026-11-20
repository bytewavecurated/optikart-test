import React, { useState } from 'react';

/**
 * An <img> that degrades with dignity.
 *
 * Marketplace images arrive from three places: Cloudinary (configured
 * deployments), local disk uploads (dev/staging fallbacks) and the seeded
 * catalogue's `/uploads/...` paths - and on a fresh install the latter two
 * point at files that do not exist yet (uploads/ is not in git on purpose).
 * A broken image icon is what turned every card on a new database into
 * alt-text soup: the screenshot this component exists to prevent. The
 * fallback is a quiet brand-tinted monogram of the product name - the same
 * visual language the brand rails use for logos - so the card still looks
 * like a product, not like an outage.
 *
 * Behaviour: the real src is tried FIRST and shown when it loads; onError
 * swaps to the monogram (never back, the store isn't going to warm mid-
 * browse). alt stays truthful for screen readers either way.
 */
export default function CardImage({ src, alt = '', style = {}, imgStyle = {}, children = null }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    const words = String(alt || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, var(--bg-secondary), var(--brand-tint))',
        }}
        aria-hidden
      >
        {children}
        {!children && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: Math.max(14, Math.min(28, (parseInt(String(style.width || 120), 10) || 90) / 3.2)),
              color: 'var(--brand)',
              letterSpacing: '.04em',
              opacity: 0.5,
            }}
          >
            {words || 'OK'}
          </span>
        )}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="product-image"
      style={{ width: '100%', height: '100%', objectFit: 'contain', ...imgStyle }}
    />
  );
}
