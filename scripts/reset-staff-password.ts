/**
 * Break-glass recovery: reset one EMPLOYEE account's password directly in Firestore.
 *
 * Use only when no ADMIN/MANAGER can sign in to reset it from the dashboard
 * (for example right after the removal of the old default-password fallback).
 *
 *   RESET_PASSWORD='<new strong password>' npx tsx scripts/reset-staff-password.ts --username admin --confirm
 *
 * - The password is read from RESET_PASSWORD (not argv) so it stays out of shell history listings.
 * - Customer accounts are refused; only employee roles can be reset.
 * - Without --confirm it only prints what it would change.
 * - Uses the same project / database configuration as the server (ADC credentials).
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getFirestoreDb } from '../server/database/firestoreSync.ts';
import { config } from '../server/config/index.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const username = (arg('username') || '').toLowerCase().trim();
  const confirm = process.argv.includes('--confirm');
  const password = process.env.RESET_PASSWORD || '';

  if (!username) throw new Error('Pass --username <employee username>.');
  if (
    password.length < 10 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error('RESET_PASSWORD must be at least 10 characters with upper, lower, digit and symbol.');
  }

  const fdb = getFirestoreDb();
  if (!fdb) throw new Error('Firestore is not available (check credentials, or this is a test run).');

  console.log(`Project: ${config.firebaseProjectId}  Database: ${config.firestoreDatabaseId}`);
  const snap = await fdb.collection('users').where('username', '==', username).limit(2).get();
  if (snap.size !== 1) throw new Error(`Expected exactly one user with username "${username}", found ${snap.size}.`);

  const doc = snap.docs[0];
  const user = doc.data();
  if (!user.role || user.role === 'CUSTOMER') throw new Error('Refusing: only employee accounts can be reset with this script.');

  console.log(`User: ${doc.id} (${user.role}, status ${user.status || 'ACTIVE'})`);
  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to set the new password.');
    return;
  }

  await doc.ref.update({
    passwordHash: await bcrypt.hash(password, 12),
    updatedAt: new Date().toISOString()
  });
  console.log('Password updated. Restart (or redeploy) the backend so every instance reloads the account.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`ERROR: ${err?.message || err}`);
    process.exit(1);
  }
);
