/**
 * Server-side contact-lens prescription rules.
 *
 * Mirrors client/src/utils/contactLensPowers.js. The client uses its copy to
 * build the picker; this copy is the authority, because a crafted request must
 * not be able to place an order for a power the lab cannot make.
 */

export const POWER_STEP = 0.25;
export const SPHERE_MIN = -12;
export const SPHERE_MAX = 6;
export const CYL_MIN = -2.75;
export const CYL_MAX = -0.75;
export const AXIS_MIN = 1;
export const AXIS_MAX = 180;
export const ADD_MIN = 0.75;
export const ADD_MAX = 2.5;

const isQuarterStep = (n) => Math.abs(n * 4 - Math.round(n * 4)) < 1e-9;

export const powerBoundsFor = (product) => {
  const cl = product?.contactLens || {};
  return {
    powerType: cl.powerType || 'distance',
    sphereMin: Number.isFinite(cl.SphereLeftMin) ? cl.SphereLeftMin : SPHERE_MIN,
    sphereMax: Number.isFinite(cl.SphereLeftMax) ? cl.SphereLeftMax : SPHERE_MAX,
    cylMin: Number.isFinite(cl.cylinderMin) ? cl.cylinderMin : CYL_MIN,
    cylMax: Number.isFinite(cl.cylinderMax) ? cl.cylinderMax : CYL_MAX,
    axisMin: Number.isFinite(cl.axisMin) ? cl.axisMin : AXIS_MIN,
    axisMax: Number.isFinite(cl.axisMax) ? cl.axisMax : AXIS_MAX,
    addMin: Number.isFinite(cl.additionMin) ? cl.additionMin : ADD_MIN,
    addMax: Number.isFinite(cl.additionMax) ? cl.additionMax : ADD_MAX,
    lensesPerBox: cl.lensesPerBox || 6,
    allowsZeroPower: !!cl.allowsZeroPower,
    withPowerAvailable: cl.withPowerAvailable !== false
  };
};

/**
 * @returns {{valid: boolean, errors: string[]}}
 */
export const validateContactLensPrescription = (power, bounds) => {
  const errors = [];
  if (bounds.powerType === 'none') return { valid: true, errors };

  for (const [eye, label] of [['right', 'OD (right eye)'], ['left', 'OS (left eye)']]) {
    const e = power?.[eye] || {};
    const sphere = Number(e.sphere);
    if (!Number.isFinite(sphere)) {
      errors.push(`${label}: sphere is required`);
    } else if (sphere < bounds.sphereMin || sphere > bounds.sphereMax) {
      errors.push(`${label}: sphere ${sphere} is outside ${bounds.sphereMin} to +${bounds.sphereMax} for this lens`);
    } else if (!isQuarterStep(sphere)) {
      errors.push(`${label}: sphere must move in 0.25 steps`);
    }

    if (bounds.powerType === 'toric') {
      const cyl = e.cylinder === '' || e.cylinder === undefined || e.cylinder === null ? null : Number(e.cylinder);
      if (cyl === null) {
        errors.push(`${label}: cylinder is required for toric lenses (enter 0 if you have none)`);
      } else if (!(cyl === 0 || (cyl <= bounds.cylMax && cyl >= bounds.cylMin))) {
        errors.push(`${label}: cylinder must be 0 or between ${bounds.cylMin} and ${bounds.cylMax}`);
      } else if (cyl !== 0) {
        const axis = Number(e.axis);
        if (!Number.isFinite(axis) || axis < bounds.axisMin || axis > bounds.axisMax) {
          errors.push(`${label}: axis must be ${bounds.axisMin}-${bounds.axisMax} when a cylinder is prescribed`);
        }
      }
    }

    if (bounds.powerType === 'multifocal') {
      const add = Number(e.addition);
      if (!Number.isFinite(add)) {
        errors.push(`${label}: ADD power is required for multi-focal lenses`);
      } else if (add < bounds.addMin || add > bounds.addMax) {
        errors.push(`${label}: ADD must be between ${bounds.addMin} and ${bounds.addMax}`);
      } else if (!isQuarterStep(add)) {
        errors.push(`${label}: ADD must move in 0.25 steps`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
};
