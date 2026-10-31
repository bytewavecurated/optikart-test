import React from 'react';

/**
 * OptiKart brand lockup.
 *
 * The mark is a pair of lenses joined by a bridge, drawn on a 24-unit grid so it
 * stays crisp at any size. It is used in the header, the footer, the favicon and
 * as the app icon; the wordmark is set in Montserrat so it always matches the
 * rest of the product typography.
 *
 * Variants:
 *   onDark - for the dark app bar and footer
 *   onLight - default, for light surfaces
 *   mark   - symbol only (no wordmark)
 */
const MONOGRAM_PATHS = {
  leftLens: 'M3.2 9.4h6.1a1.6 1.6 0 0 1 1.6 1.6v2.6a2.6 2.6 0 0 1-2.6 2.6H4.2a2.6 2.6 0 0 1-2.6-2.6v-2.6a1.6 1.6 0 0 1 1.6-1.6Z',
  rightLens: 'M14.7 9.4h6.1a1.6 1.6 0 0 1 1.6 1.6v2.6a2.6 2.6 0 0 1-2.6 2.6h-4.1a2.6 2.6 0 0 1-2.6-2.6v-2.6a1.6 1.6 0 0 1 1.6-1.6Z',
  bridge: 'M10.9 11.6c.7-.9 1.5-.9 2.2 0',
  leftTemple: 'M1.6 10.6 0.2 8.6',
  rightTemple: 'M22.4 10.6l1.4-2'
};

export default function Logo({
  variant = 'onLight',
  size = 26,
  showWordmark = true,
  tagline = false,
  gap = 10,
  style
}) {
  const isDark = variant === 'onDark';
  const accent = 'var(--brand)';
  const textColor = isDark ? '#ffffff' : 'var(--text-primary)';
  const subColor = isDark ? 'rgba(255,255,255,0.62)' : 'var(--text-secondary)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        textDecoration: 'none',
        lineHeight: 1,
        ...style
      }}
    >
      <svg
        width={size}
        height={size * (20 / 24)}
        viewBox="0 0 24 20"
        role="img"
        focusable="false"
        aria-label="OptiKart logo"
        style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
      >
        <g fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={MONOGRAM_PATHS.leftLens} />
          <path d={MONOGRAM_PATHS.rightLens} />
          <path d={MONOGRAM_PATHS.bridge} />
          <path d={MONOGRAM_PATHS.leftTemple} />
          <path d={MONOGRAM_PATHS.rightTemple} />
        </g>
      </svg>

      {showWordmark && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: tagline ? 2 : 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: size * 0.78,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: textColor,
              whiteSpace: 'nowrap'
            }}
          >
            Opti<span style={{ color: accent }}>Kart</span>
          </span>
          {tagline && (
            <span
              className="logo-tagline"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: Math.max(9, size * 0.3),
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: subColor,
                whiteSpace: 'nowrap'
              }}
            >
              Eyewear, fitted right
            </span>
          )}
        </span>
      )}
    </span>
  );
}
