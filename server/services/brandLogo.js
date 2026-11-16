import React from 'react';

/**
 * A brand mark is identity, not decoration: on the home-page rails it is the
 * thing a shopper recognises before they read a single product name. It is also
 * the asset a manufacturer cannot correct by editing a text field later, which
 * is why the upload checks it rather than the render step.
 *
 * Accepted formats are the three the storefront can be relied on to display
 * without a conversion step and without a service-worker-sized raster: PNG for
 * transparency, JPEG where a solid background is fine, SVG for wordmarks and
 * simple geometry. A minimum edge of 800px exists because the rails render at
 * device pixel ratios and the logo is asked to stay legible at retina
 * densities - a 200px PNG there becomes visibly soft the moment the layout
 * scales. 2MB is a cap, not a target.
 */
export const MIN_LOGO_EDGE_PX = 800;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/*
 * Geometry is read from the file's own header bytes. No image library is
 * involved, so this cannot disagree with the upload about what the file is -
 * and it cannot be moved by the file name, which is the part users control and
 * therefore the part that lies.
 */
const readPng = (buf) => {
  if (buf.length < 24) return null;
  const sig = buf.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { kind: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

/* JPEGs put width/height in a start-of-frame marker; walk segments until one. */
const readJpeg = (buf) => {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry the frame size.
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    const size = buf.readUInt16BE(i + 2);
    if (isSof) return { kind: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + size;
  }
  return { kind: 'jpeg', width: 0, height: 0 };
};

/*
 * SVG has no intrinsic pixel size, so geometry is read from the drawing hints
 * the author actually supplied. An SVG with neither width/height nor a viewBox
 * has no measurable square shape - and a mark that cannot be measured is a mark
 * that cannot be promised to be big enough, so it is refused rather than
 * trusted on the file name.
 */
const readSvg = (buf) => {
  const text = buf.subarray(0, Math.min(buf.length, 8192)).toString('utf8');
  if (!/<svg[\s>]/i.test(text)) return null;
  const attr = (name) => {
    const m =
      text.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`, 'i')) ||
      text.match(new RegExp(`\\b${name}\\s*=\\s*'([^']+)'`, 'i'));
    return m ? m[1] : null;
  };
  const num = (s) => {
    const n = Number(
      String(s)
        .trim()
        .replace(/(px|pt|em|cm|mm|in)$/i, '')
    );
    return Number.isFinite(n) ? n : 0;
  };
  const w = attr('width');
  const h = attr('height');
  if (w && h) return { kind: 'svg', width: num(w), height: num(h) };
  const vb = attr('viewBox') || attr('viewbox');
  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) return { kind: 'svg', width: parts[2], height: parts[3] };
  }
  return { kind: 'svg', width: 0, height: 0 };
};

export const readLogoGeometry = (buf) => {
  if (!Buffer.isBuffer(buf) || !buf.length) return null;
  return readPng(buf) || readJpeg(buf) || readSvg(buf);
};

/**
 * Returns null when the logo may be stored, otherwise a message that says both
 * what was found and what is expected. "Invalid file" is not an actionable
 * message when the manufacturer is looking at a 640px export they believe is
 * high resolution.
 */
export const assessLogo = (buf, { mimetype } = {}) => {
  if (!Buffer.isBuffer(buf) || !buf.length) {
    return { field: 'logo', message: 'A brand logo file is required (PNG, JPG or SVG).' };
  }
  if (mimetype && !ACCEPTED_LOGO_TYPES.includes(String(mimetype).toLowerCase())) {
    const geoCheck = readLogoGeometry(buf);
    if (!geoCheck) return { field: 'logo', message: 'Logo must be PNG, JPG or SVG.' };
  }
  if (buf.length > MAX_LOGO_BYTES) {
    return {
      field: 'logo',
      message: `Logo must be under 2 MB (this file is ${(buf.length / 1048576).toFixed(1)} MB).`,
    };
  }
  const geo = readLogoGeometry(buf);
  if (!geo) return { field: 'logo', message: 'Logo must be PNG, JPG or SVG.' };
  if (!geo.width || !geo.height) {
    return geo.kind === 'svg'
      ? {
          field: 'logo',
          message: 'SVG logos must declare a square width/height or a viewBox so the size can be verified.',
        }
      : { field: 'logo', message: 'Logo image dimensions could not be read. Re-export the file.' };
  }
  if (geo.width !== geo.height) {
    return {
      field: 'logo',
      message: `Logo must be square; this one is ${geo.width} × ${geo.height}. A wide wordmark can live in the brand page text instead.`,
    };
  }
  if (geo.width < MIN_LOGO_EDGE_PX) {
    return {
      field: 'logo',
      message: `Logo must be at least ${MIN_LOGO_EDGE_PX} × ${MIN_LOGO_EDGE_PX}; this is ${geo.width} × ${geo.height}. The rails scale it up and it will read as blurry.`,
    };
  }
  return null;
};

export const brandLogoPath = (name, hash, ext) =>
  `uploads/brands/${String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}-${String(hash).slice(0, 12)}.${ext}`;

export const EXT_BY_KIND = { png: '.png', jpeg: '.jpg', svg: '.svg' };
