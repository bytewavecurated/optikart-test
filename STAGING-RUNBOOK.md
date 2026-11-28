# STAGING-RUNBOOK.md — production-shape validation before any real credential goes anywhere near this app

Companion to `PRODUCTION-CHECKLIST.md` (the _why_ lives there).
This document is the _how_, in order, for a staging instance that boots with
`NODE_ENV=production` and behaves exactly like the public deployment — except
with disposable credentials.

**Non-negotiable rules for this document**

- Placeholders only. The values below are deliberately fake (all caps angle
  brackets, or obviously dummy strings). Real secrets go into the host's
  secret store (systemd env, docker `env_file` with `0600`, or the cloud
  vault) — never into a git-tracked file, never pasted into issues, PRs,
  chat, or shell history.
- Staging may use sandbox/live-shaped-but-disposable services (Razorpay test
  keys, Ethereal SMTP). The _variable names and validation steps_ are
  identical to production; only the values differ. That is the whole point.
- Nothing here triggers credential work in production. Phase 4 is a rehearsal
  run with the staging values. The same procedure, with real values, is what
  executes at go-live.

---

## Phase 0 — Prerequisites (no secrets yet)

- [ ] Deploy the SHA whose `CI` run is green on main (check GitHub Actions).
- [ ] Host: Docker + compose files present; ports 80/443 will be published
      later; Mongo container on the compose network only (never published).
- [ ] A staging DNS name (e.g. `staging.<domain>`) and TLS issuing available.
- [ ] An Ethereal test mailbox for staging SMTP (free, captures mail):
      `https://ethereal.email` → generate → note SMTP host/port/user/pass.
- [ ] Access list confirmed for this runbook: who can edit the staging env
      file/vault entries (name the people here). - ____________________ (holds `staging.env` / vault path: ___________)

## Phase 1 — Environment variables (placeholders, grouped)

Legend: **[B]** = boot blocker: production startup _refuses to run_ (or
silently degrades a security feature) without it — verify behaviour as noted.
[O] = optional / feature-gated.
[T] = tuning knob, safe defaults exist. Generation commands produce real
values on the staging host — run them there, paste results only into the
vault — and this runbook never sees them.

### 1 Core runtime

```
NODE_ENV=production                      # always production-shape on staging
PORT=5000                                # inside compose; nginx → 443
MONGODB_URI=mongodb://APP_USER:REDACTED-VISIBILITY@IP_or_HOST:27017/eyewear-platform?authSource=admin   # [B] least-privilege user: readWrite on app DB only
JWT_SECRET=REGENERATE-openssl-rand-base64-48   # [B] boot refuses if missing/short/weak
FRONTEND_URL=https://staging.YOUR-DOMAIN      # [B-ish] CORS single origin; never *
TRUST_PROXY_HOPS=1                       # [T] must match real topology; wrong = broken IP-keyed limiters
JSON_BODY_LIMIT=1mb                      # [T] request body cap
REDIS_URL=                               # [O] only if limiter store = Redis; otherwise memory (documented)
DOTENV_KEY=                              # [T] if the env file is encrypted at rest
ENV_FILE=/etc/optikart/staging.env       # or none — systemd/Compose env_file both acceptable
```

### 2 Accounts / bootstrap / session policy

```
BOOTSTRAP_ADMIN_EMAIL=admin-BOOTSTRAP@staging.example   # [B for first admin] one-time, retired in Phase 4.1
BOOTSTRAP_ADMIN_PASSWORD=BOOTSTRAP-ONCE-PLACEHOLDER     # [B] strong one-time; rotated away in Phase 4
BOOTSTRAP_ADMIN_NAME=Bootstrap Administrator            # [T]
SESSION_IDLE_MINUTES=60                                 # [T] console idle sign-out (boot log prints it)
SESSION_ABSOLUTE_HOURS=12                               # [T] 0 disables; keep it enabled for staging parity
AUTH_OTP_BYPASS=                                       # ⚠ LEAVE UNSET. Read in dev only; production code path refuses it (pilot drill proves)
```

### 3 Mail (OTP, order confirmations, invoices)

```
SMTP_HOST=smtp.mailtrap.io      # staging: Ethereal host from Phase 0   [B in production: boot refuses without SMTP]
SMTP_PORT=587
SMTP_USER=ethereal-GENERATE-ON-ETHEREAL
SMTP_PASS=ethereal-generated
MAIL_FROM_NAME=OptiKart Staging
ETHEREAL_API=https://api.nodemailer.com   # [O] only for test-mode capture tooling
ETHEREAL_USER=
ETHEREAL_PASS=
```

### 4 Payments

```
RAZORPAY_KEY_ID=rzp_test_KEY_ID_PLACEHOLDER       # staging: TEST keys only
RAZORPAY_KEY_SECRET=rzp_test_KEY_SECRET_PLACEHOLDER
# NOTE: webhook authenticity here is HMAC over the raw body with RAZORPAY_KEY_SECRET (the app has no separate webhook-secret variable). If the dashboard offers a dedicated webhook secret, keep it equal to the key secret or extend the route deliberately.
RAZORPAY2_KEY_ID=            # [O] second gateway account if payouts use a different MID
RAZORPAY2_KEY_SECRET=
```

### 5 Shipping

```
SHIPROCKET_EMAIL=staging-account@YOUR-DOMAIN   # [B if Shiprocket used] the service authenticates /v1/login with EMAIL+PASSWORD (token cached ~20 min) — these two are the real API credentials here
SHIPROCKET_PASSWORD=SRP-ACCOUNT-PASSWORD       # same
SHIPROCKET_WEBHOOK_SECRET=opaque-token-set-in-shiprocket-dashboard   # [B once webhooks are enabled] unset + Shiprocket configured → boot warns; every event 401/503 by design
```

### 6 Storage (PHI lives here — prescriptions)

```
STORAGE_BACKEND=cloudinary     # [B-equivalent] 'local' in production → prescription PDFs answer 410 and boot logs phi_storage_warning (by design; CI proves it)
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME   # [B for PHI] staging = separate cloud (sub-account) if possible
CLOUDINARY_FOLDER=optikart-staging
INVOICE_STORE_DIR=/srv/optikart/generated   # [T] if PDFs live off image; default module-anchored ./server/generated/invoices
ALLOW_LOCAL_STORED_UPLOADS=false            # [T] production posture; true only with deliberate local-storage exceptions
```

### 7 Invoicing identity (printed on every PDF)

```
INVOICE_LEGAL_NAME=YOUR REGISTERED ENTITY LTD      # required before any real invoice
INVOICE_GSTIN=22AAAAA0000A1Z5                       # placeholder format — real GSTIN from your registration; PDF prints a loud "not configured" note while empty
INVOICE_PLATFORM_STATE=Karnataka                    # must match GSTIN state (drives CGST/SGST vs IGST on service lines)
INVOICE_PLATFORM_ADDRESS=street, city, pincode      # as registered
INVOICE_SUPPORT_EMAIL=support@YOUR-DOMAIN
INVOICE_SUPPORT_PHONE=+91-XXXXX-XXXXX
```

### 8 AI / optional features — leave OFF for the first run, enable per feature after their budget talk

```
FACE_DETECTION_SERVICE=none    # aws | google | azure | none
AWS_ACCESS_KEY_ID=  AWS_SECRET_ACCESS_KEY=  AWS_REGION=ap-south-1
GOOGLE_VISION_API_KEY=
AZURE_FACE_API_KEY=  AZURE_FACE_ENDPOINT=
SPEECH_RECOGNITION_SERVICE=none   # google | aws | azure
GOOGLE_SPEECH_API_KEY=
OPENAI_API_KEY=  CHATBOT_ENABLED=false  OPENAI_MODEL=  CHATBOT_MAX_TOKENS=  CHATBOT_TEMPERATURE=
VIRTUAL_TRYON_ENABLED=false  VIRTUAL_TRYON_API_KEY=
PAID_AI_MAX_PER_HOUR=30      # [T] limiter across the paid endpoints
AI_ORDER_ASSIGNMENT=off      # [T] feature flag per assignment engine use
MAX_DELIVERY_LEG_KM=  PARTNER_PICKUP_RADIUS_KM=   # [T] business radii — copy from production decisions doc
PARTNER_RANK_TZ_OFFSET_MINUTES=330                # [T]
```

### 9 Push notifications (optional)

```
VAPID_PUBLIC_KEY=  VAPID_PRIVATE_KEY=  VAPID_SUBJECT=mailto:admin@YOUR-DOMAIN
GCM_API_KEY=      # legacy FCM; replace with a v1 service account if web push v1 in prod
```

## Phase 2 — Boot validation

- [ ] `docker compose up -d --build` (or host deploy of the CI tag).
- [ ] **Negative test first** (do this ONCE with one variable emptied, then
      restore — e.g. remove `JWT_SECRET` and attempt a container start):
      the process must REFUSE with a named reason, not boot degraded.
- [ ] Normal boot: - [ ] logs show `Server running on port …`, no `phi_storage_warning`
      (if STORAGE_BACKEND is cloudinary and CLOUDINARY_URL is set) - [ ] `GET /api/health` → {"success":true,"status":"ok"} - [ ] `curl -sI https://staging.YOUR-DOMAIN/ | grep -i content-security-policy`
      → CSP present, `default-src 'self'…` (production-mode default) - [ ] Security headers: `nosniff`, X-Frame `DENY`, no `X-Powered-By`.
- [ ] Data shape: production refuses demo seeds (seed guard) — confirm the
      users table has EXACTLY the bootstrap admin (admin list page) and zero
      demo accounts.

## Phase 3 — Functional validation (staging services, production code paths)

Run these with a test shopper; keep the outputs for the evidence folder.

- [ ] **Admin bootstrap.** Browser → login as BOOTSTRAP_ADMIN_* → expect the
      emailed OTP (Ethereal inbox), sign in. `GET /api/admin/users` count=1.
- [ ] **Customer register/login.** `/api/auth/register` → 201 + no token in
      any body field that leaks OTP; login → generic error on wrong password
      (no "not registered" anywhere).
- [ ] **Order → customer invoice.** Place COD order.
      `GET /invoices/mine` shows `CI…`; `GET /invoices/:id/pdf` returns
      `%PDF`. Open the PDF: numbers match order total `totalAmount`,
      CGST+SGST or IGST follows shipping state; mail captured by Ethereal.
- [ ] **Fulfilment → seller invoice.** Seller ships → deliver.
      `GET /invoices/seller` shows `SI…`; totals equal
      `/api/commission`-recorded numbers; mail captured.
- [ ] **Webhook posture.** Shiprocket event without secret → 401/503; with
      the correct secret header → processed. Razorpay unsigned callback →
      refused. Replays of processed events don't duplicate (state machine).
- [ ] **Coupons scope.** Glasses-only code refused on sunglasses cart with
      the naming sentence.
- [ ] **Tenancy walls (this is the security core).** From a second staging
      customer token: other's order → 404; other's invoice → 404;
      console endpoints with customer token → all non-200; anonymous `/pdf` → 401. Record every code; any 200 = STOP, file incident.
- [ ] **Limiters.** 11 bad logins on a throwaway staging account → 429
      observed; correct creds also refused inside window; 30 OTP-sweep
      requests → 429 probe ceiling.
- [ ] **Session policy.** Console idle → 401 `SESSION_IDLE`; age-shifted
      token → `SESSION_TOO_OLD` (verify env prints at boot).
- [ ] **Security ring.** `GET /api/admin/system/security-events` (admin) →
      counts move after the deliberate 401s above (guard_drop, revoked_use,
      webhook_signature, auth_throttle). Customer/anon → 401/403.
- [ ] **Backups.** `bash scripts/backup-mongo.sh` against staging DB → dump
      exists; restore drill command from the checklist comment runs
      (throwaway DB port, never prod).

## Phase 4 — Credential lifecycle (staging REHEARSAL — and the same ordered

steps become production go-live)

> Perform every step here against staging first. The production execution of
> this exact list is the "credential work" the production checklist's A-1/A-2
> describes; scheduling _that_ is a separate go-ahead.

### 4.1 Bootstrap admin retirement (do immediately after Phase 3 admin checks)

1. Create your day-to-day admin/named staff identities via
   `/admin` → Staff → New staff (each gets its own credential; the console
   requires OTP regardless).
2. Verify you can sign in as one of them, and that login requires the OTP leg
   in staging (email captured via Ethereal — confirm).
3. Retire the bootstrap account: either
   - admin console → Users → find `BOOTSTRAP_ADMIN_*` → deactivate
     (`PUT /api/admin/users/:id/ban` with `{"isActive":false}`) — then remove
     `BOOTSTRAP_ADMIN_EMAIL/_PASSWORD` from the staging env and
     `docker compose up -d` — or
   - if you want it fully out of the table, use the delete endpoint
     (destructive on a non-loginable account): `DELETE /api/admin/users/:id`.
4. Evidence: the account no longer authenticates; boot never re-creates it
   (bootstrap only creates when missing — verify by restarting once).

### 4.2 JWT_SECRET rotation (scheduled sign-out window)

- [ ] Generate: `openssl rand -base64 48` → into vault entry `optikart/staging/jwt_secret` v2.
- [ ] Update env, restart: **all sessions die** (expected and correct),
      pending reset OTP digests die with them (peppered) — users sign in again.
- [ ] After rotation: verify login, invoice download, webhook signature path.

### 4.3 Other credentials — rotate each at staging rehearsal, schedule the real one

| Credential                | Where staging keeps it    | Rehearsal step                                               | Production go-live step                                                                                                   |
| ------------------------- | ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Mongo app password        | vault                     | create new secret, rotate via provider, restart, verify pool | same, plus revoke least-priv user old password                                                                            |
| SMTP account              | vault                     | generate Ethereal (disposable by design)                     | DMARC-aligned mailbox creds from mail host, tested with OTP mail + invoice mail                                           |
| RAZORPAY (test key pair)  | vault                     | test payment end-to-end incl. webhook + paid-stamp PDF       | swap to LIVE keys at rotation moment per checklist B-10; set webhook secret equal to app's; revoke test keys in dashboard |
| SHIPROCKET_WEBHOOK_SECRET | vault                     | set dashboard token = env value; fire test event             | same with production token; watch 401 vs 503 in ring                                                                      |
| CLOUDINARY keys           | vault                     | staging cloud subaccount                                     | production cloud; PHI bucket private, signed URL discussion deferred to the checklist's item 11                           |
| Deploy PAT / GH secret    | GitHub → fine-grained PAT | revoke rehearsal PAT                                         | issue scoped, expiring PAT for deploy automation once, store in Actions secret, nothing in a repo file                    |

### 4.4 Housekeeping evidence (this PR itself)

- [ ] Run `gitleaks`-equivalent scan (or `git log -p -S "github_pat_"`,
      `-S "rzp_live"` etc. — none should exist anywhere in history
      besides intentional test values).
- [ ] `grep -RE "(AKIA|rzp_live|LTAI|github_pat_)" .` empty on workdir except tests' fake tokens.

## Phase 5 — Sign-off & rollback

**Sign-off table (fill initials + date, keep in evidence folder or PR comment)**

| Check                                     | Verified by | Date |
| ----------------------------------------- | ----------- | ---- |
| Boot negatives (missing secret refuses)   |             |      |
| CSP + headers on served page              |             |      |
| Register/login/order/invoice walk         |             |      |
| Seller settlement invoice + mail evidence |             |      |
| All tenancy walls refused (no 200s)       |             |      |
| Webhook forged/replayed refused           |             |      |
| Bootstrap account retired                 |             |      |
| JWT rotation rehearsal done               |             |      |
| Backup + restore drill artifacts stored   |             |      |
| Secret scanner clean                      |             |      |

**Rollback / de-risk**

- Any boot blocker misconfigured → previous container tag + previous vault version; the app has no half-migrated state to unwind (invoices store their files by number; re-run backfill heals docs).
- CSP regressions: `CSP_MODE=report` while diagnosing; never off.
- If staging ever leaks: rotation table becomes urgent — follow 4.3 now.

**Next document**: production deployment follows `PRODUCTION-CHECKLIST.md`
sections A → B+ → C; Phase 4 above is its rehearsal counterpart.
