/**
 * One place that decides whether a second factor is required.
 *
 * The rule was copied into six login routes, each testing `NODE_ENV` and
 * `AUTH_OTP_BYPASS` itself. Six copies of a security decision is how one of them
 * ends up disagreeing with the others - and every copy had the same weakness: it
 * compared against the literal string 'false', so an unset variable, a typo, or
 * `AUTH_OTP_BYPASS=0` all skipped OTP in production.
 *
 * Now bypass is only ever possible outside production, and the demo accounts that
 * may skip it come from one list rather than from a list per role.
 */

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

export const isProduction = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

/** Out of production, bypass is on unless explicitly switched off. In production it never happens. */
export const otpBypassAllowed = (allowedEmails = [], email = '') => {
  if (isProduction()) return false;
  const flag = String(process.env.AUTH_OTP_BYPASS ?? '').trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(flag)) return false;
  const normalized = String(email || '').trim().toLowerCase();
  return (allowedEmails || []).map((e) => String(e).trim().toLowerCase()).includes(normalized);
};

/**
 * Transactional email is how every sign-in second factor is delivered, so
 * production without SMTP is a lockout waiting to happen rather than a working
 * deployment. Checked at boot where it can be said out loud.
 */
export const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/** Fail-fast conditions that must stop a production process from starting. */
export const productionBootErrors = ({ seedForced }) => {
  if (!isProduction()) return [];
  const errors = [];
  if (seedForced) {
    errors.push('SEED_ON_BOOT=true is refused in production: the seed deletes the collections it owns before writing demo fixtures.');
  }
  const secret = String(process.env.JWT_SECRET || '');
  if (!secret || secret.length < 32 || /^(change-me|your[-_]|\s*$)/i.test(secret)) {
    errors.push('JWT_SECRET must be a unique value of at least 32 characters before serving real sessions.');
  }
  if (!smtpConfigured()) {
    errors.push('SMTP_HOST/SMTP_USER/SMTP_PASS are required in production: every role sign-in demands an emailed OTP, and without mail no account can be reached again.');
  }
  return errors;
};
