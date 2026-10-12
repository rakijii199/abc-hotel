/**
 * Test-run data registry & record-level cleanup for the file-backed database.
 *
 * Strategy: before a run starts, the isolated test database file is journaled
 * as the run's baseline. After the run, the registry of records belonging to
 * that run is derived by diffing the database against the baseline:
 *   - created  → records that did not exist before the run   (removed)
 *   - modified → pre-existing fixtures the run changed        (restored)
 *   - deleted  → pre-existing fixtures the run removed        (re-inserted)
 * Only keys listed in the registry are touched; nothing else in a collection
 * is ever deleted. Records created indirectly (notifications, audit logs,
 * stock movements, payments, invoices...) are captured because the diff covers
 * every persisted collection, not just the ones a test explicitly wrote.
 */
import fs from 'fs';
import path from 'path';

export type DbSnapshot = Record<string, any>;

/** Persisted metadata fields that change on every write and are not records. */
const VOLATILE_FIELDS = new Set(['lastUpdated', 'version']);

export interface CollectionRegistry {
  created: string[];
  modified: string[];
  deleted: string[];
}

export interface TestDataRegistry {
  runId: string;
  generatedAt: string;
  collections: Record<string, CollectionRegistry>;
  scalarsChanged: string[];
}

export interface CleanupFailure {
  collection: string;
  key: string;
  error: string;
}

export type CleanupStatus = 'CLEAN' | 'NOTHING_TO_CLEAN' | 'PARTIAL' | 'FAILED';

export interface CleanupReport {
  runId: string;
  status: CleanupStatus;
  verified: boolean;
  removed: Record<string, number>;
  restored: Record<string, number>;
  reinserted: Record<string, number>;
  alreadyAbsent: Record<string, number>;
  scalarsRestored: string[];
  failures: CleanupFailure[];
  /** Failures from earlier attempts that a later retry resolved. */
  transientFailures: CleanupFailure[];
  residual: Record<string, CollectionRegistry>;
  totals: { removed: number; restored: number; reinserted: number; alreadyAbsent: number; failures: number };
  attempts: number;
  durationMs: number;
  notes: string[];
}

/** Identity of a record inside a persisted collection. */
export function recordKey(record: any): string {
  if (record && typeof record === 'object') {
    if (record.id !== undefined && record.id !== null) return String(record.id);
    if (record.menuItemId) return `menuItem:${record.menuItemId}`;
    if (record.date) return `date:${record.date}`;
    if (record.key) return `key:${record.key}`;
  }
  return `json:${stableStringify(record)}`;
}

export function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function readDb(file: string): DbSnapshot {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** Atomic write (temp file + rename) with retries for transient Windows file locks. */
export async function writeDbAtomic(file: string, data: DbSnapshot, attempts = 5): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmp, file);
      return;
    } catch (err: any) {
      lastErr = err;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(err?.code)) break;
      await sleep(100 * (i + 1));
    }
  }
  try {
    fs.unlinkSync(tmp);
  } catch {}
  throw lastErr;
}

function indexByKey(list: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const item of list || []) map.set(recordKey(item), item);
  return map;
}

function isCollection(value: any): value is any[] {
  return Array.isArray(value);
}

/** Derive the run's registry: everything that differs from the baseline. */
export function computeRegistry(baseline: DbSnapshot, current: DbSnapshot, runId: string): TestDataRegistry {
  const collections: Record<string, CollectionRegistry> = {};
  const scalarsChanged: string[] = [];
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const name of keys) {
    if (VOLATILE_FIELDS.has(name)) continue;
    const before = baseline[name];
    const after = current[name];

    if (isCollection(before) || isCollection(after)) {
      const b = indexByKey(isCollection(before) ? before : []);
      const a = indexByKey(isCollection(after) ? after : []);
      const entry: CollectionRegistry = { created: [], modified: [], deleted: [] };
      for (const [k, rec] of a) {
        if (!b.has(k)) entry.created.push(k);
        else if (stableStringify(b.get(k)) !== stableStringify(rec)) entry.modified.push(k);
      }
      for (const k of b.keys()) if (!a.has(k)) entry.deleted.push(k);
      if (entry.created.length || entry.modified.length || entry.deleted.length) collections[name] = entry;
    } else if (stableStringify(before) !== stableStringify(after)) {
      scalarsChanged.push(name);
    }
  }
  return { runId, generatedAt: new Date().toISOString(), collections, scalarsChanged };
}

export function registryIsEmpty(reg: TestDataRegistry): boolean {
  return Object.keys(reg.collections).length === 0 && reg.scalarsChanged.length === 0;
}

export function countRegistry(reg: TestDataRegistry) {
  let created = 0, modified = 0, deleted = 0;
  for (const c of Object.values(reg.collections)) {
    created += c.created.length;
    modified += c.modified.length;
    deleted += c.deleted.length;
  }
  return { created, modified, deleted, scalars: reg.scalarsChanged.length };
}

export interface ApplyOptions {
  /** Test hook: throw to simulate a record that cannot be removed. */
  faultInjector?: (collection: string, key: string) => void;
}

/**
 * Apply the registry to the current snapshot and return the cleaned snapshot.
 * Pure function: only registry keys are touched.
 */
export function applyRegistry(
  baseline: DbSnapshot,
  current: DbSnapshot,
  registry: TestDataRegistry,
  report: CleanupReport,
  opts: ApplyOptions = {}
): DbSnapshot {
  const next: DbSnapshot = { ...current };

  for (const [name, entry] of Object.entries(registry.collections)) {
    const baseList: any[] = isCollection(baseline[name]) ? baseline[name] : [];
    const curList: any[] = isCollection(current[name]) ? current[name] : [];
    const base = indexByKey(baseList);
    const cur = indexByKey(curList);
    const createdSet = new Set(entry.created);
    const modifiedSet = new Set(entry.modified);
    const deletedSet = new Set(entry.deleted);
    const keepCreated: any[] = [];

    for (const key of entry.created) {
      if (!cur.has(key)) {
        report.alreadyAbsent[name] = (report.alreadyAbsent[name] || 0) + 1;
        continue;
      }
      try {
        opts.faultInjector?.(name, key);
        report.removed[name] = (report.removed[name] || 0) + 1;
      } catch (err: any) {
        report.failures.push({ collection: name, key, error: err?.message || String(err) });
        keepCreated.push(cur.get(key));
      }
    }

    // Rebuild the collection: every non-registry record is carried over untouched.
    const rebuilt: any[] = [];
    for (const rec of curList) {
      const key = recordKey(rec);
      if (createdSet.has(key)) continue; // removed (or re-added below if removal failed)
      if (modifiedSet.has(key) && base.has(key)) {
        rebuilt.push(base.get(key));
        report.restored[name] = (report.restored[name] || 0) + 1;
      } else {
        rebuilt.push(rec);
      }
    }
    for (const key of deletedSet) {
      if (!cur.has(key) && base.has(key)) {
        rebuilt.push(base.get(key));
        report.reinserted[name] = (report.reinserted[name] || 0) + 1;
      }
    }
    rebuilt.push(...keepCreated);
    if (isCollection(current[name]) || rebuilt.length) next[name] = rebuilt;
    if (!isCollection(baseline[name]) && rebuilt.length === 0) delete next[name];
  }

  for (const name of registry.scalarsChanged) {
    if (name in baseline) next[name] = baseline[name];
    else delete next[name];
    report.scalarsRestored.push(name);
  }
  return next;
}

function emptyReport(runId: string): CleanupReport {
  return {
    runId,
    status: 'NOTHING_TO_CLEAN',
    verified: false,
    removed: {},
    restored: {},
    reinserted: {},
    alreadyAbsent: {},
    scalarsRestored: [],
    failures: [],
    transientFailures: [],
    residual: {},
    totals: { removed: 0, restored: 0, reinserted: 0, alreadyAbsent: 0, failures: 0 },
    attempts: 0,
    durationMs: 0,
    notes: []
  };
}

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

export interface CleanupRunOptions extends ApplyOptions {
  runId: string;
  dbFile: string;
  baselineFile: string;
  registryFile?: string;
  /** A previously journaled registry (used for idempotent re-runs). */
  priorRegistry?: TestDataRegistry;
  maxAttempts?: number;
}

/**
 * Clean the database file back to the run's baseline and verify the result
 * by re-reading it from disk. Never reports success without verification.
 */
export async function cleanupRun(opts: CleanupRunOptions): Promise<CleanupReport> {
  const t0 = Date.now();
  const report = emptyReport(opts.runId);
  const maxAttempts = opts.maxAttempts ?? 3;

  if (!fs.existsSync(opts.baselineFile)) {
    report.status = 'FAILED';
    report.notes.push(`Baseline journal missing: ${opts.baselineFile}`);
    report.durationMs = Date.now() - t0;
    return report;
  }
  const baseline = readDb(opts.baselineFile);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    report.attempts = attempt;
    if (report.failures.length) {
      report.transientFailures.push(...report.failures);
      report.failures = [];
    }
    try {
      const current = readDb(opts.dbFile);
      const registry = computeRegistry(baseline, current, opts.runId);

      // Records the journaled registry expected but that are already gone (idempotent re-run).
      if (attempt === 1 && opts.priorRegistry) {
        for (const [name, entry] of Object.entries(opts.priorRegistry.collections)) {
          const live = indexByKey(isCollection(current[name]) ? current[name] : []);
          for (const key of entry.created) {
            if (!live.has(key)) report.alreadyAbsent[name] = (report.alreadyAbsent[name] || 0) + 1;
          }
        }
      }

      if (attempt === 1 && opts.registryFile) {
        fs.writeFileSync(opts.registryFile, JSON.stringify(registry, null, 2), 'utf-8');
      }

      if (!registryIsEmpty(registry)) {
        const cleaned = applyRegistry(baseline, current, registry, report, opts);
        await writeDbAtomic(opts.dbFile, cleaned);
        if (report.failures.length && attempt < maxAttempts) {
          // Retry: registry keys are recomputed, so already-removed records are not touched twice.
          await sleep(150 * attempt);
          continue;
        }
      }

      // Verification: re-read from disk and diff against the baseline again.
      const residual = computeRegistry(baseline, readDb(opts.dbFile), opts.runId);
      report.residual = residual.collections;
      report.verified = registryIsEmpty(residual);
      if (report.verified) break;
    } catch (err: any) {
      report.notes.push(`Attempt ${attempt} error: ${err?.message || err}`);
      await sleep(150 * attempt);
    }
  }

  report.totals = {
    removed: sum(report.removed),
    restored: sum(report.restored),
    reinserted: sum(report.reinserted),
    alreadyAbsent: sum(report.alreadyAbsent),
    failures: report.failures.length
  };
  const touched = report.totals.removed + report.totals.restored + report.totals.reinserted + report.scalarsRestored.length;
  if (!report.verified) report.status = touched > 0 ? 'PARTIAL' : 'FAILED';
  else report.status = touched > 0 || report.failures.length ? 'CLEAN' : 'NOTHING_TO_CLEAN';
  report.durationMs = Date.now() - t0;
  return report;
}

export function formatReport(report: CleanupReport): string {
  const lines = [
    `[TEST CLEANUP] run=${report.runId} status=${report.status} verified=${report.verified} attempts=${report.attempts} (${report.durationMs}ms)`,
    `[TEST CLEANUP] removed=${report.totals.removed} restored=${report.totals.restored} reinserted=${report.totals.reinserted} alreadyAbsent=${report.totals.alreadyAbsent} failures=${report.totals.failures}`
  ];
  const removed = Object.entries(report.removed).map(([k, v]) => `${k}:${v}`).join(', ');
  if (removed) lines.push(`[TEST CLEANUP] removed by collection → ${removed}`);
  const restored = Object.entries(report.restored).map(([k, v]) => `${k}:${v}`).join(', ');
  if (restored) lines.push(`[TEST CLEANUP] restored fixtures → ${restored}`);
  for (const f of report.failures.slice(0, 10)) lines.push(`[TEST CLEANUP] FAILURE ${f.collection}/${f.key}: ${f.error}`);
  if (report.transientFailures.length) lines.push(`[TEST CLEANUP] ${report.transientFailures.length} transient failure(s) resolved on retry`);
  for (const n of report.notes) lines.push(`[TEST CLEANUP] note: ${n}`);
  return lines.join('\n');
}

/** Journal paths for a run. */
export function journalPaths(journalDir: string, runId: string) {
  return {
    baseline: path.join(journalDir, `${runId}.baseline.json`),
    registry: path.join(journalDir, `${runId}.registry.json`),
    report: path.join(journalDir, `${runId}.report.json`)
  };
}
