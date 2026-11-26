# PRODUCTION-CHECKLIST.md — the work between "green CI" and "live to the internet"

CI proves the code does what it claims on a throwaway box. None of the items
below are CI's job; they are operator actions, grouped by when they happen.
Items marked **[BLOCKER]** mean the app refuses to boot (or silently degrades)
without them in a real deployment. **[Gate]** items are proven already by a
CI run or suite; verify them stays true where you deploy, and keep the
evidence.

The application-side defaults are documented in SYSTEM.md; this file is the
operational mirror. Nothing here is optional advice — it is the list of
things a production OptiKart cannot work without, and the verification for
each.

---

## A. Before the first public DNS record

1. **[BLOCKER] Secrets that must exist, and where they live.**
   Generate fresh values; store them in the platform secret manager (never
   in shell history, never committed):
   - `JWT_SECRET` — ≥32 fresh chars. Boot refuses a weak/absent one (Gate:
     config/loadEnv assert + pilot drill).
   - `MONGODB_URI` — a database user scoped to the app DB, least privilege:
     `readWrite` on app collections only; no `root`, no `dbAdmin`. Confirm
     the Atlas/project user CANNOT run `dropDatabase` — the fixtures guard
     protects the repo, not an intruder holding one env var.
   - `SMTP_HOST/USER/PASS` — **[BLOCKER]** production boot refuses without
     it: every OTP flow dies silently (and an emailed code nobody receives
     means every console is unreachable). Pin the credential to a mailbox
     that is monitored for bounces.
   - DNS for the mail domain: **SPF** include, **DKIM** signing, **DMARC**
     (`p=quarantine` at first). Verify with a digest + a real mailbox.
     Without these, your password-reset mail is spoofable and lands in spam
     (L199/#199).
   - `CLOUDINARY_URL` — **[BLOCKER for PHI]** prescription files: production
     on the local disk answers 410 by design (#11 CI smoke proves it).
     Uploads belong off the app box, in a private bucket.
   - Razorpay: `RAZORPAY_KEY_ID/SECRET` from the LIVE dashboard, plus
     **RAZORPAY_WEBHOOK_SECRET equivalent** configured on the Razorpay
     webhook (the app HMAC-compares it; CI proves forged signatures die,
     your dashboard must actually send signed events).
   - **`SHIPROCKET_WEBHOOK_SECRET`** — the exact token you set in the
     Shiprocket dashboard. Unset == every shipping event rejected with 503
     (intentional: the route mutates order state and will not guess).
     A loud boot warning fires in production when Shiprocket looks
     configured but the secret is missing — treat that as a P2 until fixed.
   - AI keys (`AWS_*` Rekognition, Google/Azure speech) — only if those
     features ship; each costs money and each is now behind a per-hour
     limiter (F/167): the limiter does not zero the bill, key absence does
     if the feature is unreleased.

2. **[BLOCKER] Account bootstrap.**
   Set `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` (strong, unique).
   On first boot the app creates the one admin (no demo seeding — the
   production seed guard refuses it, and CI's suite proves the refusal).
   Immediately afterward: create your real named admin identities through
   the console, then **rotate or rotate-away the bootstrap credential** —
   those values existed in .env (and possibly your terminal history). The
   previous demo/admin passwords that ever sat in this repo's history are
   considered public: nobody may reuse them on this system.

3. **Network posture.**
   - The only ports facing the internet: 80 → redirect, 443 TLS-terminating
     reverse proxy (Caddy/nginx/cloudflare). TLS, HSTS, secure cookies live
     there; SYSTEM.md notes the proxy headers must mirror the app's
     `client/nginx.conf` baseline.
   - MongoDB: never published (compose already keeps it on the internal
     network; a hosted DB uses VPC/IP-allowlist to the app subnet only).
   - SSH: keys only, no password auth, no root-forwarded anywhere public;
     the deploy user cannot bind port 80/443 directly (use systemd).

4. **Edge rate limiting / WAF.**
   The app counts attempts by account/email (and now by IP for OTP sweeps),
   which is exactly as good as `req.ip` behind your proxy: set
   `TRUST_PROXY_HOPS` to the real hop count and make the PROXY enforce a
   coarse per-IP limit too (login/forgot endpoints especially). A shared
   office NAT collapses into one IP bucket — the account-level keys are why
   they exist, but a WAF still stops the 30k-sweeps class.

5. **Backup pipeline before data exists.** (rec #3)
   - `server/scripts/backup.sh` + `backup-mongo.sh` on a cron; restore drill
     quarterly; CI's restore-drill job proves the tool itself on every push —
     your offsite copy is your job. Encrypted at rest (versioned bucket with
     block-public-access, or `age`-encrypted blobs), access restricted to the
     backup role.
   - Prescription/PHI backups inherit the same ACL; if Cloudinary, mirror
     from the CDN side with private-asset settings.

6. **Session policy decision.**
   Defaults are live: console idle 60 min (`SESSION_IDLE_MINUTES`) + absolute
   ceiling 12 h (`SESSION_ABSOLUTE_HOURS`; 0 disables it, and you should not
   unless documented). Customer tokens stay long-lived by design — the
   storefront checkout flow leans on it. Write-down: if your policy says
   "console sign-outs daily at midnight", cap 12h already covers it.

## B. Between deploy and DNS

7. **[Gate] Boot the REAL production box once with the real environment and
   walk:** `/api/health`, admin login (+OTP email lands), customer login +
   one COD order + one paid order sandbox → webhook accepted (check the
   ring), upload an image → it lands in Cloudinary URLs not disk ones,
   `GET /api/admin/system/security-events` returns the ring (that proves the
   monitoring wiring you will alert on next).

8. **[Gate] CSP / headers smoke** — CI's production-shaped boot curl proves
   `Content-Security-Policy: default-src 'self'…` on a served document. Do
   the same once against the public host (headers through the proxy:
   HSTS + your TLS grade). Staging rollout method for any policy edits: run
   `CSP_MODE=report` + watch the violations ring before enforcing.

9. **Monitoring & alerting (what page(s) a human).**
   - Scrape or poll `/api/admin/security-events` (service `securityEvents`)
     every minute with an admin token from a secrets-safe job; alert on
     growth of `guard_drop` (probing), `webhook_signature` (forgery attempts
     that reached the door), `revoked_use`, `auth_throttle`.
   - Ship structured logs (`mongo_guard_drop`, `session_guard_error`, the
     `event:` JSON lines) to an immutable aggregator; grep-able uptime for
     a week at minimum (F165/F166).
   - Alert channels: 5xx rate, boot with any `*_warning` line, backup job
     failure, disk on the uploads volume (local fallback boxes only).
   - Uptime probes: `/api/health` + the storefront + one slow DB read.

10. **Razorpay dashboard reconciliation.**
    Webhook: only the events your code consumes, retry warnings on, signing
    secret = what the app holds. Payments section: test mode first, then ONE
    live rupee end-to-end verified in `paymentStatus` and the settlement CSV
    before pointing checkout users at it.

## B+. Invoicing before the first customer sees a PDF

11. **Platform invoicing identity must be real before DNS.** Set
    `INVOICE_LEGAL_NAME`, `INVOICE_GSTIN`, `INVOICE_PLATFORM_STATE`,
    `INVOICE_PLATFORM_ADDRESS`, `INVOICE_SUPPORT_EMAIL/PHONE`; the engine
    boots fine WITHOUT them (dev default name, blank GSTIN) but the
    documents then carry `NOTE: platform GSTIN not configured` across the
    footer - acceptable on a laptop, unacceptable on the open web. The PDF
    renderer prints exactly what you put in, once, for every copy forever.
    Also decide `PAID_STAMP` behaviour? (it is automatic: capture -> the
    customer PDF shows PAID and mails one paid copy.)
12. **GST/HSN tables need CA sign-off.** `services/gst.js` carries the
    defaults (HSN 9004 @18% spectacles/sunglasses, 9001 @12% contact lenses,
    services SAC 9965/9972 @18%); classification is a professional
    judgement, and a wrong slab on issued documents is a notice-and-amend
    conversation with tax - not a code fix. Use the admin Invoices page's
    _Tax classification_ panel (per category / brand / product overrides,
    each with a `confirmed` flag) and have your accountant walk the list
    for the categories you actually sell BEFORE announcing launch dates.
    (Already-issued documents never rewrite; that is by design.)
13. **Storage + delivery of the papers.** PDFs live on the host under
    `server/invoices-private/` (outside the web root; downloads are token
    authenticated, never URL-guessable, never public): if you move them off
    host (S3/SMB share), mount that path at `server/invoices-private` OR
    set `INVOICE_STORE_DIR` - the engine reads/writes through one module so
    a host migration is a one-line env and backfill is unchanged.
14. **Run the backfill after upgrade/migration** once, then whenever the
    ops alert `invoice_*_failed` ever fired:
    `MONGODB_URI=... node scripts/invoices_backfill.mjs [--dry]`. The
    invoice number series is collision-checked by the shared mint registry
    (same machinery as DP/EXEC/RET ids); gaps in the series printed on
    documents are normal for voided/cancelled drafts - keep the series
    monotonic, which is what tax folks check.

## C. Day one of real traffic

11. **Rotation calendar.** SMTP creds, JWT_SECRET (requires deliberate logout
    of all sessions), Cloudinary keys, payment keys, bootstrap admin
    password. Start at 90 days, review after the first pass. JWT_SECRET
    rotation: sessions die instantly — schedule it like a maintenance
    window; nothing else breaks (the app re-signs everything it minted).

12. **Account-hygiene review.** No demo accounts exist on this box by
    construction, but check anyway: `users.countDocuments(role:admin)` ==
    the humans on your ops list; sellers/manufacturers pending are pending;
    nobody's `isActive:false` flag was overridden; and confirm the seeded
    bypass list never got an account in your production DB (it cannot be
    created there: bypass is `isProduction`-gated — verify the env truth).

13. **Supply chain** (recs #4/#10, the machine half is done — your half):
    Actions are pinned to commit SHAs with `# vX.Y.Z` comments: every bump
    must be deliberate (verify the tag peels to that SHA), Dependabot opens
    the PRs, the CI audit gate fails high/critical. Enable GitHub's security
    overview page (secret-scanning + push protection) on the repo — it is a
    repo setting, not a file. The mongo CI image is digest-pinned; your
    runtime base images (`node:22-…`) get the same treatment in compose /
    Dockerfile when you cut a release tag (pin the digest, keep the
    `# vX` comment).

14. **Incident readiness.** One page that says who answers at 3am for DB,
    payments, mail. Rehearse: revoke a token and watch `revoked_use`; forge
    a webhook and watch `webhook_signature`; then restore the latest backup
    on a scratch box — you've drilled it twice a year from here.

---

Verification ledger — what CI already refuses to ship without:

- 49 harness groups (54 live attack probes + all authz matrices)
- mutation-route allowlist audit; static security gate
- CSP enforce default smoke (incl. the PHI 410 door)
- production-OTP/bypass refusal pilot drill; seed guard; backup restore drill
  The rest of this checklist is the part that only exists in YOUR environment.
