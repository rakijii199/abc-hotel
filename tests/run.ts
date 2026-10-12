/**
 * `npm test` entry point.
 *
 * Runs the full suite against the isolated test database with guaranteed
 * cleanup (see tests/support/testHarness.ts). The suite is imported lazily,
 * inside the harness, because server/database/db.ts initialises on import and
 * must only ever see the test database.
 *
 *   npm test                   run tests, then clean up this run's data
 *   npm run test:otp           phone OTP auth verification (isolated + cleaned)
 *   npm run test:security      HTTP security audit against an in-process test server
 *   npm run test:cleanup       only recover/clean unfinished earlier runs
 */
import { cleanupPendingRuns, runWithIsolatedDatabase } from './support/testHarness.ts';

async function main() {
  if (process.argv.includes('--cleanup-only')) {
    const rec = await cleanupPendingRuns();
    const ok = !rec.report || rec.report.verified;
    process.exit(ok ? 0 : 1);
  }

  const scriptIdx = process.argv.indexOf('--script');
  const script = scriptIdx > -1 ? process.argv[scriptIdx + 1] : null;
  if (script) {
    const outcome = await runWithIsolatedDatabase(async () => {
      if (script === 'otp') {
        const { verifyPhoneOtpAuth } = await import('./verifyPhoneOtpAuth.ts');
        const res = await verifyPhoneOtpAuth();
        return { passed: res.success ? 1 : 0, failed: res.success ? 0 : 1, details: res };
      }
      if (script === 'security') {
        // Boot the API server in this process, on its own port, backed by the test DB.
        process.env.PORT = process.env.TEST_SERVER_PORT || '8091';
        await import('../server.ts');
        const base = `http://localhost:${process.env.PORT}`;
        const t0 = Date.now();
        for (;;) {
          try {
            if ((await fetch(`${base}/api/health`)).ok) break;
          } catch {}
          if (Date.now() - t0 > 60000) throw new Error(`Test server did not start on ${base}`);
          await new Promise((r) => setTimeout(r, 300));
        }
        const { runSecurityAudit } = await import('./securityAuditVerification.ts');
        return runSecurityAudit();
      }
      throw new Error(`Unknown --script ${script} (expected otp | security)`);
    });
    console.log(JSON.stringify({ script, result: outcome.result, error: outcome.error ? String((outcome.error as any)?.message || outcome.error) : undefined, cleanup: { status: outcome.cleanup.status, verified: outcome.cleanup.verified, totals: outcome.cleanup.totals, removed: outcome.cleanup.removed } }, null, 2));
    const r: any = outcome.result;
    process.exit(!r || r.failed > 0 || outcome.error || !outcome.cleanup.verified ? 1 : 0);
  }

  const outcome = await runWithIsolatedDatabase(async () => {
    const { runAllTests } = await import('./testRunner.ts');
    return runAllTests();
  });

  const results = outcome.result;
  console.log(
    JSON.stringify(
      {
        ...(results || { total: 0, passed: 0, failed: 0, results: [] }),
        runId: outcome.runId,
        error: outcome.error ? String((outcome.error as any)?.message || outcome.error) : undefined,
        timedOut: outcome.timedOut,
        cleanup: {
          status: outcome.cleanup.status,
          verified: outcome.cleanup.verified,
          totals: outcome.cleanup.totals,
          removed: outcome.cleanup.removed,
          restored: outcome.cleanup.restored,
          failures: outcome.cleanup.failures,
          lateWritesDetected: outcome.lateWritesDetected,
          recoveredRuns: outcome.recovery.recoveredRuns
        }
      },
      null,
      2
    )
  );

  const testsFailed = !results || results.failed > 0 || !!outcome.error;
  const cleanupFailed = !outcome.cleanup.verified;
  process.exit(testsFailed || cleanupFailed ? 1 : 0);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
