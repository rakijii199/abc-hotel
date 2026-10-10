# Automated Tests & Test-Data Cleanup

Automated tests never touch the development database (`data/hotel_database.json`)
or any live Firestore project. Every run uses an **isolated test database** and
removes the data it created when it finishes — after success, failure, timeout
or interruption.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Full suite (`tests/testRunner.ts`) against the isolated test DB, then cleanup + verification. Exit code is non-zero if a test fails **or** cleanup cannot be verified. |
| `npm run test:otp` | Phone-OTP / staff login verification, isolated and cleaned. |
| `npm run test:security` | HTTP security audit. Boots the API server **inside the harness** on port `8091` (`TEST_SERVER_PORT`) backed by the test DB, so audit users are cleaned too. |
| `npm run test:cleanup` | Recover leftovers from a run that was hard-killed before it could clean up. Safe to run any time. |
| `npm run test:cleanup:verify` | Self-tests for the cleanup mechanism (uses its own throwaway DB in the OS temp dir). |

`tests/securityAuditVerification.ts` and `tests/verifyPhoneOtpAuth.ts` refuse to
run outside the harness. `tests/testNewOrderFirestore.ts` refuses to run unless
`FIRESTORE_EMULATOR_HOST` is set.

## Where test data lives

* Test database: `data/test-db/hotel_database.test.json` (gitignored; override the
  directory with `TEST_DB_DIR`). It is seeded automatically on first use.
* Marker: `data/test-db/.abc-test-database` — destructive cleanup only runs where this exists.
* Journals and reports: `data/test-db/runs/<runId>.{baseline,registry,report}.json`.
* Lock: `data/test-db/.lock` (one run at a time; stale locks from dead processes are taken over).

The dev server keeps using `data/hotel_database.json`, so test records never appear in
the website or staff dashboards.

## How cleanup works

1. **Safety checks (fail closed):** refuses when `NODE_ENV=production`, when
   `USE_REAL_FIRESTORE=true` without `FIRESTORE_EMULATOR_HOST`, when the target is the
   dev or backup database or `data/` itself, when `ABC_DB_FILE` points elsewhere, or
   when the test-database marker is missing.
2. **Isolation before import:** `IS_TEST_RUN=true` and `ABC_DB_FILE` are set *before*
   `server/database/db.ts` is imported (it initialises on import). With `IS_TEST_RUN`
   set, every Firestore read/write is skipped.
3. **Run ID + lock**, then **crash recovery** of any unfinished earlier run.
4. **Baseline journal:** the test DB file is copied to `runs/<runId>.baseline.json`.
5. **Suite runs** (timeout `TEST_RUN_TIMEOUT_MS`, default 15 min; SIGINT/SIGTERM handled).
6. **Guaranteed teardown:**
   * waits until in-flight writes have flushed (file unchanged for 750 ms);
   * **freezes persistence** in the test process so timers, retries or late promises
     can never write records back after cleanup;
   * builds the **registry** of this run's records by diffing every persisted
     collection against the baseline — this captures records created indirectly
     (payments, invoices, notifications, audit logs, stock movements, summaries…);
   * removes only registry `created` keys and restores fixtures the run `modified` or
     `deleted` (e.g. inventory stock levels). Nothing outside the registry is touched;
     collections are never wiped;
   * writes atomically with retries, **re-reads the file to verify**, then re-checks
     after a delay for late writes;
   * writes `runs/<runId>.report.json` and prints a summary:

```
[TEST CLEANUP] run=run-… status=CLEAN verified=true attempts=1
[TEST CLEANUP] removed=203 restored=16 reinserted=0 alreadyAbsent=0 failures=0
[TEST CLEANUP] removed by collection → users:2, bookings:6, orders:19, payments:20, …
```

Statuses: `CLEAN` (records removed, verified), `NOTHING_TO_CLEAN`, `PARTIAL`
(some records could not be removed — listed in `failures`, journal kept),
`FAILED`. A run is never reported clean unless verification on disk passed.
If cleanup is not verified, the baseline journal is kept and `npm run test:cleanup`
(or the next `npm test`) finishes the job.

### Firestore emulator (optional)

To exercise real Firestore code paths, run against the emulator only:

```
FIRESTORE_EMULATOR_HOST=localhost:8080 USE_REAL_FIRESTORE=true npm test
```

Teardown then also deletes the run's created document IDs from the emulator and
verifies they are gone. A live project is always refused.

## CI/CD

```
npm ci
npm run lint
npm test                      # fails the job on test failures or unverified cleanup
npm run test:cleanup:verify   # proves the cleanup mechanism itself
npm run build
```

Do not set `NODE_ENV=production`, `USE_REAL_FIRESTORE`, or real Firebase credentials in
the test job. Archive `data/test-db/runs/*.report.json` as a build artifact if you want
cleanup reports. Use `TEST_DB_DIR` to place the test DB on the runner's temp disk.

## Notes

* The database engine rewrites `menuItemRecipes[].updatedAt` on every startup
  (`seedInitialInventory()`); this is engine behaviour, not test data.
* The 8 Razorpay tests (`TC_PAY_*`) need gateway credentials/network and fail without them.
