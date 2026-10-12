# ABC Hotel — Production Readiness Report

Branch `hardening/production-readiness` (5 commits on top of `291b41b`). Nothing has been deployed
or pushed. Date of assessment: 2026-10-10.

**Release status: READY WITH DOCUMENTED LIMITATIONS** — provided the one-time actions in
`docs/DEPLOYMENT.md` are done first (staff passwords verified, `--max-instances 1`), and the public
GitHub data exposure in §2.0 is handled. Not "hacker-proof": these changes remove the confirmed
vulnerabilities found and reduce the attack surface; an external penetration test is still advised.

## 1. Architecture review

Browser → Firebase Hosting (SPA) → Cloud Run `abc-hotel-backend` (Express, `npm start` via
buildpacks) → named Firestore database through the server SDK (ADC). The SPA calls the Cloud Run
URL directly; Firebase Auth is used only for customer phone OTP, verified server-side with
firebase-admin. Firestore client rules are deny-all.

Key architectural risks found:
* **In-memory engine with per-instance state.** All data is loaded at startup; many reads/writes
  go through Firestore, but notifications, runtime payment/billing settings, recipes, stock
  history, dashboard aggregates, booking locks, rate-limit counters and invoice numbering are per
  instance. Live service allows 12 instances → divergence. *Mitigation:* `--max-instances 1`
  (documented); *fix:* move these to Firestore transactions (future work).
* **Production startup replaced Firestore data with seed data** (users with demo password hashes,
  seed menu prices, tables) in memory after every restart. Fixed.
* **Silent write loss:** Firestore quota breaker made writes report success without persisting.
  Fixed (fail closed with 503 in production).
* **Default compute service account** (broad Editor rights). Dedicated least-privilege account
  documented.
* **Live site serves a development React build** (1.7 MB, dev runtime, demo-credentials panel):
  local `vite build` picked up `NODE_ENV=development` from `.env`. Fixed in the build config.

## 2. Security vulnerabilities and fixes

### 2.0 Data exposure requiring your decision (not fixed by me)
The GitHub repository `rakijii199/abc-hotel` is **public**, and `main` contains
`data/hotel_database_backup.json`: 30 users with bcrypt password hashes (28 equal a published
default), names, phone numbers, emails (2 look like real personal Gmail addresses), 171 orders with
customer contact details and delivery addresses, and the hotel UPI ID / mobile number. The file is
downloadable now. An older `data/hotel_database.json` is in history too. 0 forks, public since
2026-10-02. This branch untracks the file, but **removing it from GitHub requires a push and a
history rewrite (force push)**, and possibly making the repository private — all need approval.

### 2.1 Confirmed and fixed
| Severity | Finding | Fix |
| --- | --- | --- |
| Critical | Any employee account accepted `Password@123`, `Password123!`, `Admin@123` (and overwrote the real password) | Fallback removed |
| Critical | Phone-OTP login trusted a client-supplied phone and kept staff roles → ADMIN session via customer login (verified exploitable on old code) | Phone only from verified Firebase token (phone provider); OTP never issues employee sessions; email uniqueness |
| High | Production startup overwrote Firestore users/menu/tables with seed data (demo password hashes) | Seed only fills gaps; seed users never loaded in production; empty-Firestore bootstrap refused unless explicitly enabled |
| High | Unauthenticated crash: un-awaited async calls (verified: one anonymous request killed the old server) | `await` added at 6 call sites; global `unhandledRejection` logger |
| High | Anyone could add items to any order (no auth, ownership or validation) | Auth + ownership + zod (int 1–20, ≤50 lines) + rate limit |
| High | Payment status / attempt status / UPI confirmation without auth or ownership (PII leak, reference tampering) | Auth + owner-or-payment-staff checks |
| High | Razorpay verification not bound to the order: one real payment could mark other orders PAID | Gateway order id must match this order's payment; gateway payment id cannot settle two orders |
| High | Empty Razorpay secrets made HMAC forgeable (secrets are not set in production) | Verification fails closed without secrets; UPI QR flow unaffected |
| High | Manager could reset/modify/remove ADMIN accounts and turn customers into staff | Target-role checks; new employees need explicit password |
| High | Webhook HMAC computed on re-serialized JSON (real webhooks never verified) | Raw body captured for webhook routes |
| Medium | Customers could set kitchen/service statuses; kitchen endpoint could complete/cancel | Customers: cancel only; kitchen: CONFIRMED/PREPARING/READY/SERVED |
| Medium | CORS trusted any `*.web.app`/`*.run.app`/`*.firebaseapp.com`; CSP allowed framing from them | Exact allowlist in production; `frame-ancestors 'self'` |
| Medium | Demo credentials panel and default-password prefill shipped to production | Dev-only panel; strong password generator |
| Medium | No security headers on Firebase Hosting | nosniff, referrer, permissions, frame protection, report-only CSP, caching |
| Medium | Public invoice token from `Math.random`; full PII in public invoice | CSPRNG token; email/ids removed; phone masked |
| Medium | Health endpoint exposed environment and memory; OpenAPI public | Minimal liveness; real readiness; OpenAPI dev-only |
| Low | Stored XSS in printable table QR page | Values escaped |
| Low | Test mock-token path reachable if `IS_TEST_RUN` set in production | Also requires non-production |

### 2.2 Secrets
No private keys, live payment keys or JWT secrets in tracked files or history (all branches).
`.env` never committed. `JWT_SECRET` comes from Secret Manager in Cloud Run. Firebase web config is
public by design. No server secret is bundled into the frontend.

## 3. Bot and abuse protection
* Existing: auth limiter (15–20 per 15 min per IP), general API limiter (250/min/IP).
* Added: order creation/add-items limiter (40/15 min), booking limiter (20/15 min), payment
  create/verify/confirm limiter (40/15 min); request validation on add-items.
* Checkout reuses its idempotency key on retries (no duplicate orders); paying a settled bill is refused.
* Limits are per instance (in memory). Recommended: Cloud Armor rate-based rules in front of Cloud
  Run, Firebase App Check and SMS region policy for OTP, API-key referrer restrictions.

## 4. Database isolation and integrity
* Tests run against an isolated database with verified per-run cleanup (previous task); tests can
  no longer obtain a Firestore client, and the harness refuses to start if one is reachable.
* Production: no seed overwrite, no silent write loss, invoice numbers continue from the highest
  issued, stock restoration fixed (Firestore read-before-write rule), booking time checks in hotel
  time zone (were UTC), database initialized once instead of twice concurrently.
* Legacy test data (245 Firestore docs, 236 local records) was removed earlier with backups in
  `data/backups/` (git-ignored).

## 5. Bugs fixed (non-security)
Staff dashboards bounced to login on reload; `GET /api/users/me` returned `{}`; 401 left the UI
"logged in"; invoice numbers repeated after restart; stock restore failed for multi-ingredient
orders; booking slots up to 5.5 h in the past accepted; production `vite build` produced a dev
bundle; stale lazy chunks after deploy (auto-reload once); test-only mock token parsing.

## 6. Unnecessary code removed
Unused dependencies `@google/genai`, `clsx`, `tailwind-merge`, `autoprefixer` (no imports
anywhere; Tailwind v4 has no PostCSS config). Default-password login fallback. Tracked database
backup (untracked; local copy kept).

## 7. Performance (measured)
| Bundle | Before | After |
| --- | --- | --- |
| Main JS (every visitor) | 1,799 kB / 392 kB gzip (dev build, as deployed) | 595 kB / 162 kB gzip |
| Admin dashboard | in main bundle | 405 kB lazy chunk (staff only) |
| Firebase sign-in | in main bundle | 125 kB lazy chunk (sign-in page only) |
Assets get `immutable` caching on Hosting; `index.html` is `no-cache`. Core Web Vitals were not
measured against production (not deployed).

## 8. Dependencies
Removed 4 unused packages; `tsx` moved to dependencies (needed by `npm start`); `npm audit fix`
(source-map-js, uuid); scoped override `@firebase/firestore → @grpc/grpc-js ^1.14.5` (the browser
never loads that module; avoids the suggested firebase 12→9 downgrade). `npm audit`: 7 (5 high,
2 moderate) → **0**. npm remains the package manager (single lockfile).

## 9. Tests, scans and builds (actual results)
| Check | Result |
| --- | --- |
| `tsc --noEmit` | pass |
| `npm run build` | pass (production bundle, no `jsxDEV`, no demo password) |
| `npm test` | 56/56 (was 48/56: payment tests reached the real gateway), cleanup verified |
| `npm run test:security` | 23/23 (10 legacy + 13 new regression checks), cleanup verified |
| New checks against pre-fix code | 10 of 12 failed as expected (backdoor, OTP escalation, crash, add-items ×3, anonymous payment status, status rules ×2, manager→admin reset, health exposure) |
| `npm run test:otp` | pass, cleanup verified |
| `npm run test:cleanup:verify` | 57/57 |
| `npm audit` | 0 vulnerabilities |
| Staff reload (browser, isolated server) | manager/kitchen/delivery stay on dashboard after reload |
| Responsive audit (browser, 5 widths × all roles) | 145 page-views: 0 overflow, 0 off-screen elements, 0 auth bounces; 84 footer links 20px tall at 1024px touch (unchanged from before, not yet fixed) |
| Secret scan (tracked files + full history) | no live secrets |
Not run: OWASP ZAP / Semgrep / Gitleaks / Trivy (not installed; no Docker), Lighthouse against
production, any test against the live backend (intentionally not attacked).

## 10. Files modified
48 files (+1,195 / −30,596, mostly the untracked backup). Server: `server.ts`, config, controllers
(auth, billing, booking, kitchen, manager, payment), database (`db.ts`, `firestoreSync.ts`),
middleware, repositories (invoice), routes (booking, index, inventory, payment), services (auth,
billing, booking, inventory, order, payment, razorpay), validators. Frontend: `App.tsx`,
`main.tsx`, `api/client.ts`, `AuthContext.tsx`, `CheckoutPage.tsx`, `StaffLoginPage.tsx`,
`AdminEmployeesView.tsx`, `AdminTablesView.tsx`. Config: `firebase.json`, `vite.config.ts`,
`package.json`, lockfile, `.gitignore`, `.dockerignore`, new `.gcloudignore`. Docs/tests/scripts:
`docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS.md`, `docs/TESTING.md`, `README.md`,
`tests/securityRegression.ts`, `scripts/reset-staff-password.ts`.

## 11. Remaining risks and external setup
1. Public repository data exposure (§2.0) — needs your approval to push/rewrite/make private.
2. Staff must know their real passwords before deploy (fallback removed) — break-glass script provided.
3. Per-instance state → run one instance until moved to Firestore.
4. JWTs last 7 days with no revocation on logout/password change (role/status changes do apply
   immediately). Recommend token versioning and shorter staff sessions.
5. Invoice totals use a 5 % service fee while orders/payments use a flat ₹40 — invoices can
   disagree with money collected. Business decision needed on the correct rule.
6. Orders are committed before the stock check (an "insufficient stock" error can leave a PLACED
   order); staff POS orders default to PAID; billing paths force status changes. Business review.
7. Many controllers return raw error messages on 5xx (internal details may reach clients).
8. CSP on Hosting is report-only until verified in a browser against production.
9. Rate limits are per instance and per IP; behind the Hosting `/api` rewrite the client IP
   handling must be re-verified before switching the SPA to relative `/api`.
10. Least-privilege service account, Razorpay secrets (if used), Firestore PITR/exports, App
    Check, API-key restrictions — documented, not applied (infrastructure changes).

## 12. Deployment
See `docs/DEPLOYMENT.md` (pre-deploy steps, `gcloud run deploy … --max-instances 1`,
`npm run build && firebase deploy --only hosting`, rules deploy, verification, rollback).

## 13. Release status
**READY WITH DOCUMENTED LIMITATIONS** (conditions above). Not deployed.
