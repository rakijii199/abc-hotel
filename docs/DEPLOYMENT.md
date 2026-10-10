# Production Deployment & Operations

Project `restaurant-com-2a275` · Firestore database `ai-studio-abchotelluxurydi-cfa9a1a9-b5f3-4a06-9e30-0167035de53d`
· Cloud Run service `abc-hotel-backend` (asia-south1) · Firebase Hosting site `restaurant-com-2a275.web.app`

## Architecture

```
Browser ──▶ Firebase Hosting (dist/, SPA, security headers)
   │                 └─ /api/** rewrite ─▶ Cloud Run (unused by the SPA today, see below)
   └── fetch https://abc-hotel-backend-…run.app/api ─▶ Cloud Run: Express (server.ts)
                                                        ├─ helmet / CORS / rate limits / auth (JWT)
                                                        ├─ in-memory engine (server/database/db.ts)
                                                        └─ Firestore (named DB, server SDK, ADC)
Browser ──▶ Firebase Auth (phone OTP, reCAPTCHA) ─ ID token ─▶ /api/auth/customer/* (verified with firebase-admin)
```

* The SPA calls the Cloud Run URL directly on `*.web.app` / `*.firebaseapp.com` (`src/api/client.ts`),
  so rate limits see the real client IP. Override with `VITE_API_URL` at build time if needed.
* Firestore is the source of truth in production. The server loads users, menu, tables, orders,
  payments, invoices and inventory items at startup and reads most entities through Firestore
  afterwards; several things stay **per instance** (see *Scaling*).
* Firestore client access is denied by `firestore.rules`; only the backend (IAM) touches data.

## Before the first deploy of this branch (one-time)

1. **Staff passwords.** The old login fallback that accepted `Password@123`, `Password123!` and
   `Admin@123` for every employee is gone. Every employee must sign in with their real password.
   If nobody with ADMIN/MANAGER rights can sign in, reset one account (break-glass):
   ```
   RESET_PASSWORD='<strong password>' npx tsx scripts/reset-staff-password.ts --username admin            # dry run
   RESET_PASSWORD='<strong password>' npx tsx scripts/reset-staff-password.ts --username admin --confirm
   ```
   Then have every employee whose password is still a published default changed from the
   Employees screen.
2. **Scaling.** Run a single instance until per-instance state is moved to Firestore:
   `--max-instances 1` (currently 12). See *Scaling*.
3. **Service account (least privilege).** The service currently runs as the default Compute
   Engine account. Create a dedicated one:
   ```
   gcloud iam service-accounts create abc-hotel-backend --project restaurant-com-2a275
   SA=abc-hotel-backend@restaurant-com-2a275.iam.gserviceaccount.com
   gcloud projects add-iam-policy-binding restaurant-com-2a275 --member serviceAccount:$SA --role roles/datastore.user
   gcloud projects add-iam-policy-binding restaurant-com-2a275 --member serviceAccount:$SA --role roles/firebaseauth.viewer
   gcloud secrets add-iam-policy-binding JWT_SECRET --member serviceAccount:$SA --role roles/secretmanager.secretAccessor --project restaurant-com-2a275
   ```
   (`firebaseauth.viewer` is enough for ID-token verification with revocation checks.)
4. **Payment gateway (optional).** Razorpay keys are not configured in production. Online
   gateway payments therefore cannot be verified (fail-closed); the hotel UPI QR flow with
   cashier verification keeps working. To enable Razorpay:
   ```
   printf '%s' '<key secret>'     | gcloud secrets create RAZORPAY_KEY_SECRET --data-file=- --project restaurant-com-2a275
   printf '%s' '<webhook secret>' | gcloud secrets create RAZORPAY_WEBHOOK_SECRET --data-file=- --project restaurant-com-2a275
   ```
   and add `--update-secrets RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest --update-env-vars RAZORPAY_KEY_ID=rzp_live_…`
   (grant the service account `secretAccessor` on both). Point the Razorpay webhook to
   `https://<cloud-run-url>/api/payments/webhook`.
5. **Firestore rules on the named database.** `firebase.json` now targets both `(default)` and the
   named database. Deploy and confirm in the console that the named database shows deny-all:
   `firebase deploy --only firestore:rules --project restaurant-com-2a275`
6. **Git history.** `data/hotel_database_backup.json` (customer names, phones, emails, password
   hashes) is no longer tracked, but it is still in history. If the repository is or will be
   shared, purge it (rewrites history; coordinate with everyone who has a clone):
   ```
   pip install git-filter-repo
   git filter-repo --invert-paths --path data/hotel_database_backup.json --path data/hotel_database.json
   git push --force --all   # only after agreement
   ```
   Treat the hashes as exposed: reset any account whose password was a default.
7. **Firebase web API key.** Restrict it to the Hosting domains (Google Cloud console → APIs &
   Services → Credentials → HTTP referrers) and consider enabling Firebase App Check and the
   SMS region policy for phone auth to limit OTP abuse.

## Deploy

Backend (Cloud Run, buildpacks — `.gcloudignore` controls what is uploaded):
```
gcloud run deploy abc-hotel-backend --source . --region asia-south1 --project restaurant-com-2a275 \
  --max-instances 1 --concurrency 80 --cpu 1 --memory 512Mi --timeout 300 \
  --update-secrets JWT_SECRET=JWT_SECRET:latest \
  --update-env-vars APP_URL=https://restaurant-com-2a275.web.app
  # add: --service-account abc-hotel-backend@restaurant-com-2a275.iam.gserviceaccount.com  (after step 3)
```
The two Hosting origins are built in. For a custom domain add it to `ALLOWED_ORIGINS`
(comma-separated, so use gcloud's alternate delimiter):
`--update-env-vars '^@^ALLOWED_ORIGINS=https://www.example-hotel.com,https://example-hotel.com'`.
The buildpack runs `npm run build` and starts with `npm start` (`NODE_ENV=production tsx server.ts`).
Startup fails closed if `JWT_SECRET` is missing/short, or if the Firestore `users` collection is
empty (wrong project/database). `ABC_ALLOW_FIRESTORE_BOOTSTRAP=true` is only for an intentional
first-time bootstrap from a local machine.

Frontend (Firebase Hosting):
```
npm ci
npm run build          # always a production bundle, even with NODE_ENV=development in .env
firebase deploy --only hosting --project restaurant-com-2a275
```

Verify after deploy:
```
curl -s https://abc-hotel-backend-471826710112.asia-south1.run.app/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://abc-hotel-backend-471826710112.asia-south1.run.app/api/health/ready
curl -sI https://restaurant-com-2a275.web.app/ | grep -iE 'content-security|x-content-type|x-frame'
```
Then sign in as staff and as a customer (phone OTP), place a UPI order, and open the browser
console on the OTP and checkout pages: `Content-Security-Policy-Report-Only` violations listed
there must be resolved before switching that header to an enforced `Content-Security-Policy`.

## Rollback

```
gcloud run revisions list --service abc-hotel-backend --region asia-south1
gcloud run services update-traffic abc-hotel-backend --region asia-south1 --to-revisions <PREVIOUS_REVISION>=100
firebase hosting:channel:list          # or Hosting console → Release history → Roll back
```

## Scaling (known limitation)

With more than one instance, these are per instance: notifications, audit log reads, payment
settings and billing settings changed at runtime, recipes and stock-movement history,
dashboard aggregates, booking overlap locks, in-memory rate-limit counters and invoice-number
continuation. Keep `--max-instances 1` until these are read/written through Firestore
(transactions for invoice counters and booking slots; `FieldValue.increment` for stock).

## Monitoring & alerting (Cloud Logging / Monitoring)

Create log-based metrics and alert policies on:

| Signal | Log filter (textPayload contains) | Suggested alert |
| --- | --- | --- |
| Security events | `[SECURITY EVENT]` | any occurrence |
| Crashes avoided | `[UNHANDLED REJECTION]` | > 5 / 10 min |
| Firestore outage / quota | `DATABASE_UNAVAILABLE` or `[FIRESTORE NOTICE]` | any occurrence |
| Rate limiting | HTTP 429 responses (request logs) | spike vs. baseline |
| Errors | HTTP 5xx ratio | > 2 % for 5 min |

Add an uptime check on `/api/health` and use `/api/health/ready` (503 while initializing or
throttled) for readiness. Logs never contain passwords, OTPs or tokens; keep it that way.

## Incident response

* **Leaked JWT secret:** create a new secret version, redeploy; all sessions are invalidated.
* **Compromised employee account:** set status INACTIVE (takes effect on the next request; the
  middleware re-reads the user), reset the password, review `auditLogs`.
* **Leaked Razorpay secret:** roll the key in the Razorpay dashboard, update the secret, redeploy.
* **Data recovery:** enable Firestore point-in-time recovery and scheduled exports:
  `gcloud firestore databases update --database=<db> --enable-pitr` and
  `gcloud firestore export gs://<bucket>/$(date +%F) --database=<db>`.
  Test a restore into a separate database before relying on it.
