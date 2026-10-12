/**
 * One cleanup self-test scenario per process (mirrors a real `npm test` run).
 * Invoked by tests/cleanupSelfTest.ts; prints a single SCENARIO_RESULT line.
 *
 *   tsx tests/cleanup/scenario.ts <noop|order|booking|failing|partial|idempotent|late|inspect|unsafe> [args]
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runWithIsolatedDatabase } from '../support/testHarness.ts';
import { cleanupRun, journalPaths, readDb, TestDataRegistry } from '../support/testDataRegistry.ts';
import {
  DEV_DB_FILE,
  UnsafeTestEnvironmentError,
  assertSafeTestEnvironment,
  resolveTestEnvironment
} from '../support/testEnvironment.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const emit = (data: unknown) => console.log(`SCENARIO_RESULT ${JSON.stringify(data)}`);

function bookingDate(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().split('T')[0];
}

async function createOrder(customerName: string) {
  const { OrderService } = await import('../../server/services/orderService.ts');
  return OrderService.createOrder({
    userId: 'usr-demo-cust-001',
    orderType: 'Dine-in',
    tableNumber: 'Table 01',
    customerName,
    customerPhone: '+91 9999900001',
    customerEmail: 'cleanup-selftest@example.com',
    paymentMethod: 'UPI',
    items: [{ menuItemId: 'itm-001', quantity: 1 }]
  } as any);
}

async function main() {
  const [scenario, arg] = process.argv.slice(2);
  const quiet = { log: () => {} };

  switch (scenario) {
    case 'noop': {
      const out = await runWithIsolatedDatabase(async () => 'noop', quiet);
      emit({ cleanup: out.cleanup });
      break;
    }

    case 'order': {
      const out = await runWithIsolatedDatabase(async () => {
        const order = await createOrder('Cleanup SelfTest Order');
        return { orderId: order.id, orderNumber: order.orderNumber, items: order.items.map((i: any) => i.id) };
      }, quiet);
      emit({ result: out.result, error: out.error ? String(out.error) : null, cleanup: out.cleanup, late: out.lateWritesDetected });
      break;
    }

    case 'booking': {
      const out = await runWithIsolatedDatabase(async () => {
        const { BookingService } = await import('../../server/services/bookingService.ts');
        const booking: any = await BookingService.createBooking({
          userId: 'usr-demo-cust-001',
          tableId: 'tbl-001',
          bookingDate: bookingDate(3),
          startTime: '20:00',
          guestCount: 2,
          specialRequest: 'cleanup self-test'
        } as any);
        return { bookingId: booking.id, bookingReference: booking.bookingReference };
      }, quiet);
      emit({ result: out.result, error: out.error ? String(out.error) : null, cleanup: out.cleanup });
      break;
    }

    case 'failing': {
      let created: string | null = null;
      const out = await runWithIsolatedDatabase(async () => {
        const order = await createOrder('Cleanup SelfTest Failing');
        created = order.id;
        throw new Error('Intentional test failure after creating data');
      }, quiet);
      emit({ result: { orderId: created }, error: out.error ? String((out.error as any).message) : null, cleanup: out.cleanup });
      break;
    }

    case 'partial': {
      let created: string | null = null;
      const out = await runWithIsolatedDatabase(
        async () => {
          const order = await createOrder('Cleanup SelfTest Partial');
          created = order.id;
          return { orderId: order.id };
        },
        {
          ...quiet,
          // Persistent fault: this one order cannot be removed on any attempt.
          faultInjector: (collection, key) => {
            if (collection === 'orders' && key === created) throw new Error('Simulated storage failure');
          }
        }
      );
      emit({ result: { orderId: created }, cleanup: out.cleanup });
      break;
    }

    case 'idempotent': {
      const out = await runWithIsolatedDatabase(async () => {
        const order = await createOrder('Cleanup SelfTest Idempotent');
        return { orderId: order.id };
      }, { ...quiet, keepJournals: true });
      // Run cleanup a second time with the same journal.
      const env = resolveTestEnvironment();
      const paths = journalPaths(env.journalDir, out.runId);
      const priorRegistry: TestDataRegistry = JSON.parse(fs.readFileSync(paths.registry, 'utf-8'));
      const before = fs.readFileSync(env.dbFile, 'utf-8');
      const second = await cleanupRun({ runId: `${out.runId}:repeat`, dbFile: env.dbFile, baselineFile: paths.baseline, priorRegistry });
      const third = await cleanupRun({ runId: `${out.runId}:repeat2`, dbFile: env.dbFile, baselineFile: paths.baseline, priorRegistry });
      const after = fs.readFileSync(env.dbFile, 'utf-8');
      fs.unlinkSync(paths.baseline);
      emit({ result: out.result, first: out.cleanup, second, third, fileUnchangedByRepeats: before === after });
      break;
    }

    case 'late': {
      let lateId: string | null = null;
      let dbRef: any;
      const out = await runWithIsolatedDatabase(async ({ db }) => {
        dbRef = db;
        const order = await createOrder('Cleanup SelfTest Late');
        // Background work that fires AFTER the suite (and cleanup) finished.
        setTimeout(() => {
          lateId = `ntf-late-${Date.now()}`;
          db.notifications.set(lateId, {
            id: lateId, type: 'NEW_ORDER', title: 'late background write', message: 'should never persist',
            read: false, createdAt: new Date().toISOString()
          });
          db.persist();
          db.queueSync('notifications', lateId, { id: lateId });
        }, 2500);
        return { orderId: order.id };
      }, quiet);
      await sleep(4000); // let the late timer fire and any persist attempt run
      const env = resolveTestEnvironment();
      const onDisk = readDb(env.dbFile);
      const lateOnDisk = (onDisk.notifications || []).some((n: any) => n.id === lateId);
      const orderOnDisk = (onDisk.orders || []).some((o: any) => o.id === (out.result as any)?.orderId);
      emit({ result: out.result, cleanup: out.cleanup, lateFired: !!lateId, lateInMemory: !!dbRef?.notifications?.has(lateId), lateOnDisk, orderOnDisk });
      break;
    }

    case 'inspect': {
      // Fresh process reading the test DB like a server would; query UI-facing services.
      const ids = JSON.parse(arg || '{}');
      const env = resolveTestEnvironment();
      process.env.IS_TEST_RUN = 'true';
      process.env.ABC_DB_FILE = env.dbFile;
      assertSafeTestEnvironment(env);
      const { db } = await import('../../server/database/db.ts');
      const t0 = Date.now();
      while (!(db as any).isInitialized && Date.now() - t0 < 30000) await sleep(50);
      const { AdminService } = await import('../../server/services/adminService.ts');
      const { OrderService } = await import('../../server/services/orderService.ts');
      const { BookingService } = await import('../../server/services/bookingService.ts');
      const allOrders = await AdminService.getAllOrders();
      const userOrders = await OrderService.getUserOrders('usr-demo-cust-001');
      const allBookings = await AdminService.getAllBookings();
      const userBookings = await BookingService.getUserBookings('usr-demo-cust-001');
      const stats: any = await AdminService.getDashboardStats();
      const orderIds: string[] = ids.orderIds || [];
      const bookingIds: string[] = ids.bookingIds || [];
      const statsText = JSON.stringify(stats);
      emit({
        ordersInAdminList: allOrders.filter((o) => orderIds.includes(o.id)).map((o) => o.id),
        ordersInCustomerHistory: userOrders.filter((o) => orderIds.includes(o.id)).map((o) => o.id),
        bookingsInAdminList: allBookings.filter((b) => bookingIds.includes(b.id)).map((b) => b.id),
        bookingsInCustomerList: userBookings.filter((b) => bookingIds.includes(b.id)).map((b) => b.id),
        idsInDashboardStats: [...orderIds, ...bookingIds].filter((id) => statsText.includes(id)),
        selfTestNamesInAdminList: allOrders.filter((o) => String(o.customerName || '').startsWith('Cleanup SelfTest')).length
      });
      await sleep(300);
      process.exit(0);
    }

    case 'unsafe': {
      const checks: Record<string, boolean> = {};
      const expectRefusal = (name: string, fn: () => void) => {
        try {
          fn();
          checks[name] = false;
        } catch (err) {
          checks[name] = err instanceof UnsafeTestEnvironmentError;
        }
      };
      const saved = { ...process.env };
      const reset = () => {
        for (const k of ['NODE_ENV', 'USE_REAL_FIRESTORE', 'FIRESTORE_EMULATOR_HOST', 'ABC_DB_FILE']) {
          if (saved[k] === undefined) delete process.env[k];
          else process.env[k] = saved[k];
        }
      };
      const good = resolveTestEnvironment();

      expectRefusal('devDatabaseFile', () =>
        assertSafeTestEnvironment({ ...good, dbFile: DEV_DB_FILE, dbDir: path.dirname(DEV_DB_FILE) }, { requireMarker: false })
      );
      expectRefusal('dataDirectoryItself', () =>
        assertSafeTestEnvironment(resolveTestEnvironment(path.dirname(DEV_DB_FILE)), { requireMarker: false })
      );
      process.env.NODE_ENV = 'production';
      expectRefusal('productionNodeEnv', () => assertSafeTestEnvironment(good, { requireMarker: false }));
      reset();
      process.env.USE_REAL_FIRESTORE = 'true';
      delete process.env.FIRESTORE_EMULATOR_HOST;
      expectRefusal('liveFirestoreWithoutEmulator', () => assertSafeTestEnvironment(good, { requireMarker: false }));
      reset();
      const unmarked = fs.mkdtempSync(path.join(os.tmpdir(), 'abc-unmarked-'));
      expectRefusal('missingMarker', () => assertSafeTestEnvironment(resolveTestEnvironment(unmarked)));
      process.env.ABC_DB_FILE = DEV_DB_FILE;
      expectRefusal('abcDbFilePointsElsewhere', () => assertSafeTestEnvironment(good, { requireMarker: false }));
      reset();

      // The full harness must refuse in production before creating or touching anything.
      process.env.NODE_ENV = 'production';
      const freshDir = path.join(os.tmpdir(), `abc-never-created-${Date.now()}`);
      process.env.TEST_DB_DIR = freshDir;
      let harnessRefused = false;
      try {
        await runWithIsolatedDatabase(async () => 'should not run', quiet);
      } catch (err) {
        harnessRefused = err instanceof UnsafeTestEnvironmentError;
      }
      checks.harnessRefusesProduction = harnessRefused && !fs.existsSync(freshDir);
      emit({ checks });
      break;
    }

    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
  await sleep(200);
  process.exit(0);
}

main().catch((err) => {
  emit({ crashed: String(err?.stack || err) });
  process.exit(1);
});
