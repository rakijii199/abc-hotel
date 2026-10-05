/**
 * ABC Restaurant — Firestore Database & Workflow Verification Script
 */
import { getFirestoreDb } from '../server/database/firestoreSync.ts';

export async function verifyFirestoreSystem() {
  console.log('====================================================');
  console.log('🔍 VERIFYING FIRESTORE PRODUCTION DATABASE STATE (SERVER SDK)');
  console.log('====================================================');

  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Failed to initialize Firestore server instance');
  }

  // 1. Verify Users Collection
  const usersSnap = await db.collection('users').get();
  console.log(`\n1. Users Collection Docs Count: ${usersSnap.size}`);
  
  let adminFound = false;
  let managerFound = false;
  let staffFound = false;
  let kitchenFound = false;
  let deliveryFound = false;
  let customerFound = false;

  usersSnap.forEach((doc) => {
    const data = doc.data();
    if (data.role === 'ADMIN') adminFound = true;
    if (data.role === 'MANAGER') managerFound = true;
    if (data.role === 'STAFF') staffFound = true;
    if (data.role === 'KITCHEN') kitchenFound = true;
    if (data.role === 'DELIVERY') deliveryFound = true;
    if (data.role === 'CUSTOMER') customerFound = true;
  });

  console.log(`   - ADMIN user exists: ${adminFound}`);
  console.log(`   - MANAGER user exists: ${managerFound}`);
  console.log(`   - STAFF user exists: ${staffFound}`);
  console.log(`   - KITCHEN user exists: ${kitchenFound}`);
  console.log(`   - DELIVERY user exists: ${deliveryFound}`);
  console.log(`   - CUSTOMER user exists: ${customerFound}`);

  // 2. Verify Tables Collection & QR Codes
  const tablesSnap = await db.collection('tables').get();
  console.log(`\n2. Default Tables Collection Docs Count: ${tablesSnap.size}`);
  const table1Snap = await db.collection('tables').doc('tbl-001').get();
  if (table1Snap.exists) {
    const t1 = table1Snap.data();
    console.log(`   - Table 01 ID: ${t1?.id}, Name: ${t1?.name}, Capacity: ${t1?.capacity || t1?.seatingCapacity}`);
  }

  // 3. Verify Roles
  const rolesSnap = await db.collection('roles').get();
  console.log(`\n3. Roles Collection Docs Count: ${rolesSnap.size}`);

  // 4. Verify Excluded Historical Collections
  const ordersSnap = await db.collection('orders').get();
  const paymentsSnap = await db.collection('payments').get();
  const invoicesSnap = await db.collection('invoices').get();
  const bookingsSnap = await db.collection('bookings').get();

  console.log('\n4. Production Transaction History Initial State:');
  console.log(`   - Orders Count in Firestore: ${ordersSnap.size}`);
  console.log(`   - Payments Count in Firestore: ${paymentsSnap.size}`);
  console.log(`   - Invoices Count in Firestore: ${invoicesSnap.size}`);
  console.log(`   - Bookings Count in Firestore: ${bookingsSnap.size}`);

  console.log('====================================================');
  return {
    usersCount: usersSnap.size,
    tablesCount: tablesSnap.size,
    rolesCount: rolesSnap.size,
    ordersCount: ordersSnap.size,
    paymentsCount: paymentsSnap.size,
    invoicesCount: invoicesSnap.size,
    bookingsCount: bookingsSnap.size,
    allRolesPresent: adminFound && managerFound && staffFound && kitchenFound && deliveryFound && customerFound
  };
}
