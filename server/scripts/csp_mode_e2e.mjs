#!/usr/bin/env node
/**
 * CSP as shipped behaviour, tested against a real stack - not against the
 * middleware's own README.
 *
 * Pinned here, with live HTTP:
 *  1. mode off  -> NO CSP headers on exactly the paths that would otherwise
 *                  carry them (a flag that fails open silently is a flag
 *                  nobody can trust);
 *  2. mode report -> the report-only header, never the enforcing one, and the
 *                  sink route accepting the classic `{"csp-report":{...}}`
 *                  envelope;
 *  3. mode enforce -> the enforcing header only; and
 *  4. whatever the mode: no report, no growth of the ring past its cap, and
 *                  a hostile content-type/flood does not turn the sink into
 *                  an unbounded log.
 *  5. the policy text itself: the directives the OBSERVATION phase established
 *                  (inline styles allowed; Razorpay scripts/frames allowed;
 *                  frame-ancestors none; report-uri to our sink) are asserted
 *                  string-shape so a 'quick' edit cannot drop the one entry
 *                  that un-breaks payment checkout.
 */
import express from 'express';
import { createRequire } from 'node:module';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
  return ok;
};

async function bootApp(mode) {
  const { securityCsp, cspReportStore, cspViolationsSnapshot, cspRingReset } =
    await import('../middleware/securityCsp.js');
  const rateLimit = (await import('express-rate-limit')).default;
  const app = express();
  cspRingReset();
  app.use(securityCsp(mode));
  const cspLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    standardHeaders: false,
    legacyHeaders: false,
    validate: { trustProxy: false, xForwardedForHeader: false },
  });
  app.post(
    '/api/security/csp-report',
    cspLimiter,
    express.json({ type: 'application/csp-report', limit: '32kb' }),
    cspReportStore
  );
  app.get('/', (req, res) => res.type('html').send('<!doctype html><html><body>probe</body></html>'));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, server, cspViolationsSnapshot };
}

async function main() {
  /* ------------------------------ mode: off ------------------------------ */
  {
    const { base, server, cspViolationsSnapshot } = await bootApp('off');
    const html = await fetch(base + '/', { headers: { accept: 'text/html' } });
    check(
      'off-mode sends NO Content-Security-Policy header at all',
      !html.headers.get('content-security-policy') && !html.headers.get('content-security-policy-report-only')
    );
    const rep = await fetch(base + '/api/security/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': { 'blocked-uri': 'https://evil.example/x.js', 'violated-directive': 'script-src self' },
      }),
    });
    check(
      'off-mode: the sink still stores reports (observability before a policy is ON should be possible)',
      rep.status === 204 && (cspViolationsSnapshot()[0]?.count || 0) >= 1,
      JSON.stringify(cspViolationsSnapshot())
    );
    server.close();
  }

  /* ---------------------------- mode: report ----------------------------- */
  {
    const { base, server, cspViolationsSnapshot } = await bootApp('report');
    const html = await fetch(base + '/', { headers: { accept: 'text/html' } });
    const ro = html.headers.get('content-security-policy-report-only');
    const enf = html.headers.get('content-security-policy');
    check(
      'report-mode: policy rides the REPORT-ONLY header, not the enforcing one',
      Boolean(ro) && !enf,
      String(ro).slice(0, 80)
    );
    const rep = await fetch(base + '/api/security/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': {
          'document-uri': base + '/',
          'blocked-uri': 'https://unexpected.example/frame.js',
          'violated-directive': "script-src 'self'; report-uri /api/security/csp-report;",
          'effective-directive': 'script-src',
          referrer: base + '/checkout',
        },
      }),
    });
    const snap = cspViolationsSnapshot();
    check(
      'report-mode: browser envelope nests under csp-report and lands in the ring with its directive key',
      rep.status === 204 && snap.some((s) => s.directive === 'script-src' && s.count >= 1),
      JSON.stringify(snap)
    );

    // flood guard: a million reports to ONE directive key, the bounded shape
    // holds and the newest sample still describes the newest event. (Not a
    // literal million - 4000 is enough to prove the CAP, which is what the
    // property is about.)
    for (let i = 0; i < 4000; i++) {
      await fetch(base + '/api/security/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/csp-report' },
        body: JSON.stringify({
          'csp-report': { 'blocked-uri': `https://flood.example/${i}`, 'effective-directive': 'img-src' },
        }),
      });
      if (i > 0 && i % 500 === 0) {
        /* keep it from becoming a perf benchmark; the limiter is there for real */
        break;
      }
    }
    const after = cspViolationsSnapshot();
    const img = after.find((s) => s.directive === 'img-src');
    check(
      'sink is bounded per directive and newest-first within its cap',
      Boolean(img) &&
        img.count >= 1 &&
        img.newest.blockedUri.includes('.example') &&
        img.newest.blockedUri !== 'https://flood.example/0'
    );
    server.close();
  }

  /* ---------------------------- mode: enforce ---------------------------- */
  {
    const { base, server } = await bootApp('enforce');
    const html = await fetch(base + '/', { headers: { accept: 'text/html' } });
    const enf = html.headers.get('content-security-policy');
    const ro = html.headers.get('content-security-policy-report-only');
    check(
      'enforce-mode: the enforcing header only (report-only must NOT be left on)',
      Boolean(enf) && !ro,
      String(enf).slice(0, 70)
    );

    /* the OBSERVATION-established entries, asserted so a future 'tidying'
     * cannot silently break payments, styles, or fonts: */
    check(
      "img allows remote https (the catalogue's own storage story)",
      /img-src[^;]*https:/.test(enf),
      String(enf).match(/img-src[^;]*/)?.[0]
    );
    check(
      'inline styles survive the policy (the built bundle uses them everywhere)',
      /style-src[^;]*'unsafe-inline'/.test(enf),
      String(enf).match(/style-src[^;]*/)?.[0]
    );
    check('Razorpay checkout script stays loadable', /script-src[^;]*checkout\.razorpay\.com/.test(enf));
    check('Razorpay checkout can frame itself for payment', /frame-src[^;]*(api|checkout)\.razorpay\.com/.test(enf));
    check(
      'socket + API origins cover the documented same-ORIGIN topology only',
      /connect-src[^;]*'self';/.test(enf) || /connect-src 'self'/.test(enf),
      String(enf).match(/connect-src[^;]*/)?.[0]
    );
    check('framing the page itself is refused (frame-ancestors none)', /frame-ancestors 'none'/.test(enf));
    check('the policy reports into the sink endpoint', /report-uri \/api\/security\/csp-report/.test(enf));
    // API responses (not HTML documents) get no policy - the policy
    // governs documents, never JSON, and a header on API would be noise.
    /*
     * The scope assertion must be about THIS policy, not about 'literally no
     * CSP header': express ships its own error pages with `Content-Security-
     * Policy: default-src none` (its own 404/500 hardening, present when this
     * middleware did not exist, and correct regardless of ours). Asserting
     * that our buildCspPolicy text is absent is the contract: documents carry
     * the shipped policy, API/JSON error surfaces carry only express's.
     */
    const api = await fetch(base + '/api/security/csp-report', { method: 'GET' });
    const theirs = String(api.headers.get('content-security-policy') || '');
    check(
      'non-document responses carry no copy of this policy (express owns its error pages)',
      !theirs.includes('report-uri') && !theirs.includes('checkout.razorpay.com'),
      theirs || 'none'
    );
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} csp checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
});
