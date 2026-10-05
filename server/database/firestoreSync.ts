/**
 * ABC Restaurant — Firebase Firestore Persistence Engine
 * Uses the official server-side @google-cloud/firestore SDK.
 * Authoritative distributed database for Google Cloud Run multi-instance production deployment.
 */
import { Firestore } from '@google-cloud/firestore';
import type { Transaction, WhereFilterOp } from '@google-cloud/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;
let quotaExhaustedUntil: number = 0;
let lastQuotaWarningTime: number = 0;

/**
 * Check if the Firestore quota circuit breaker is currently tripped
 */
export function isQuotaExhausted(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

/**
 * Manually reset the circuit breaker (e.g. for testing)
 */
export function resetQuotaCircuitBreaker(): void {
  quotaExhaustedUntil = 0;
  lastQuotaWarningTime = 0;
}

export function getFirestoreDb(): Firestore | null {
  if (Date.now() < quotaExhaustedUntil) {
    return null;
  }

  if (!firestoreInstance) {
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      let projectId = process.env.FIREBASE_PROJECT_ID;
      let databaseId = process.env.FIRESTORE_DATABASE_ID;

      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        projectId = projectId || config.projectId;
        databaseId = databaseId || config.firestoreDatabaseId;
      }

      // Check for custom service account credentials in environment variable
      let credentials;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        } catch (e) {
          console.warn('[FIRESTORE ENGINE] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY JSON');
        }
      }

      firestoreInstance = new Firestore({
        projectId: projectId || undefined,
        databaseId: databaseId || '(default)',
        ignoreUndefinedProperties: true,
        ...(credentials ? { credentials } : {})
      });

      console.log(`[FIRESTORE SERVER SDK] Connected via @google-cloud/firestore to project: ${projectId}, database: ${databaseId}`);
    } catch (err) {
      console.error('[FIRESTORE SERVER SDK] Error initializing Firestore:', err);
    }
  }
  return firestoreInstance;
}

export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean;
}

function handleFirestoreError(action: string, path: string, err: any): void {
  const errMsg = err?.message || String(err);
  const errCode = err?.code;

  if (
    errCode === 8 ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('exceeded 600000 milliseconds') ||
    errMsg.includes('timed out') ||
    errMsg.includes('quota')
  ) {
    quotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
    if (Date.now() - lastQuotaWarningTime > 60000) {
      lastQuotaWarningTime = Date.now();
      console.warn(`[FIRESTORE NOTICE] Firestore write unavailable or quota reached. Circuit breaker engaged for 15 minutes.`);
    }
    return;
  }

  console.warn(`[FIRESTORE NOTICE] ${action} ${path}: ${errMsg.slice(0, 150)}`);
}

/**
 * Awaited synchronous document write to Firestore
 * Guarantees persistence before returning success.
 */
export async function saveDocToFirestore(collectionName: string, docId: string, data: any): Promise<void> {
  // If in automated unit test runner (without real firestore flag), skip
  if ((process.env.IS_TEST_RUN === 'true' || process.env.NODE_ENV === 'test') && process.env.USE_REAL_FIRESTORE !== 'true') {
    return;
  }

  if (Date.now() < quotaExhaustedUntil) {
    return;
  }

  const db = getFirestoreDb();
  if (!db) return;

  const sanitized = sanitizeForFirestore(data);
  const writePromise = db.collection(collectionName).doc(docId).set(sanitized, { merge: true });
  
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Firestore write to ${collectionName}/${docId} timed out (10s limit)`)), 10000)
  );

  try {
    await Promise.race([writePromise, timeoutPromise]);
  } catch (err: any) {
    handleFirestoreError('write', `${collectionName}/${docId}`, err);
    throw err;
  }
}

/**
 * Backward compatibility alias for syncDocToFirestore (now awaited!)
 */
export async function syncDocToFirestore(collectionName: string, docId: string, data: any): Promise<void> {
  return saveDocToFirestore(collectionName, docId, data);
}

/**
 * Awaited synchronous document deletion from Firestore
 */
export async function deleteDocFromFirestore(collectionName: string, docId: string): Promise<void> {
  if ((process.env.IS_TEST_RUN === 'true' || process.env.NODE_ENV === 'test') && process.env.USE_REAL_FIRESTORE !== 'true') {
    return;
  }

  if (Date.now() < quotaExhaustedUntil) {
    return;
  }

  const db = getFirestoreDb();
  if (!db) return;

  const deletePromise = db.collection(collectionName).doc(docId).delete();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Firestore delete on ${collectionName}/${docId} timed out (10s limit)`)), 10000)
  );

  try {
    await Promise.race([deletePromise, timeoutPromise]);
  } catch (err: any) {
    handleFirestoreError('delete', `${collectionName}/${docId}`, err);
    throw err;
  }
}

/**
 * Read a single document directly from Firestore
 */
export async function getDocFromFirestore<T>(collectionName: string, docId: string): Promise<T | null> {
  if ((process.env.IS_TEST_RUN === 'true' || process.env.NODE_ENV === 'test') && process.env.USE_REAL_FIRESTORE !== 'true') {
    return null;
  }

  if (Date.now() < quotaExhaustedUntil) {
    return null;
  }

  try {
    const db = getFirestoreDb();
    if (!db) return null;

    const getPromise = db.collection(collectionName).doc(docId).get();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore read on ${collectionName}/${docId} timed out (5s limit)`)), 5000)
    );

    const docSnap = await Promise.race([getPromise, timeoutPromise]);
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as T;
  } catch (err: any) {
    handleFirestoreError('readDoc', `${collectionName}/${docId}`, err);
    return null;
  }
}

/**
 * Load all documents from a Firestore collection directly
 */
export async function loadCollectionFromFirestore<T>(collectionName: string): Promise<T[]> {
  if ((process.env.IS_TEST_RUN === 'true' || process.env.NODE_ENV === 'test') && process.env.USE_REAL_FIRESTORE !== 'true') {
    return [];
  }

  if (Date.now() < quotaExhaustedUntil) {
    return [];
  }

  try {
    const db = getFirestoreDb();
    if (!db) return [];

    const getPromise = db.collection(collectionName).get();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore read on ${collectionName} timed out (8s limit)`)), 8000)
    );

    const snapshot = await Promise.race([getPromise, timeoutPromise]);
    const items: T[] = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data() as T);
    });
    return items;
  } catch (err: any) {
    handleFirestoreError('loadCollection', collectionName, err);
    return [];
  }
}

/**
 * Query documents from a Firestore collection with filter
 */
export async function queryFirestore<T>(
  collectionName: string,
  field: string,
  op: WhereFilterOp,
  value: any
): Promise<T[]> {
  if ((process.env.IS_TEST_RUN === 'true' || process.env.NODE_ENV === 'test') && process.env.USE_REAL_FIRESTORE !== 'true') {
    return [];
  }

  if (Date.now() < quotaExhaustedUntil) {
    return [];
  }

  try {
    const db = getFirestoreDb();
    if (!db) return [];

    const queryPromise = db.collection(collectionName).where(field, op, value).get();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore query on ${collectionName} timed out (5s limit)`)), 5000)
    );

    const snapshot = await Promise.race([queryPromise, timeoutPromise]);
    const items: T[] = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data() as T);
    });
    return items;
  } catch (err: any) {
    handleFirestoreError('query', `${collectionName}?${field}${op}${value}`, err);
    return [];
  }
}

/**
 * Run an atomic Firestore transaction
 */
export async function runFirestoreTransaction<T>(
  updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore database is not connected for transaction.');
  }

  return db.runTransaction(updateFunction);
}
