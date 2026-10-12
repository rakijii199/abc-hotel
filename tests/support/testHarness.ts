/**
 * Automated test lifecycle with guaranteed cleanup.
 *
 *  1. Verify the environment is an isolated, marked test database (fail closed).
 *  2. Generate a unique run ID and take an exclusive lock.
 *  3. Recover leftovers from any earlier run that crashed before cleanup.
 *  4. Import the database engine (only now — it initialises on import).
 *  5. Journal the baseline, then run the suite (with timeout + signal handling).
 *  6. Teardown ALWAYS runs: wait for in-flight writes, freeze persistence so no
 *     background work can re-create records, clean the run's records, verify
 *     on disk, check for late writes, and write a cleanup report.
 */
import fs from 'fs';
import path from 'path';
import {
  TestEnvironment,
  UnsafeTestEnvironmentError,
  acquireLock,
  applyTestProcessEnv,
  assertSafeTestEnvironment,
  createRunId,
  prepareTestDatabaseDirectory,
  resolveTestEnvironment
} from './testEnvironment.ts';
import {
  CleanupReport,
  TestDataRegistry,
  cleanupRun,
  computeRegistry,
  formatReport,
  journalPaths,
  readDb,
  registryIsEmpty,
  stableStringify
} from './testDataRegistry.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface HarnessOptions {
  /** Abort the suite (and still clean up) after this long. */
  timeoutMs?: number;
  /** File must be unchanged for this long before teardown reads it. */
  quietMs?: number;
  /** After cleanup, wait this long and confirm nothing re-created records. */
  lateWriteCheckMs?: number;
  /** Test hook forwarded to the cleanup engine. */
  faultInjector?: (collection: string, key: string) => void;
  /** Keep journals even when cleanup verifies (debugging). */
  keepJournals?: boolean;
  log?: (msg: string) => void;
}

export interface HarnessContext {
  runId: string;
  env: TestEnvironment;
  db: any;
}

export interface RecoveryReport {
  recoveredRuns: string[];
  report?: CleanupReport;
}

export interface HarnessResult<T> {
  runId: string;
  result?: T;
  error?: unknown;
  timedOut: boolean;
  interrupted: boolean;
  recovery: RecoveryReport;
  cleanup: CleanupReport;
  lateWritesDetected: boolean;
  firestore: { attempted: boolean; deleted: number; failures: string[] };
}

function fileFingerprint(file: string): string {
  try {
    const st = fs.statSync(file);
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return 'missing';
  }
}

/** Wait until the database file stops changing (pending 50ms debounced persists have flushed). */
export async function waitForQuiescence(file: string, quietMs = 750, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  let last = fileFingerprint(file);
  let stableSince = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await sleep(100);
    const fp = fileFingerprint(file);
    if (fp !== last) {
      last = fp;
      stableSince = Date.now();
    } else if (fp !== 'missing' && Date.now() - stableSince >= quietMs) {
      return true;
    }
  }
  return false;
}

/**
 * Stop the engine from writing anything further (file or Firestore). Test-only:
 * this runs in the test process after the suite has finished, so in-flight
 * promises, timers or retries cannot re-create records after cleanup.
 */
export function freezePersistence(db: any): void {
  if (db.saveTimeout) clearTimeout(db.saveTimeout);
  db.persist = () => {};
  db.queueSync = async () => {};
  db.deleteDocument = async () => {};
  db.dirtySyncQueue?.clear?.();
}

/** Restore the database to the oldest unfinished run's baseline (crash recovery). */
export async function recoverPendingRuns(env: TestEnvironment, log: (m: string) => void): Promise<RecoveryReport> {
  if (!fs.existsSync(env.journalDir) || !fs.existsSync(env.dbFile)) return { recoveredRuns: [] };
  const pending = fs
    .readdirSync(env.journalDir)
    .filter((f) => f.endsWith('.baseline.json'))
    .map((f) => ({ runId: f.replace('.baseline.json', ''), file: path.join(env.journalDir, f) }))
    .filter((p) => !fs.existsSync(journalPaths(env.journalDir, p.runId).report) || !isVerifiedReport(journalPaths(env.journalDir, p.runId).report))
    .sort((a, b) => fs.statSync(a.file).mtimeMs - fs.statSync(b.file).mtimeMs);

  if (pending.length === 0) return { recoveredRuns: [] };

  // Restoring to the OLDEST pending baseline also reverts every later unfinished run.
  const oldest = pending[0];
  log(`[TEST CLEANUP] Recovering ${pending.length} unfinished run(s); restoring baseline of ${oldest.runId}`);
  const paths = journalPaths(env.journalDir, oldest.runId);
  const priorRegistry: TestDataRegistry | undefined = fs.existsSync(paths.registry)
    ? JSON.parse(fs.readFileSync(paths.registry, 'utf-8'))
    : undefined;
  const report = await cleanupRun({
    runId: `${oldest.runId}:recovery`,
    dbFile: env.dbFile,
    baselineFile: oldest.file,
    registryFile: paths.registry,
    priorRegistry
  });
  log(formatReport(report));
  if (report.verified) {
    for (const p of pending) {
      const jp = journalPaths(env.journalDir, p.runId);
      fs.writeFileSync(jp.report, JSON.stringify({ ...report, recoveredBy: 'next-run' }, null, 2), 'utf-8');
      for (const f of [jp.baseline]) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  }
  return { recoveredRuns: pending.map((p) => p.runId), report };
}

function isVerifiedReport(file: string): boolean {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')).verified === true;
  } catch {
    return false;
  }
}

/**
 * Optional: when the suite runs against the Firestore EMULATOR, delete the
 * run's created documents there as well. Never runs against a live project
 * (assertSafeTestEnvironment rejects real Firestore without the emulator).
 */
async function cleanupFirestoreEmulator(created: Record<string, string[]>, log: (m: string) => void) {
  const result = { attempted: false, deleted: 0, failures: [] as string[] };
  if (process.env.USE_REAL_FIRESTORE !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) return result;
  result.attempted = true;
  const { getFirestoreDb } = await import('../../server/database/firestoreSync.ts');
  const fsDb = getFirestoreDb();
  if (!fsDb) {
    result.failures.push('Firestore emulator client unavailable');
    return result;
  }
  for (const [collection, ids] of Object.entries(created)) {
    for (const id of ids) {
      if (id.includes(':')) continue; // synthetic keys are not document IDs
      try {
        await fsDb.collection(collection).doc(id).delete();
        const snap = await fsDb.collection(collection).doc(id).get();
        if (snap.exists) result.failures.push(`${collection}/${id} still exists`);
        else result.deleted++;
      } catch (err: any) {
        result.failures.push(`${collection}/${id}: ${err?.message || err}`);
      }
    }
  }
  log(`[TEST CLEANUP] Firestore emulator: deleted=${result.deleted} failures=${result.failures.length}`);
  return result;
}

export async function runWithIsolatedDatabase<T>(
  suite: (ctx: HarnessContext) => Promise<T>,
  options: HarnessOptions = {}
): Promise<HarnessResult<T>> {
  const log = options.log || ((m: string) => console.error(m));
  const env = resolveTestEnvironment();

  // 1. Safety first — nothing below runs unless this passes.
  applyTestProcessEnv(env);
  assertSafeTestEnvironment(env, { requireMarker: false });
  prepareTestDatabaseDirectory(env);
  assertSafeTestEnvironment(env);

  // 2. Run identity + lock.
  const runId = createRunId();
  const releaseLock = acquireLock(env, runId);
  const paths = journalPaths(env.journalDir, runId);
  log(`[TEST CLEANUP] run=${runId} database=${env.dbFile}`);

  let db: any;
  let teardownDone: Promise<HarnessResult<T>> | null = null;
  const outcome: HarnessResult<T> = {
    runId,
    timedOut: false,
    interrupted: false,
    recovery: { recoveredRuns: [] },
    cleanup: undefined as unknown as CleanupReport,
    lateWritesDetected: false,
    firestore: { attempted: false, deleted: 0, failures: [] }
  };

  const teardown = async (): Promise<HarnessResult<T>> => {
    if (teardownDone) return teardownDone;
    teardownDone = (async () => {
      try {
        if (db) {
          await waitForQuiescence(env.dbFile, options.quietMs ?? 750);
          freezePersistence(db);
        }
        const baselineSnapshot = fs.existsSync(paths.baseline) ? readDb(paths.baseline) : null;
        const preCleanup = baselineSnapshot && fs.existsSync(env.dbFile)
          ? computeRegistry(baselineSnapshot, readDb(env.dbFile), runId)
          : null;

        outcome.cleanup = await cleanupRun({
          runId,
          dbFile: env.dbFile,
          baselineFile: paths.baseline,
          registryFile: paths.registry,
          faultInjector: options.faultInjector
        });

        // Late-write check: nothing may re-create records after cleanup.
        if (outcome.cleanup.verified) {
          await sleep(options.lateWriteCheckMs ?? 500);
          const after = computeRegistry(readDb(paths.baseline), readDb(env.dbFile), runId);
          outcome.lateWritesDetected = !registryIsEmpty(after);
          if (outcome.lateWritesDetected) {
            outcome.cleanup.verified = false;
            outcome.cleanup.status = 'PARTIAL';
            outcome.cleanup.notes.push('Records re-appeared after cleanup (late background write).');
          }
        }

        if (preCleanup) {
          const created: Record<string, string[]> = {};
          for (const [c, e] of Object.entries(preCleanup.collections)) if (e.created.length) created[c] = e.created;
          outcome.firestore = await cleanupFirestoreEmulator(created, log);
        }

        fs.writeFileSync(paths.report, JSON.stringify(outcome.cleanup, null, 2), 'utf-8');
        if (outcome.cleanup.verified && !options.keepJournals) {
          try { fs.unlinkSync(paths.baseline); } catch {}
        }
        log(formatReport(outcome.cleanup));
        if (!outcome.cleanup.verified) {
          log(`[TEST CLEANUP] Journal kept at ${paths.baseline}; run "npm run test:cleanup" to retry.`);
        }
      } catch (err: any) {
        outcome.cleanup = outcome.cleanup || ({
          runId, status: 'FAILED', verified: false, removed: {}, restored: {}, reinserted: {}, alreadyAbsent: {},
          scalarsRestored: [], failures: [], transientFailures: [], residual: {},
          totals: { removed: 0, restored: 0, reinserted: 0, alreadyAbsent: 0, failures: 0 },
          attempts: 0, durationMs: 0, notes: []
        } as CleanupReport);
        outcome.cleanup.notes.push(`Teardown error: ${err?.message || err}`);
        log(`[TEST CLEANUP] Teardown error: ${err?.stack || err}`);
      } finally {
        releaseLock();
      }
      return outcome;
    })();
    return teardownDone;
  };

  // Interruption (Ctrl+C, CI cancellation): clean up, then exit.
  const onSignal = (signal: NodeJS.Signals) => {
    outcome.interrupted = true;
    log(`[TEST CLEANUP] Received ${signal}; cleaning up before exit...`);
    teardown().finally(() => process.exit(130));
  };
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGBREAK' as NodeJS.Signals];
  for (const s of signals) process.once(s, onSignal);

  try {
    // 3. Crash recovery before the baseline is taken.
    outcome.recovery = await recoverPendingRuns(env, log);
    if (outcome.recovery.report && !outcome.recovery.report.verified) {
      throw new Error('Could not recover leftovers from an earlier unfinished run; refusing to start a new run.');
    }

    // 4. No live Firestore client may be reachable (services such as order
    //    creation use the client directly, bypassing the sync guards).
    const { getFirestoreDb } = await import('../../server/database/firestoreSync.ts');
    if (getFirestoreDb() && !process.env.FIRESTORE_EMULATOR_HOST) {
      throw new UnsafeTestEnvironmentError('A live Firestore client is available inside the test run; refusing to run tests.');
    }

    // Import the engine only now (it initialises from ABC_DB_FILE on import).
    ({ db } = await import('../../server/database/db.ts'));
    const t0 = Date.now();
    while (!db.isInitialized && Date.now() - t0 < 60000) await sleep(50);
    if (!db.isInitialized) throw new Error('Database engine did not initialise within 60s.');
    db.persist(); // make sure a freshly seeded test DB is on disk
    await waitForQuiescence(env.dbFile, 400);

    // 5. Baseline journal.
    fs.copyFileSync(env.dbFile, paths.baseline);

    const run = suite({ runId, env, db });
    const timeoutMs = options.timeoutMs ?? Number(process.env.TEST_RUN_TIMEOUT_MS || 15 * 60 * 1000);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        outcome.timedOut = true;
        reject(new Error(`Test suite timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    try {
      outcome.result = await Promise.race([run, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    outcome.error = err;
  } finally {
    // 6. Guaranteed teardown, whether the suite passed, failed or timed out.
    await teardown();
    for (const s of signals) process.removeListener(s, onSignal);
  }
  return outcome;
}

/** Cleanup-only entry: recover any unfinished runs without running tests. */
export async function cleanupPendingRuns(log: (m: string) => void = (m) => console.error(m)): Promise<RecoveryReport> {
  const env = resolveTestEnvironment();
  applyTestProcessEnv(env);
  assertSafeTestEnvironment(env, { requireMarker: false });
  if (!fs.existsSync(env.markerFile)) {
    log('[TEST CLEANUP] No test database found; nothing to clean.');
    return { recoveredRuns: [] };
  }
  assertSafeTestEnvironment(env);
  const release = acquireLock(env, createRunId());
  try {
    const rec = await recoverPendingRuns(env, log);
    if (rec.recoveredRuns.length === 0) log('[TEST CLEANUP] No unfinished runs; test database is clean.');
    return rec;
  } finally {
    release();
  }
}

export { stableStringify };
