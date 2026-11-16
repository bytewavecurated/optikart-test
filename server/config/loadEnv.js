/**
 * Imported FIRST by server.js, for one reason: ESM evaluates a module's imports
 * depth-first, before the importing module's own body runs. Anything that reads
 * `process.env` at import time - and `middleware/auth.js:12` does exactly that
 * with JWT_SECRET - therefore sees nothing but undefined while its own file is
 * being evaluated, no matter where `dotenv.config()` sits in server.js's body.
 *
 * That was a live bug, not a style point: `node server.js` with credentials only
 * in `.env` produced a server where every login route called
 * `jwt.sign(payload, undefined)`. It was masked in CI and in our harnesses
 * because those pass JWT_SECRET through the real environment.
 *
 * `ENV_FILE` lets a test harness point at an empty file and stay hermetic -
 * which matters because `.env` also carries SMTP_* and CLOUDINARY_*: loading it
 * inside a test run means the tests email Gmail and upload to the CDN.
 *
 * Existing environment variables always win (dotenv default, override:false),
 * so this never hides an explicitly supplied configuration.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = process.env.ENV_FILE || path.resolve(HERE, '..', '.env');
dotenv.config({ path: ENV_PATH });

/** Boot-time validation, because a missing secret is a security failure, not a warning. */
export function assertRuntimeSecrets({ nodeEnv = process.env.NODE_ENV } = {}) {
  const secret = String(process.env.JWT_SECRET || '');
  const weak = secret.length < 32 || /^(change|your|secret|test|dev)[-_]/i.test(secret);
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to boot rather than signing sessions with an empty secret ' +
        `(ENV_FILE=${ENV_PATH}).`
    );
  }
  if (nodeEnv === 'production' && weak) {
    throw new Error('JWT_SECRET in production must be a fresh value of at least 32 characters.');
  }
  return { loadedFrom: ENV_PATH, strength: secret.length, weakInProduction: Boolean(nodeEnv === 'production' && weak) };
}

export const envFileInUse = ENV_PATH;
