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
 * RETIRED, and kept that way deliberately rather than deleted quietly.
 *
 * The rule was: development/CI `auto` seeds an empty database, `true` forces,
 * `false` never; production `auto` never seeds and only loads demo data with both
 * explicit staging flags. That whole ladder was protecting one mode (production)
 * out of several, and it protected it by *declining* to seed rather than by making
 * the dataset unreachable - so a staging deployment, a `NODE_ENV=development`
 * server pointed at a real Atlas cluster, or a laptop with a mistyped URI still
 * had a boot path whose first act is eleven `deleteMany({})` calls.
 *
 * The application no longer imports the dataset at all (see server/server.js and
 * server/fixtures/), so there is no decision left to make at boot. This function
 * remains exported because scripts/seed_guard_unit.mjs asserts the historical
 * table while that file is rewritten: a pure function with tests that the app
 * never calls is dead code with a green badge, which is the exact failure mode
 * this session keeps having to name. It is marked, not trusted.
 */
/** @deprecated the app never seeds at boot any more; use fixtures/apply.mjs. */
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
      'SEED_ON_BOOT=true is set on a production-mode process. Boot-time seeding no longer exists, so nothing will be seeded either way - but the flag means someone expects demo data, and demo fixtures delete the eleven collections they own before writing. If this is a staging box that genuinely wants them, set ALLOW_DEMO_SEED=true as well and apply them deliberately with "npm run fixtures:apply" (never at boot). If it is a real deployment, unset SEED_ON_BOOT and create the first administrator with BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD.'
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

/**
 * Did the environment ask for boot-time seeding?
 *
 * This is all the app now needs to know about SEED_ON_BOOT. It is not a decision
 * to seed - nothing seeds at boot - it is the acknowledgement that somebody set a
 * variable which used to load demo data and no longer does, so the process can say
 * so out loud instead of leaving them to conclude the data had arrived. An
 * unheeded flag is indistinguishable from a working one in a log that says nothing.
 */
export const seedRequestedAtBoot = () => {
  const flag = String(process.env.SEED_ON_BOOT || '')
    .trim()
    .toLowerCase();
  return ['true', '1', 'auto'].includes(flag);
};
