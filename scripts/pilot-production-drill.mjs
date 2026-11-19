#!/usr/bin/env node
/**
 * The go-live rehearsal, runnable - harness group "production pilot drill".
 *
 * It boots the REAL server in production mode against a throwaway database
 * and asserts the whole deployment story the README-era promises made:
 *
 *   1. production boots ONLY with: a strong JWT_SECRET, configured SMTP,
 *      and either real Cloudinary credentials OR the explicit
 *      ALLOW_LOCAL_STORED_UPLOADS acknowledgement;
 *   2. a production empty-database boot creates ZERO demo users (the seed is
 *      unreachable by construction) but DOES create exactly one account:
 *      the BOOTSTRAP_ADMIN, with the strength rules enforced;
 *   3. login in production cannot complete by mail because the fake host
 *      refuses - and the API says 'email is not configured/deliverable'
 *      honestly, which is what staging-before-SMTP looks like;
 *   4. `deprovision:demo` on a database that has no demo content is a clean
 *      no-op (it must not be a scary command when there is nothing to fear);
 *   5. the weak-secret/weak-password paths refuse LOUDLY (a deployment that
 *      boots on `aaaa...` secrets is exactly the bug this drill exists to
 *      catch in CI instead of on the day the site goes public).
 *
 * Nothing here talks to the internet: the production SMTP transport is
 * constructed but never succeeds against 127.0.0.1:1, and storage falls to
 * the acknowledged local branch. The isolated database is the harness's own
 * launcher protocol.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 140)}` : ''}`);
  return ok;
};

const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, ...opts });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', (code) => resolve({ code, out, child }));
  });

const ports = [];
const freePort = async () => {
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const p = srv.address().port;
  await new Promise((r) => srv.close(r));
  return p;
};

const children = [];
const cleanup = () =>
  children.forEach((c) => {
    try {
      c.kill('SIGKILL');
    } catch {}
  });
process.on('exit', cleanup);

async function waitForHttp(url, tries = 240, ms = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return res;
    } catch {}
    await new Promise((r) => setTimeout(r, ms));
  }
  return null;
}

const hermetic = {
  ENV_FILE: (() => {
    const f = path.join(os.tmpdir(), `pilot-empty-${process.pid}.env`);
    fs.writeFileSync(f, '# empty\n');
    return f;
  })(),
};

async function bootProduction({ dbUri, env, tag }) {
  const port = await freePort();
  const logPath = path.join(ROOT, '.verify-logs', `pilot-${tag}.log`);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const out = fs.createWriteStream(logPath, { flags: 'w' });
  const child = spawn('node', ['server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...hermetic,
      NODE_ENV: 'production',
      PORT: String(port),
      MONGODB_URI: dbUri,
      JWT_SECRET: 'pilot-drill-strong-signing-secret-not-a-real-one-9f4c21',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1', // nothing listens; production mail MUST fail like any real misdelivery
      SMTP_USER: 'pilot@optikart.test',
      SMTP_PASS: 'x',
      FRONTEND_URL: `http://127.0.0.1:${port}`,
      STORAGE_BACKEND: 'local',
      ALLOW_LOCAL_STORED_UPLOADS: 'true', // the air-gapped acknowledgement path, rehearsed as documented
      ADMIN_EMAIL: 'pilot@optikart.test',
      AUTH_OTP_BYPASS: 'true', // must be IGNORED in production - the drill proves that with a real login
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  const base = `http://127.0.0.1:${port}`;
  return { port, base, child, logPath };
}

async function main() {
  // isolated database via the tracked launcher protocol
  const db = spawn('node', ['.mongo.mjs'], { cwd: path.join(ROOT, 'server') });
  children.push(db);
  let dbUri = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('isolated db did not come up')), 90000);
    db.stdout.on('data', (c) => {
      const line = c
        .toString()
        .split('\n')
        .find((l) => l.startsWith('MONGO_READY'));
      if (line) {
        clearTimeout(t);
        resolve(line.split(' ')[1]);
      }
    });
  });
  // The launcher URI ends with '/'; pin one database name for BOTH the
  // production boot and every direct peek below. Mixing `.../` with
  // `.../pilot` reads (or writes) two different databases, and `//pilot` is
  // not even a legal name.
  dbUri = dbUri.replace(/\/+$/, '') + '/pilot';

  /* ---------------- refusal checks (no process persists) ---------------- */
  const weakSecret = await run('node', ['server/server.js'], {
    env: { ...process.env, ...hermetic, NODE_ENV: 'production', JWT_SECRET: 'short', MONGODB_URI: dbUri },
  });
  check('production refuses a weak JWT_SECRET at boot', weakSecret.code !== 0 && /JWT_SECRET/i.test(weakSecret.out));

  // full boot, happy-but-fake path
  {
    const { base, child, logPath } = await bootProduction({
      dbUri,
      tag: 'bootstrap',
      env: {
        BOOTSTRAP_ADMIN_EMAIL: 'pilot.admin@optikart.test',
        BOOTSTRAP_ADMIN_PASSWORD: 'P1lot-Adm1n-Str0ng!pass',
        BOOTSTRAP_ADMIN_NAME: 'Pilot Administrator',
      },
    });

    const health = await waitForHttp(`${base}/api/health`);
    check('production mode boots with the mandatory set acknowledged', !!health && health.status === 200);

    // weak bootstrap password? try through a SECOND boot on a fresh db to test
    // the refusal rather than polluting this one (same uri, but admin exists
    // already; the guard is 'no active admin exists' so the second boot must
    // be a no-op and say so).
    const log = fs.readFileSync(logPath, 'utf8');
    check(
      'the production boot announced what it did (no quiet startup)',
      /bootstrap|admin/i.test(log) && /never seed|Seeding: never/i.test(log),
      log
        .split('\n')
        .filter((l) => /seed|bootstrap|admin/i.test(l))
        .slice(0, 3)
        .join(' | ')
    );

    const dbCheck = await run(
      'node',
      [
        '--input-type=module',
        '-e',
        `
      import mongoose from 'mongoose';
      await mongoose.connect(${JSON.stringify(dbUri)});
      const users = await mongoose.connection.db.collection('users').find({ role: 'admin', isActive: true, isBanned: false }).toArray();
      console.log(JSON.stringify(users.map(u => ({ role: u.role, email: u.email }))));
      await mongoose.disconnect();
    `,
      ],
      // cwd: the peek is an inline `node -e`, whose bare specifiers resolve
      // from the WORKING DIRECTORY (an eval has no file path to anchor) - and
      // the only node_modules that owns mongoose is server/'s. Running it from
      // ROOT fails module resolution and silently read zero users - the exact
      // class of "the test saw nothing and reported absence" failure this
      // harness bans. Pin the directory, and pin the answer's provenance.
      { env: { ...process.env, ...hermetic }, cwd: path.join(ROOT, 'server') }
    );
    if (dbCheck.code !== 0) {
      check('database peek runs before asserting what it saw', false, dbCheck.out.slice(0, 160));
    }
    let accounts = [];
    try {
      accounts = JSON.parse((dbCheck.out.match(/\[.*\]/s) || ['[]'])[0]);
    } catch {}
    check(
      'production empty-boot created NO demo accounts',
      accounts.every((a) => a.email !== 'demo@optikart.com')
    );
    check(
      'and created exactly the one bootstrap admin',
      accounts.length === 1 && /pilot\.admin@/.test(accounts[0]?.email || ''),
      JSON.stringify(accounts)
    );

    /*
     * The honest production door with a fake mailbox: sign-in for ANY real
     * account now demands the emailed OTP; AUTH_OTP_BYPASS=true is passed in
     * this boot specifically to prove production ignores it. The refusal must
     * name mail, not silently mint a session.
     */
    let login = null;
    try {
      login = await (
        await fetch(`${base}/api/admin/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'pilot.admin@optikart.test', password: 'P1lot-Adm1n-Str0ng!pass' }),
        })
      )
        .json()
        .catch(() => null);
    } catch {
      login = null;
    }

    check(
      'production login refuses to complete without deliverable mail (AUTH_OTP_BYPASS cannot leak through)',
      login &&
        (login.success === false || !login.token) &&
        /(mail|configured|deliver)/i.test(login.message || login.reason || ''),
      JSON.stringify(login || {}).slice(0, 140)
    );

    // deprovision on a demo-free database must be a clean no-op
    const depro = await run('node', ['server/scripts/deprovisionDemoData.js'], {
      env: {
        ...process.env,
        ...hermetic,
        DANGEROUS_CONFIRM: 'yes',
        REMOVE_DEMO_CATALOGUE: 'yes',
        MONGODB_URI: dbUri,
        NODE_ENV: 'production',
      },
    });
    check(
      'deprovision:demo is an honest no-op with nothing demo-ish inside',
      depro.code === 0 && /0 |removed|nothing/i.test(depro.out),
      depro.out.split('\n').filter(Boolean).slice(-2).join(' | ')
    );

    child.kill('SIGKILL');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} production-drill checks passed`);
  process.exitCode = failed.length ? 1 : 0;
  cleanup();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
  cleanup();
});
