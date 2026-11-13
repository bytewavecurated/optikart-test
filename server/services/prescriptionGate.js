/**
 * Stock and prescription safety gates.
 *
 * Two things the app got wrong, both silent:
 *
 * 1. Stock was deducted read-then-write: `findById`, compare, `save()`. Two buyers
 *    clicking at the same moment both saw "1 left", both passed, and the second
 *    write clobbered the first - overselling the last unit and losing whatever a
 *    seller changed on that product in between. The decrement is now a single
 *    conditional atomic update; a zero-modifier result means someone got there
 *    first and is reported as a shortage rather than written as a negative number.
 *
 * 2. A powered lens could be ordered without anyone having checked the
 *    prescription it was ground to. `order.prescription` was a free-form
 *    {fileUrl,type,lensPreference} blob with no link to the verifying record, so
 *    there was nothing to check against - and the checkout page referenced a
 *    `prescription` variable that was never declared, silently reading
 *    `window.prescription` (undefined), so no link was ever sent either. An order
 *    line that needs grinding now has to name one approved prescription of this
 *    buyer's, or the order is refused before payment is touched.
 */
import Prescription from '../models/Prescription.js';
import PrescriptionVerification from '../models/PrescriptionVerification.js';

/**
 * Does this line have to be ground to a prescription?
 *
 * Two representations exist in the catalogue and both count, because missing one
 * would leave a whole category ungated: powered frames store the number in
 * `power`, while reading glasses are variant-sized by their addition ("+1.00"),
 * which is exactly the value an optician would otherwise be trusting unseen.
 */
const asSigned = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  // "+1.00", "1", "-0.75", "-2.50 x 90" - signed decimals are powers, and words
  // like "small", "54mm" or "medium" are not.
  const n = Number(raw.replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return /^[+-]?\d*\.?\d+$/.test(raw.replace(/\s/g, '')) ? n : null;
};

export const lineNeedsPrescription = (line) => {
  const v = (line && line.variant) || {};

  const power = asSigned(v.power);
  if (power !== null && power !== 0) return true;
  const cyl = asSigned(v.cyl);
  if (cyl !== null && cyl !== 0) return true;

  // "+1.00"-style sizes and "single vision"/"progressive" lens types are orders
  // for ground lenses, so zero/blank must not sneak an unchecked order through.
  const size = asSigned(v.size);
  if (size !== null && size !== 0) return true;

  return ['single vision', 'singlevision', 'bifocal', 'progressive'].includes(
    String(v.lensType || '').toLowerCase().replace(/[\s_-]/g, (m) => (m === ' ' ? ' ' : ''))
  ) || ['single vision', 'bifocal', 'progressive'].includes(String(v.lensType || '').toLowerCase());
};

/**
 * Resolve the prescription an order was placed against and prove it was checked.
 * Returns { ok, code, message } so the caller can answer with a stable code the
 * storefront can act on, rather than a sentence a shopper cannot resolve.
 */
export const assertPrescriptionVerified = async ({ userId, prescriptionId, lines }) => {
  const needs = (lines || []).filter(lineNeedsPrescription);
  if (!needs.length) return { ok: true, required: false };

  if (!prescriptionId) {
    return {
      ok: false,
      code: 'PRESCRIPTION_REQUIRED',
      message: 'This order includes lenses ground to your prescription, so a verified prescription must be selected before checking out.'
    };
  }

  const prescription = await Prescription.findById(prescriptionId).catch(() => null);
  if (!prescription) {
    return { ok: false, code: 'PRESCRIPTION_NOT_FOUND', message: 'That prescription is not on file. Upload it and pick it at checkout.' };
  }
  if (String(prescription.user) !== String(userId)) {
    // Not a detail to leak broadly, but the log matters when a customer calls.
    console.warn(`Prescription ${prescription._id} is not owned by user ${userId}`);
    return { ok: false, code: 'PRESCRIPTION_NOT_FOUND', message: 'That prescription is not on file. Upload it and pick it at checkout.' };
  }

  const verification = await PrescriptionVerification.findOne({ prescription: prescription._id }).sort({ createdAt: -1 });
  const status = prescription.verificationStatus || verification?.status || 'pending';

  if (status === 'approved') return { ok: true, required: true, status };
  if (status === 'rejected') {
    return {
      ok: false,
      code: 'PRESCRIPTION_REJECTED',
      message: verification?.rejectionReason
        ? `Your prescription was not accepted: ${verification.rejectionReason}`
        : 'Your prescription was not accepted. Upload a clearer copy and it will be checked again.',
      reason: verification?.rejectionReason || ''
    };
  }
  return {
    ok: false,
    code: 'PRESCRIPTION_PENDING',
    message: 'Your prescription is still being checked by our opticians. Orders for ground lenses open as soon as it is approved - usually within a few hours.'
  };
};
