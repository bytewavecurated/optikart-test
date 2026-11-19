/**
 * Manufacturer onboarding: KYC completeness, emailed verification, the
 * update-info loop that routes through the admin desk deliberately, and OTP
 * activation. The account becomes real only at the last step - nothing in
 * this flow emails a password or invents one.
 *
 * WHY THIS ORDER. The platform is built on manufacturer-supplied catalogue:
 * brands, products, verification decisions and price approvals all act on a
 * manufacturer identity. Creating that identity with four fields (name,
 * email, password, phone) meant the desk could stand up an entity that could
 * not be paid, invoiced or audited - no GST, no PAN, no bank - and it went
 * ACTIVE on the admin's keypress, so one typo'd GST was already a live
 * business partner. Creation now produces a PENDING record, and the
 * manufacturer themselves confirm it through an emailed token followed by an
 * OTP. "Update info" is deliberately not an edit to a live record: it is a
 * proposal the desk consciously re-creates and re-sends for confirmation.
 *
 *   pending_verification --VERIFY--> pending_otp --OTP--> active
 *   pending_verification --UPDATE--------> update_requested --admin re-create--> pending_verification
 *
 * Tokens are single-use random handles, stored hashed with an expiry, like
 * every credential this platform issues; the raw value exists only inside
 * the message that carries it.
 */
import crypto from 'node:crypto';
import Manufacturer from '../models/Manufacturer.js';
import { describeOtpDelivery, sendOTP, sendEmail, isSmtpConfigured } from './email.js';
import { notifyAdmins, notifyManufacturer } from './notifications.js';

const TOKEN_TTL_DAYS = 7;
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

export const onboardingStateOf = (m) => m?.onboarding?.state || 'active';

/* --------------------------------------------------------------- KYC rule */

export const KYC_FIELDS = [
  'name',
  'companyName',
  'email',
  'phone',
  'gstNumber',
  'panNumber',
  'bank.accountNumber',
  'bank.ifscCode',
  'bank.bankName',
  'address.street',
  'address.city',
  'address.state',
  'address.pincode',
];

const SHAPES = {
  gstNumber: {
    label: 'GSTIN',
    pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/,
    hint: 'expected 15 characters, e.g. 27ABCDE1234F1Z5 (state code + PAN + entity + Z + checksum)',
  },
  panNumber: { label: 'PAN', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, hint: 'expected 10 characters, e.g. ABCDE1234F' },
  'bank.ifscCode': {
    label: 'IFSC',
    pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    hint: 'expected 11 characters, e.g. SBIN0001234',
  },
  'address.pincode': { label: 'PIN code', pattern: /^[1-9][0-9]{5}$/, hint: 'expected 6 digits' },
};

/** GSTIN/IFSC/PAN/PINcode - the government spellings, upper case, trimmed. */
export const normaliseKycStrings = (draft) => {
  for (const f of ['gstNumber', 'panNumber', 'bank.ifscCode']) {
    const [a, b] = f.split('.');
    if (b) {
      if (draft[a]?.[b]) draft[a][b] = String(draft[a][b]).trim().toUpperCase();
    } else if (draft[f]) draft[f] = String(draft[f]).trim().toUpperCase();
  }
  if (draft.address?.pincode) draft.address.pincode = String(draft.address.pincode).trim();
  return draft;
};

const getPath = (o, dotted) => dotted.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);

export const validateManufacturerKyc = (draft) => {
  const errors = [];
  for (const field of KYC_FIELDS) {
    const value = getPath(draft, field);
    const present = value != null && String(value).trim() !== '';
    if (!present) {
      errors.push({
        field,
        message: `${field} is required - the manufacturer record must be complete before it can be confirmed.`,
      });
      continue;
    }
    if (field === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value).trim())) {
      errors.push({ field, message: 'That is not a valid email address, and every confirmation letter goes there.' });
      continue;
    }
    const shape = SHAPES[field];
    if (shape && !shape.pattern.test(String(value).trim())) {
      errors.push({ field, message: `${String(value).trim()} is not a valid ${shape.label} - ${shape.hint}.` });
    }
  }
  return errors;
};

/* ------------------------------------------------------------- mail step */

/**
 * Attach a fresh verification token, park the record pending, and send the
 * two-action mail. The SEND RESULT IS RECORDED either way (`mailDelivered`
 * and `mailNote` are what the desk reads to know the company got its chance
 * to answer); on a box with no SMTP the send fails exactly like every other
 * sender here, and the returned devToken keeps local testing honest without
 * inventing delivery.
 */
export const issueVerificationMail = async ({ m, baseUrl = process.env.FRONTEND_URL || '' }) => {
  const token = crypto.randomBytes(24).toString('hex');
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await Manufacturer.updateOne(
    { _id: m._id },
    {
      isActive: false,
      'onboarding.state': 'pending_verification',
      'onboarding.verifyTokenHash': sha(token),
      'onboarding.tokenIssuedAt': issuedAt,
      'onboarding.tokenExpiresAt': expiresAt,
      'onboarding.lastMailAt': issuedAt,
      'onboarding.activatedAt': null,
      activationOtp: null,
      activationOtpExpiry: null,
      activationAttempts: 0,
    }
  );
  const link = `${baseUrl}/manufacturer/onboarding/${token}`;
  const bank = m.bank || {};
  const addr = m.address || {};
  const summary = [
    ['Contact', m.name],
    ['Company', m.companyName],
    ['Email', m.email],
    ['Phone', m.phone],
    ['GSTIN', m.gstNumber],
    ['PAN', m.panNumber],
    ['Address', [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')],
    ['Bank', `${bank.bankName || ''} ****${String(bank.accountNumber || '').slice(-4)} · IFSC ${bank.ifscCode || ''}`],
    ['Brands', (m.brands || []).join(', ')],
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 10px;color:#555">${k}</td><td style="padding:4px 10px"><strong>${String(v).replace(/[<>&]/g, '')}</strong></td></tr>`
    )
    .join('');
  const result = await sendEmail({
    to: m.email,
    subject: 'Confirm your OptiKart manufacturer details',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin-bottom:4px">Confirm your OptiKart manufacturer details</h2>
        <p style="color:#555;margin-top:0">Our desk recorded the following for <strong>${String(m.companyName).replace(/[<>&]/g, '')}</strong>. Please check every line.</p>
        <table style="border-collapse:collapse;background:#f6f6f8;border-radius:8px">${summary}</table>
        <p style="margin-top:18px"><a href="${link}" style="background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Everything is correct - verify</a></p>
        <p><a href="${link}?mode=update" style="color:#111;border:1px solid #111;padding:9px 17px;border-radius:8px;text-decoration:none">Something changed - update info</a></p>
        <p style="color:#666;font-size:12px">Verify sends a one-time code to this email; the account activates only when you finish with it. Links expire ${expiresAt.toDateString()}. Expected none of this? Contact OptiKart support.</p>
      </div>`,
    text: `Confirm your OptiKart manufacturer details for ${m.companyName}.\n\n${link}\nUpdate info: ${link}?mode=update\n\nThe link expires ${expiresAt.toDateString()}. Verify sends a one-time code; activation completes only with it.`,
  });
  const attemptedOk = !!(result && result.success !== false);
  await Manufacturer.updateOne(
    { _id: m._id },
    {
      'onboarding.mailDelivered': attemptedOk && isSmtpConfigured(),
      'onboarding.mailNote': attemptedOk
        ? ''
        : String((result && (result.error || result.message)) || 'send refused').slice(0, 180),
    }
  );
  return {
    tried: attemptedOk,
    delivered: attemptedOk && isSmtpConfigured(),
    /*
     * Mirrors `undeliverable()` in email.js: on a box with no SMTP at all the
     * token is handed back for local use regardless of the send's failure -
     * an invite nobody can ever open is the dead end this project already
     * outlawed. In production SMTP is mandatory (boot checks), so this arm
     * never leaks there.
     */
    devToken: isSmtpConfigured() ? null : token,
  };
};

/** Open a confirmation link. */
export const resolveVerificationToken = async (token) => {
  if (!token || !/^[0-9a-f]{48}$/i.test(token)) return { ok: false, reason: 'invalid-token' };
  const m = await Manufacturer.findOne({ 'onboarding.verifyTokenHash': sha(token) }).select('-password');
  if (!m) return { ok: false, reason: 'invalid-token' };
  if (!m.onboarding?.tokenExpiresAt || new Date(m.onboarding.tokenExpiresAt) < new Date()) {
    return { ok: false, reason: 'expired', m };
  }
  return { ok: true, m, state: onboardingStateOf(m) };
};

/* --------------------------------------------------------- verify / OTP */

/** "Everything is correct" - confirm, then demand the OTP before instatement. */
export const beginActivation = async (m) => {
  if (onboardingStateOf(m) !== 'pending_verification') {
    return {
      ok: false,
      message: 'That confirmation link has already been used; the desk can always re-send a fresh one.',
    };
  }
  const otp = String(crypto.randomInt(100000, 1000000));
  await Manufacturer.updateOne(
    { _id: m._id },
    {
      'onboarding.state': 'pending_otp',
      'onboarding.verifyClickedAt': new Date(),
      activationOtp: otp,
      activationOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      activationAttempts: 0,
    }
  );
  const fresh = await Manufacturer.findById(m._id);
  const send = await sendOTP(fresh.email, otp, 'manufacturer-activation');
  const described = describeOtpDelivery(send, { purpose: 'manufacturer activation' });
  return { ok: described.ok, status: described.status, message: described.message, devCode: described.devCode || null };
};

/** The OTP the manufacturer typed. Only this makes the account real. */
export const completeActivation = async (mHandle, otp) => {
  // `activationOtp` is select:false (the column that stores a live credential
  // never rides along with incidental reads) - this is the one context that
  // may look at it, and only to compare.
  const m = await Manufacturer.findById(mHandle._id).select('+activationOtp');
  if (!m) return { ok: false, message: 'That manufacturer record no longer exists.' };
  const s = onboardingStateOf(m);
  if (s === 'active') return { ok: false, message: 'This account is already active - sign in instead.' };
  if (s !== 'pending_otp')
    return { ok: false, message: 'Activation was never started; open the newest confirmation link and click Verify.' };
  if ((m.activationAttempts || 0) >= 5) {
    return {
      ok: false,
      message: 'Too many incorrect codes. Click Verify again from the confirmation mail to get a fresh one.',
    };
  }
  if (!m.activationOtpExpiry || new Date(m.activationOtpExpiry) < new Date()) {
    return { ok: false, message: 'That code has expired; click Verify again for a fresh one.' };
  }
  if (!/^[0-9]{6}$/.test(String(otp || '').trim()))
    return { ok: false, message: 'Enter the 6-digit code exactly as emailed.' };
  if (String(m.activationOtp || '').trim() === String(otp).trim()) {
    await Manufacturer.updateOne(
      { _id: m._id },
      {
        'onboarding.state': 'active',
        'onboarding.activatedAt': new Date(),
        'onboarding.verifyTokenHash': null,
        isActive: true,
        activationOtp: null,
        activationOtpExpiry: null,
      }
    );
    await notifyManufacturer({
      manufacturerId: m._id,
      title: 'Manufacturer account activated',
      message: `${m.companyName}'s details are confirmed; the console sign-in is now enabled with the credentials your desk handed you.`,
      type: 'system',
      data: { kind: 'manufacturer-activated', at: new Date().toISOString() },
    }).catch(() => null);
    return { ok: true, message: 'Confirmed and activated. The manufacturer can now sign in.' };
  }
  await Manufacturer.updateOne({ _id: m._id }, { $inc: { activationAttempts: 1 } });
  return { ok: false, message: 'That code does not match what we sent.' };
};

/* --------------------------------------------------------- update loop */

const UPDATABLE = [
  'name',
  'companyName',
  'email',
  'phone',
  'gstNumber',
  'panNumber',
  'website',
  'description',
  'address',
  'bank',
];

/** "Something changed" - a proposal the desk must consciously re-create. */
export const requestInfoUpdate = async (m, { updates = {}, note = '' } = {}) => {
  const s = onboardingStateOf(m);
  if (!['pending_verification', 'pending_otp', 'update_requested'].includes(s)) {
    return {
      ok: false,
      message:
        'This record is already trading under these details; changes now go through the desk or a fresh invitation.',
    };
  }
  const clean = {};
  for (const k of UPDATABLE) if (updates[k] !== undefined) clean[k] = updates[k];
  normaliseKycStrings(clean);
  const errors =
    clean.gstNumber || clean.panNumber || clean.bank
      ? validateManufacturerKyc({ ...(m.toObject ? m.toObject() : m), ...clean })
      : [];
  if (errors.length) return { ok: false, message: 'The proposed details are not yet valid.', errors };
  await Manufacturer.updateOne(
    { _id: m._id },
    {
      'onboarding.state': 'update_requested',
      'onboarding.pendingUpdates': clean,
      'onboarding.updateNote': String(note).slice(0, 1000),
      'onboarding.updateRequestedAt': new Date(),
      activationOtp: null,
    }
  );
  await notifyAdmins({
    title: 'Manufacturer update request',
    message: `${m.companyName} asked to correct their onboarding details${note ? ` (note: "${String(note).slice(0, 140)}")` : ''}. Re-create the invitation to send a fresh confirmation.`,
    type: 'manufacturer_update_request',
    data: { manufacturerId: String(m._id), fields: Object.keys(clean) },
  }).catch(() => null);
  return {
    ok: true,
    message: 'The desk has your proposed changes and will re-send a fresh confirmation once they are applied.',
  };
};

/** Admin desk queue of records waiting to be re-created. */
export const listUpdateRequests = async () => {
  const rows = await Manufacturer.find({ 'onboarding.state': 'update_requested' })
    .sort({ 'onboarding.updateRequestedAt': -1 })
    .select('-password -activationOtp')
    .lean();
  return rows.map((m) => ({
    id: String(m._id),
    companyName: m.companyName,
    email: m.email,
    requestedAt: m.onboarding?.updateRequestedAt || null,
    updates: m.onboarding?.pendingUpdates || {},
    note: m.onboarding?.updateNote || '',
  }));
};

/** Re-check the proposal against KYC, apply it deliberately, re-mail. */
export const recreateWithCorrections = async (m, io = null, baseUrl = undefined) => {
  const proposed = (m.onboarding && m.onboarding.pendingUpdates) || {};
  const merged = { ...(m.toObject ? m.toObject() : m), ...proposed };
  normaliseKycStrings(merged);
  const errors = validateManufacturerKyc(merged);
  if (errors.length)
    return {
      ok: false,
      errors,
      message: 'The proposed update does not pass the completeness check; send it back to the company.',
    };
  await Manufacturer.updateOne(
    { _id: m._id },
    {
      ...proposed,
      'onboarding.state': 'pending_verification',
      'onboarding.pendingUpdates': {},
      'onboarding.recreatedAt': new Date(),
    },
    { runValidators: false } // the merged whole has been checked above; partial-dotted keys trip validator paths oddly
  );
  const fresh = await Manufacturer.findById(m._id).select('-password -activationOtp');
  const mail = await issueVerificationMail({ m: fresh, baseUrl });
  await notifyManufacturer({
    manufacturerId: fresh._id,
    title: 'A fresh confirmation mail is on its way',
    message:
      'The desk applied your requested corrections; open the newest confirmation mail and verify to finish activation.',
    type: 'system',
    data: { kind: 'manufacturer-recreated', io },
  }).catch(() => null);
  return { ok: true, mail, manufacturer: { id: String(fresh._id), state: 'pending_verification' } };
};

export const onboardingSnapshot = (m) => ({
  state: onboardingStateOf(m),
  companyName: m.companyName,
  email: m.email,
  mailDelivered: !!(m.onboarding && m.onboarding.mailDelivered),
  mailNote: (m.onboarding && m.onboarding.mailNote) || '',
  lastMailAt: (m.onboarding && m.onboarding.lastMailAt) || null,
  expiresAt: (m.onboarding && m.onboarding.tokenExpiresAt) || null,
});
