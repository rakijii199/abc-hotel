/**
 * Test environment isolation & production-safety guards.
 *
 * Every automated test run must use an isolated, explicitly marked test
 * database. Nothing in this module talks to Firestore or the dev database;
 * it only decides whether it is safe to proceed and fails closed otherwise.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const DEV_DB_FILE = path.join(REPO_ROOT, 'data', 'hotel_database.json');
export const DEV_DB_BACKUP_FILE = path.join(REPO_ROOT, 'data', 'hotel_database_backup.json');

/** Default isolated test database location (gitignored). */
export const DEFAULT_TEST_DB_DIR = path.join(REPO_ROOT, 'data', 'test-db');
export const TEST_DB_FILENAME = 'hotel_database.test.json';
export const MARKER_FILENAME = '.abc-test-database';
export const LOCK_FILENAME = '.lock';
export const JOURNAL_DIRNAME = 'runs';

const MARKER_PURPOSE = 'abc-hotel-automated-tests';

export class UnsafeTestEnvironmentError extends Error {
  constructor(message: string) {
    super(`[TEST SAFETY] ${message}`);
    this.name = 'UnsafeTestEnvironmentError';
  }
}

export interface TestEnvironment {
  dbDir: string;
  dbFile: string;
  journalDir: string;
  markerFile: string;
  lockFile: string;
}

/** Resolve the isolated test database paths (TEST_DB_DIR overrides the default directory). */
export function resolveTestEnvironment(dbDir = process.env.TEST_DB_DIR || DEFAULT_TEST_DB_DIR): TestEnvironment {
  const dir = path.resolve(dbDir);
  return {
    dbDir: dir,
    dbFile: path.join(dir, TEST_DB_FILENAME),
    journalDir: path.join(dir, JOURNAL_DIRNAME),
    markerFile: path.join(dir, MARKER_FILENAME),
    lockFile: path.join(dir, LOCK_FILENAME)
  };
}

/**
 * Create the test database directory and its marker file. The marker is what
 * later authorises destructive cleanup, so it is only ever written into a
 * directory that is not the dev data directory itself.
 */
export function prepareTestDatabaseDirectory(env: TestEnvironment): void {
  assertPathIsIsolated(env);
  fs.mkdirSync(env.journalDir, { recursive: true });
  if (!fs.existsSync(env.markerFile)) {
    fs.writeFileSync(
      env.markerFile,
      JSON.stringify({ purpose: MARKER_PURPOSE, createdAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  }
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => path.resolve(p).toLowerCase();
  return norm(a) === norm(b);
}

function assertPathIsIsolated(env: TestEnvironment): void {
  if (samePath(env.dbFile, DEV_DB_FILE) || samePath(env.dbFile, DEV_DB_BACKUP_FILE)) {
    throw new UnsafeTestEnvironmentError(`Refusing to use the development database (${env.dbFile}) for tests.`);
  }
  if (samePath(env.dbDir, path.dirname(DEV_DB_FILE))) {
    throw new UnsafeTestEnvironmentError('The test database must live in its own directory, not data/ itself.');
  }
}

/**
 * Verify the environment before any test touches data. Throws (fail closed)
 * whenever the target cannot be positively identified as an isolated test DB.
 */
export function assertSafeTestEnvironment(env: TestEnvironment, opts: { requireMarker?: boolean } = {}): void {
  if (process.env.NODE_ENV === 'production') {
    throw new UnsafeTestEnvironmentError('NODE_ENV=production. Automated tests and cleanup never run in production.');
  }

  // Real Firestore is only acceptable when it is the local emulator.
  if (process.env.USE_REAL_FIRESTORE === 'true' && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new UnsafeTestEnvironmentError(
      'USE_REAL_FIRESTORE=true without FIRESTORE_EMULATOR_HOST. Tests may only use the Firestore emulator, never a live project.'
    );
  }

  assertPathIsIsolated(env);

  if (process.env.ABC_DB_FILE && !samePath(process.env.ABC_DB_FILE, env.dbFile)) {
    throw new UnsafeTestEnvironmentError(
      `ABC_DB_FILE (${process.env.ABC_DB_FILE}) does not match the verified test database (${env.dbFile}).`
    );
  }

  if (opts.requireMarker !== false) {
    if (!fs.existsSync(env.markerFile)) {
      throw new UnsafeTestEnvironmentError(`Test database marker missing at ${env.markerFile}; cannot verify this is a test database.`);
    }
    let marker: any;
    try {
      marker = JSON.parse(fs.readFileSync(env.markerFile, 'utf-8'));
    } catch {
      throw new UnsafeTestEnvironmentError(`Test database marker at ${env.markerFile} is unreadable.`);
    }
    if (marker?.purpose !== MARKER_PURPOSE) {
      throw new UnsafeTestEnvironmentError(`Test database marker at ${env.markerFile} has an unexpected purpose.`);
    }
  }
}

/**
 * Point the database engine and Firestore guards at the isolated test DB.
 * MUST run before server/database/db.ts is imported (it initialises on import).
 */
export function applyTestProcessEnv(env: TestEnvironment): void {
  process.env.IS_TEST_RUN = 'true';
  process.env.ABC_DB_FILE = env.dbFile;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === 'EPERM';
  }
}

/** Exclusive lock so two runs never clean the same test database concurrently. */
export function acquireLock(env: TestEnvironment, runId: string): () => void {
  if (fs.existsSync(env.lockFile)) {
    try {
      const held = JSON.parse(fs.readFileSync(env.lockFile, 'utf-8'));
      if (held?.pid && held.pid !== process.pid && isProcessAlive(held.pid)) {
        throw new UnsafeTestEnvironmentError(
          `Test database is locked by run ${held.runId} (pid ${held.pid}). Wait for it to finish.`
        );
      }
    } catch (err) {
      if (err instanceof UnsafeTestEnvironmentError) throw err;
      // Corrupt lock file: treat as stale.
    }
  }
  fs.writeFileSync(env.lockFile, JSON.stringify({ runId, pid: process.pid, at: new Date().toISOString() }), 'utf-8');
  return () => {
    try {
      const held = JSON.parse(fs.readFileSync(env.lockFile, 'utf-8'));
      if (held?.runId === runId) fs.unlinkSync(env.lockFile);
    } catch {
      /* already released */
    }
  };
}

export function createRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `run-${stamp}-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
}
