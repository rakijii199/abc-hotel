/**
 * Self-tests for the automated test-data cleanup mechanism.
 *
 *   npm run test:cleanup:verify
 *
 * Each scenario runs in its own process (like a real `npm test` run) against a
 * throwaway test database in the OS temp directory, so neither the dev
 * database nor data/test-db is touched. Every assertion is checked against
 * what is actually on disk or returned by the UI-facing services.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeRegistry, readDb, stableStringify } from './support/testDataRegistry.ts';
import { DEV_DB_FILE, resolveTestEnvironment } from './support/testEnvironment.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const TSX_CLI = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abc-cleanup-selftest-'));

interface Check { scenario: string; name: string; passed: boolean; detail?: string }
const checks: Check[] = [];
const check = (scenario: string, name: string, passed: boolean, detail?: unknown) =>
  checks.push({ scenario, name, passed, detail: detail === undefined ? undefined : typeof detail === 'string' ? detail : JSON.stringify(detail) });

function runScenario(name: string, arg?: string, extraEnv: Record<string, string> = {}) {
  const env = { ...process.env, TEST_DB_DIR: testDbDir, ...extraEnv };
  delete (env as any).ABC_DB_FILE;
  delete (env as any).IS_TEST_RUN;
  const res = spawnSync(process.execPath, [TSX_CLI, path.join(__dirname, 'cleanup', 'scenario.ts'), name, ...(arg ? [arg] : [])], {
    cwd: REPO, env, encoding: 'utf-8', timeout: 180000, maxBuffer: 20 * 1024 * 1024
  });
  const line = (res.stdout || '').split('\n').find((l) => l.startsWith('SCENARIO_RESULT '));
  if (!line) {
    return { crashed: `exit=${res.status} stderr=${(res.stderr || '').slice(-1500)} stdout=${(res.stdout || '').slice(-500)}` } as any;
  }
  return JSON.parse(line.slice('SCENARIO_RESULT '.length));
}

function runCleanupOnly() {
  const env = { ...process.env, TEST_DB_DIR: testDbDir };
  delete (env as any).ABC_DB_FILE;
  const res = spawnSync(process.execPath, [TSX_CLI, path.join(__dirname, 'run.ts'), '--cleanup-only'], {
    cwd: REPO, env, encoding: 'utf-8', timeout: 120000
  });
  return { status: res.status, output: `${res.stdout}\n${res.stderr}` };
}

const hashFile = (f: string) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : 'missing');

/**
 * Fields the database engine itself rewrites on EVERY startup, independent of
 * tests (seedInitialInventory() re-stamps recipe updatedAt with "now"). Only
 * these fields are ignored when comparing genuine records across processes.
 */
const ENGINE_LOAD_DRIFT: Record<string, string[]> = { menuItemRecipes: ['updatedAt'] };

function withoutEngineDrift(snapshot: Record<string, any>): Record<string, any> {
  const copy: Record<string, any> = { ...snapshot };
  for (const [collection, fields] of Object.entries(ENGINE_LOAD_DRIFT)) {
    if (Array.isArray(copy[collection])) {
      copy[collection] = copy[collection].map((r: any) => {
        const c = { ...r };
        for (const f of fields) delete c[f];
        return c;
      });
    }
  }
  return copy;
}

/** Genuine records = everything in the settled test DB before any data-creating scenario ran. */
let genuine: Record<string, any> = {};
function assertGenuineUnchanged(scenario: string) {
  const env = resolveTestEnvironment(testDbDir);
  const reg = computeRegistry(withoutEngineDrift(genuine), withoutEngineDrift(readDb(env.dbFile)), 'genuine-check');
  const changedGenuine: string[] = [];
  for (const [c, e] of Object.entries(reg.collections)) {
    for (const k of [...e.modified, ...e.deleted]) changedGenuine.push(`${c}/${k}`);
  }
  check(scenario, 'genuine pre-existing records unchanged', changedGenuine.length === 0 && reg.scalarsChanged.length === 0,
    changedGenuine.length || reg.scalarsChanged.length ? { changedGenuine: changedGenuine.slice(0, 10), scalars: reg.scalarsChanged } : undefined);
  const leftovers = Object.entries(reg.collections).flatMap(([c, e]) => e.created.map((k) => `${c}/${k}`));
  return leftovers;
}

function cleanupOk(scenario: string, cleanup: any, expectRemoved = true) {
  check(scenario, 'cleanup verified on disk', cleanup?.verified === true, cleanup?.status);
  if (expectRemoved) check(scenario, 'records removed > 0', (cleanup?.totals?.removed || 0) > 0, cleanup?.removed);
}

async function main() {
  const devHashBefore = hashFile(DEV_DB_FILE);
  console.error(`[SELFTEST] isolated test DB dir: ${testDbDir}`);

  // 0. Safety refusals (no data touched).
  const unsafe = runScenario('unsafe');
  if (unsafe.crashed) check('unsafe', 'scenario ran', false, unsafe.crashed);
  for (const [name, ok] of Object.entries(unsafe.checks || {})) check('unsafe', `refuses: ${name}`, ok === true);

  // Seed the temp test DB and let the engine's one-time load normalisation settle.
  for (let i = 0; i < 2; i++) {
    const noop = runScenario('noop');
    check('setup', `empty run ${i + 1} cleans to a verified state`, noop.cleanup?.verified === true, noop.crashed || noop.cleanup?.status);
  }
  genuine = readDb(resolveTestEnvironment(testDbDir).dbFile);

  // 1. Order created → removed.
  const order = runScenario('order');
  if (order.crashed) check('order', 'scenario ran', false, order.crashed);
  cleanupOk('order', order.cleanup);
  check('order', 'order and its items were registered and removed', (order.cleanup?.removed?.orders || 0) >= 1, order.cleanup?.removed);
  const orderDisk = readDb(resolveTestEnvironment(testDbDir).dbFile).orders?.some((o: any) => o.id === order.result?.orderId);
  check('order', 'order absent from database file', orderDisk === false);
  check('order', 'no leftovers', assertGenuineUnchanged('order').length === 0);
  check('order', 'related records (notifications/audit/stock) removed too',
    Object.keys(order.cleanup?.removed || {}).length >= 1, order.cleanup?.removed);

  // 2. Booking created → removed.
  const booking = runScenario('booking');
  if (booking.crashed || booking.error) check('booking', 'scenario ran', false, booking.crashed || booking.error);
  cleanupOk('booking', booking.cleanup);
  check('booking', 'booking registered and removed', (booking.cleanup?.removed?.bookings || 0) >= 1, booking.cleanup?.removed);
  check('booking', 'no leftovers', assertGenuineUnchanged('booking').length === 0);

  // 3. Failing suite still cleans up.
  const failing = runScenario('failing');
  check('failing', 'suite error propagated', /Intentional test failure/.test(failing.error || ''), failing.error);
  cleanupOk('failing', failing.cleanup);
  check('failing', 'no leftovers', assertGenuineUnchanged('failing').length === 0);

  // 4. Repeated cleanup is idempotent and harmless.
  const idem = runScenario('idempotent');
  if (idem.crashed) check('idempotent', 'scenario ran', false, idem.crashed);
  cleanupOk('idempotent', idem.first);
  check('idempotent', 'second cleanup removes nothing', idem.second?.totals?.removed === 0 && idem.second?.verified === true, idem.second?.totals);
  check('idempotent', 'second cleanup reports records already absent', (idem.second?.totals?.alreadyAbsent || 0) >= 1, idem.second?.alreadyAbsent);
  check('idempotent', 'third cleanup also a no-op', idem.third?.totals?.removed === 0 && idem.third?.status === 'NOTHING_TO_CLEAN', idem.third?.status);
  check('idempotent', 'repeats did not modify the database', idem.fileUnchangedByRepeats === true);
  check('idempotent', 'no leftovers', assertGenuineUnchanged('idempotent').length === 0);

  // 5. Partial failure is reported (never as success), then recovered by test:cleanup.
  const partial = runScenario('partial');
  check('partial', 'status reported as PARTIAL, not verified', partial.cleanup?.status === 'PARTIAL' && partial.cleanup?.verified === false, partial.cleanup?.status);
  check('partial', 'failing record listed in report',
    (partial.cleanup?.failures || []).some((f: any) => f.key === partial.result?.orderId), partial.cleanup?.failures);
  check('partial', 'other records of the run still removed', (partial.cleanup?.totals?.removed || 0) >= 1, partial.cleanup?.removed);
  const leftoverAfterPartial = assertGenuineUnchanged('partial');
  check('partial', 'unremovable record left in place (not silently dropped)', leftoverAfterPartial.includes(`orders/${partial.result?.orderId}`), leftoverAfterPartial);
  const recovery = runCleanupOnly();
  check('partial', 'npm run test:cleanup recovers the leftover', recovery.status === 0 && /status=CLEAN verified=true/.test(recovery.output), recovery.output.slice(-600));
  check('partial', 'no leftovers after recovery', assertGenuineUnchanged('partial-recovery').length === 0);

  // 6. Background work cannot re-create records after cleanup.
  const late = runScenario('late');
  if (late.crashed) check('late', 'scenario ran', false, late.crashed);
  cleanupOk('late', late.cleanup);
  check('late', 'late background write actually fired', late.lateFired === true && late.lateInMemory === true);
  check('late', 'late write never reached the database file', late.lateOnDisk === false);
  check('late', 'order from the run absent', late.orderOnDisk === false);
  check('late', 'no leftovers', assertGenuineUnchanged('late').length === 0);

  // 7. Removed records do not appear in UI-facing queries (fresh process, like the server).
  const inspect = runScenario('inspect', JSON.stringify({
    orderIds: [order.result?.orderId, failing.result?.orderId, idem.result?.orderId, partial.result?.orderId, late.result?.orderId].filter(Boolean),
    bookingIds: [booking.result?.bookingId].filter(Boolean)
  }));
  if (inspect.crashed) check('inspect', 'scenario ran', false, inspect.crashed);
  check('inspect', 'orders absent from staff order list', inspect.ordersInAdminList?.length === 0, inspect.ordersInAdminList);
  check('inspect', 'orders absent from customer order history', inspect.ordersInCustomerHistory?.length === 0, inspect.ordersInCustomerHistory);
  check('inspect', 'booking absent from staff reservations', inspect.bookingsInAdminList?.length === 0, inspect.bookingsInAdminList);
  check('inspect', 'booking absent from customer bookings', inspect.bookingsInCustomerList?.length === 0, inspect.bookingsInCustomerList);
  check('inspect', 'no test IDs in dashboard stats', inspect.idsInDashboardStats?.length === 0, inspect.idsInDashboardStats);
  check('inspect', 'no self-test customers in order list', inspect.selfTestNamesInAdminList === 0, inspect.selfTestNamesInAdminList);
  assertGenuineUnchanged('inspect');

  // Global: the development database was never touched.
  check('global', 'development database file unchanged', hashFile(DEV_DB_FILE) === devHashBefore);

  const failed = checks.filter((c) => !c.passed);
  for (const c of checks) console.log(`${c.passed ? 'PASS' : 'FAIL'}  [${c.scenario}] ${c.name}${!c.passed && c.detail ? `  → ${c.detail}` : ''}`);
  console.log(`\n${checks.length - failed.length}/${checks.length} cleanup checks passed`);

  if (failed.length === 0) fs.rmSync(testDbDir, { recursive: true, force: true });
  else console.log(`Temp test DB kept for inspection: ${testDbDir}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { stableStringify };
