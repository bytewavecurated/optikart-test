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

const truthy = (value) =>
  ['1', 'true', 'yes', 'on'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase()
  );

export const isProduction = () =>
  String(process.env.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production';

/** Out of production, bypass is on unless explicitly switched off. In production it never happens. */
export const otpBypassAllowed = (allowedEmails = [], email = '') => {
  if (isProduction()) return false;
  const flag = String(process.env.AUTH_OTP_BYPASS ?? '')
    .trim()
    .toLowerCase();
  if (['false', '0', 'no', 'off'].includes(flag)) return false;
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  return (allowedEmails || []).map((e) => String(e).trim().toLowerCase()).includes(normalized);
};

/**
 * Transactional email is how every sign-in second factor is delivered, so
 * production without SMTP is a lockout waiting to happen rather than a working
 * deployment. Checked at boot where it can be said out loud.
 */
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/*
 * The seed gate, in one decision.
 *
 * `SEED_ON_BOOT` defaults to `auto`, meaning seed-when-the-database-looks-empty.
 * Outside development and CI that is not a convenience but a hazard: a real
 * production database created this morning is empty, so an ordinary first boot
 * would wipe-or-fill it with demo sellers, demo shoppers and demo partners with
 * fixed passwords listed in LOGINS.md - and the seed deletes the collections it
 * owns before writing, so a later "empty-looking" state on a staging box can
 * destroy data that was only half-migrated.
 *
 * The rule is now one pure function instead of an `if/else` ladder buried in
 * startup, so it can be asserted without booting a server against a database:
 *
 *   - development / CI: `auto` seeds an empty database (the suites sign in as
 *     seeded accounts), `true` forces, `false` never.
 *   - production: `auto` NEVER seeds, empty database or not. Seeding happens
 *     only with the two explicit staging flags together - a deliberate action by
 *     someone who knows what it deletes.
 */
export const seedDecision = ({ flag = 'auto', existing = 0, production = false, allowDemoSeed = false } = {}) => {
  const normalized = String(flag || 'auto').toLowerCase();

  if (normalized === 'false' || normalized === '0') {
    return { seed: false, reason: 'disabled-by-flag' };
  }

  const forced = normalized === 'true' || normalized === '1';
  if (forced) {
    if (production && !allowDemoSeed) {
      return { seed: false, reason: 'production-refuses-demo-seed' };
    }
    return {
      seed: true,
      reason: production ? 'production-staging-acknowledged' : 'forced-flag',
      destructive: true,
    };
  }

  // auto
  if (production) return { seed: false, reason: 'production-never-auto-seeds' };
  if (Number(existing) === 0) return { seed: true, reason: 'empty-database-development' };
  return { seed: false, reason: 'database-not-empty' };
};

/** Fail-fast conditions that must stop a production process from starting. */
export const productionBootErrors = ({ seedForced, seedAcknowledged = false }) => {
  if (!isProduction()) return [];
  const errors = [];
  if (seedForced && !seedAcknowledged) {
    errors.push(
      'SEED_ON_BOOT=true is refused in production: the seed deletes the collections it owns before writing demo fixtures. On a staging database, set BOTH SEED_ON_BOOT=true and ALLOW_DEMO_SEED=true to say so deliberately.'
    );
  }
  const secret = String(process.env.JWT_SECRET || '');
  if (!secret || secret.length < 32 || /^(change-me|your[-_]|\s*$)/i.test(secret)) {
    errors.push('JWT_SECRET must be a unique value of at least 32 characters before serving real sessions.');
  }
  if (!smtpConfigured()) {
    errors.push(
      'SMTP_HOST/SMTP_USER/SMTP_PASS are required in production: every role sign-in demands an emailed OTP, and without mail no account can be reached again.'
    );
  }
  return errors;
};
