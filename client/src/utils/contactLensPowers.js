/**
 * Contact-lens prescription rules shared by the configurator, the server check
 * and the cart line summary.
 *
 * A soft-lens prescription is four numbers per eye - sphere, and for astigmatism
 * a cylinder plus axis, and for multifocals an addition - stepped in quarter
 * powers. Getting these wrong is the most common cause of a lens order being
 * remade, so the ranges live in one place and the UI only ever offers valid
 * combinations.
 */

export const POWER_STEP = 0.25;
export const AXIS_MIN = 1;
export const AXIS_MAX = 180;
export const AXIS_STEP = 10;

// Negative (short-sighted) through positive (long-sighted) sphere range a lab
// typically stocks for soft lenses.
export const SPHERE_MIN = -12;
export const SPHERE_MAX = 6;

// Toric cylinder correction, always negative for soft toric lenses.
export const CYL_MIN = -2.75;
export const CYL_MAX = -0.75;

// Multifocal addition.
export const ADD_MIN = 0.75;
export const ADD_MAX = 2.5;

/**
 * Build the quarter-step ladder used by the power pickers, avoiding floating
 * point artefacts (0.1 + 0.2 style) by working in hundredths.
 */
export const powerRange = (min, max, step = POWER_STEP) => {
  const lo = Math.round(min * 100);
  const hi = Math.round(max * 100);
  const s = Math.round(step * 100);
  const out = [];
  for (let v = lo; s > 0 ? v <= hi : v >= hi; v += s) out.push(v / 100);
  return out;
};

export const SPHERE_VALUES = powerRange(SPHERE_MIN, SPHERE_MAX);

// Cylinder steps down from -0.75 to -2.75; 0 means "no astigmatic correction"
// and is offered first so a distance-wearers' toric box can be ordered as plain.
export const CYL_OPTIONS = [0, ...powerRange(CYL_MAX, CYL_MIN, -POWER_STEP)];

// Axis runs 10 to 180 in tens, the increments soft toric lenses are manufactured in.
export const AXIS_OPTIONS = powerRange(10, AXIS_MAX, AXIS_STEP);
export const ADD_OPTIONS = powerRange(ADD_MIN, ADD_MAX);

export const formatPower = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  const fixed = n.toFixed(2);
  return n > 0 ? `+${fixed}` : fixed;
};

export const axisLabel = (v) => (Number(v) === 0 || v === '' ? '-' : `${v}\u00B0`);

/** Power types the storefront supports, mapped to the product field. */
export const POWER_TYPES = {
  distance: { label: 'Distance Power', needs: ['sphere'], hint: 'Sphere only (SPH)' },
  toric: { label: 'Toric / Cylindrical', needs: ['sphere', 'cylinder', 'axis'], hint: 'SPH, CYL and AXIS' },
  multifocal: { label: 'Multi-focal', needs: ['sphere', 'addition'], hint: 'SPH and ADD (down-segment)' },
  none: { label: 'No power needed', needs: [], hint: 'Cosmetic or plano' }
};

export const needsAxis = (t) => t === 'toric';
export const needsAddition = (t) => t === 'multifocal';

/**
 * Server-parity validation. Cheap enough to run on every keystroke; the same
 * rules are enforced on the order so an edited URL cannot smuggle bad powers.
 */
export const validatePowerSet = (power, powerType) => {
  const errors = {};
  if (powerType === 'none') return { valid: true, errors };
  const req = POWER_TYPES[powerType]?.needs || [];
  ['left', 'right'].forEach((eye) => {
    const e = power?.[eye] || {};
    const label = eye === 'left' ? 'Left eye (OS)' : 'Right eye (OD)';
    if (req.includes('sphere')) {
      const sp = Number(e.sphere);
      if (e.sphere === '' || e.sphere === null || e.sphere === undefined) errors[`${eye}.sphere`] = `${label}: sphere is required`;
      else if (!Number.isFinite(sp) || sp < SPHERE_MIN || sp > SPHERE_MAX) errors[`${eye}.sphere`] = `${label}: sphere must be between ${SPHERE_MIN} and +${SPHERE_MAX}`;
      else if (Math.abs(sp * 4 - Math.round(sp * 4)) > 1e-9) errors[`${eye}.sphere`] = `${label}: sphere moves in 0.25 steps`;
    }
    if (req.includes('cylinder')) {
      const cy = Number(e.cylinder);
      if (e.cylinder === '' || e.cylinder === undefined || e.cylinder === null) errors[`${eye}.cylinder`] = `${label}: cylinder is required (enter 0 if none)`;
      else if (!(cy === 0 || (cy <= CYL_MAX && cy >= CYL_MIN))) errors[`${eye}.cylinder`] = `${label}: cylinder must be 0 or between ${CYL_MIN} and ${CYL_MAX}`;
      if (cy !== 0 && Number.isFinite(cy)) {
        const ax = Number(e.axis);
        if (!Number.isFinite(ax) || ax < AXIS_MIN || ax > AXIS_MAX) errors[`${eye}.axis`] = `${label}: axis must be ${AXIS_MIN}-${AXIS_MAX} when a cylinder is given`;
      }
    }
    if (req.includes('addition')) {
      const ad = Number(e.addition);
      if (e.addition === '' || e.addition === undefined || e.addition === null) errors[`${eye}.addition`] = `${label}: ADD is required for multi-focal lenses`;
      else if (!Number.isFinite(ad) || ad < ADD_MIN || ad > ADD_MAX) errors[`${eye}.addition`] = `${label}: ADD must be between ${ADD_MIN} and ${ADD_MAX}`;
    }
  });
  return { valid: Object.keys(errors).length === 0, errors };
};

/** Human summary for cart lines, seller screens and order history. */
export const describePower = (config) => {
  if (!config) return '';
  const fmt = (eye) => {
    const e = config[eye] || {};
    const parts = [];
    if (e.sphere !== undefined && e.sphere !== '' && e.sphere !== null) parts.push(`SPH ${formatPower(e.sphere)}`);
    if (e.cylinder !== undefined && e.cylinder !== '' && Number(e.cylinder) !== 0) parts.push(`CYL ${formatPower(e.cylinder)}`);
    if (e.axis !== undefined && e.axis !== '' && Number(e.cylinder) !== 0) parts.push(`AX ${e.axis}\u00B0`);
    if (e.addition !== undefined && e.addition !== '' && e.addition !== null) parts.push(`ADD ${formatPower(e.addition)}`);
    return parts.join(' ');
  };
  return [`OD ${fmt('right')}`.trim(), `OS ${fmt('left')}`.trim()].filter((x) => x !== 'OD' && x !== 'OS').join(' | ');
};

/** Replacement schedules, in the order a shopper reads them. */
export const REPLACEMENTS = [
  { value: 'daily', label: 'Daily disposable', note: 'New pair every day' },
  { value: 'weekly', label: 'Weekly disposable', note: 'Replace every 7 days' },
  { value: 'biweekly', label: 'Fortnightly', note: 'Replace every 14 days' },
  { value: 'monthly', label: 'Monthly disposable', note: 'Replace every 30 days' },
  { value: 'quarterly', label: 'Quarterly', note: 'Replace every 3 months' },
  { value: 'halfyearly', label: 'Every 6 months', note: 'Semi-annual replacement' },
  { value: 'yearly', label: 'Yearly', note: 'Annual replacement, needs solution' }
];

// Box quantities actually sold; drives "how many lenses per box".
export const BOX_SIZES = [1, 2, 3, 6, 10, 30, 90];
