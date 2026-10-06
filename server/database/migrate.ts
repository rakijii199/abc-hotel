/**
 * ABC Restaurant — Firebase Firestore Data Migration Script
 * Migrates Users, Roles/Permissions, Default Tables, and Master Catalog
 * Intentionally EXCLUDES all historical orders, payments, invoices, bookings, and stock movements.
 */
import { getFirestoreDb, sanitizeForFirestore } from './firestoreSync.ts';
import fs from 'fs';
import path from 'path';

export async function runFirestoreMigration() {
  console.log('====================================================');
  console.log('🚀 Starting ABC Restaurant -> Firestore Migration');
  console.log('====================================================');

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found!');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log(`📌 Target Firebase Project Name: abc-restaurant-prod`);
  console.log(`📌 Target Firebase Project ID: ${config.projectId}`);
  console.log(`📌 Target Database ID: ${config.firestoreDatabaseId}`);

 const db = getFirestoreDb();

if (!db) {
  throw new Error(
    'Failed to initialize Firestore server instance. ' +
    'Check Firestore connectivity, credentials, project ID, database ID, and Cloud Run service account.'
  );
}

  // Source Database: hotel_database.json (or backup)
  const sourcePath = fs.existsSync(path.resolve(process.cwd(), 'data/hotel_database_backup.json'))
    ? path.resolve(process.cwd(), 'data/hotel_database_backup.json')
    : path.resolve(process.cwd(), 'data/hotel_database.json');

  const rawData = fs.readFileSync(sourcePath, 'utf8');
  const source = JSON.parse(rawData);

  // 1. Migrate Users
  const usersToMigrate = source.users || [];
  console.log(`\n👤 Migrating ${usersToMigrate.length} Users...`);
  let userCount = 0;
  for (const user of usersToMigrate) {
    await db.collection('users').doc(user.id).set(sanitizeForFirestore({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      username: user.username || user.email?.split('@')[0] || user.id,
      passwordHash: user.passwordHash || '',
      role: user.role || 'CUSTOMER',
      status: user.status || 'ACTIVE',
      permissions: user.permissions || [],
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: user.updatedAt || new Date().toISOString()
    }));
    userCount++;
  }
  console.log(`✅ Users Migrated: ${userCount}`);

  // 2. Roles and Permissions Definition
  console.log('\n🛡️ Initializing Roles & Permissions Config...');
  const roles = [
    {
      id: 'role-admin',
      name: 'ADMIN',
      description: 'Full System Administrator Access',
      permissions: ['ALL']
    },
    {
      id: 'role-manager',
      name: 'MANAGER',
      description: 'Hotel & Operations Manager',
      permissions: ['MANAGE_USERS', 'MANAGE_TABLES', 'MANAGE_MENU', 'VIEW_REPORTS', 'MANAGE_ORDERS']
    },
    {
      id: 'role-staff',
      name: 'STAFF',
      description: 'Front Desk & Floor Staff',
      permissions: ['MANAGE_TABLES', 'TAKE_ORDERS', 'VIEW_ORDERS', 'MANAGE_BOOKINGS']
    },
    {
      id: 'role-kitchen',
      name: 'KITCHEN',
      description: 'Kitchen Display System & Chefs',
      permissions: ['VIEW_KITCHEN', 'UPDATE_ORDER_STATUS']
    },
    {
      id: 'role-delivery',
      name: 'DELIVERY',
      description: 'Delivery Rider Portal',
      permissions: ['VIEW_DELIVERIES', 'UPDATE_DELIVERY_STATUS']
    },
    {
      id: 'role-customer',
      name: 'CUSTOMER',
      description: 'Guest & Customer Online Portal',
      permissions: ['PLACE_ORDER', 'BOOK_TABLE', 'VIEW_MY_ORDERS']
    }
  ];

  let roleCount = 0;
  for (const role of roles) {
    await db.collection('roles').doc(role.id).set(sanitizeForFirestore(role));
    roleCount++;
  }
  console.log(`✅ Roles Migrated: ${roleCount}`);

  // 3. Migrate Default Tables
  const tablesToMigrate = source.tables || [];
  console.log(`\n🪑 Migrating ${tablesToMigrate.length} Default Tables...`);
  let tableCount = 0;
  for (const table of tablesToMigrate) {
    const tableNumStr = table.tableNumber || table.number || `Table ${tableCount + 1}`;
    const tableNumInt = parseInt(String(tableNumStr).replace(/\D/g, '') || String(tableCount + 1), 10);
    const tableName = table.name || tableNumStr;

    await db.collection('tables').doc(table.id).set(sanitizeForFirestore({
      id: table.id,
      number: tableNumInt,
      tableNumber: tableNumStr,
      name: tableName,
      capacity: table.capacity || table.seatingCapacity || 4,
      seatingCapacity: table.capacity || table.seatingCapacity || 4,
      section: table.section || table.location || 'Main Dining',
      location: table.location || table.section || 'Main Dining',
      status: table.status || 'AVAILABLE',
      qrCodeUrl: table.qrCodeUrl || '',
      qrCodeData: table.qrCodeData || `https://ais-pre-4mlfcjwnlezh6laaee6l3m-957856789904.asia-southeast1.run.app/menu?tableId=${table.id}`,
      isActive: table.isActive !== undefined ? table.isActive : true,
      createdAt: table.createdAt || new Date().toISOString(),
      updatedAt: table.updatedAt || new Date().toISOString()
    }));
    tableCount++;
  }
  console.log(`✅ Default Tables Migrated: ${tableCount}`);

  // 4. Migrate Hotels & Restaurants
  const hotelsToMigrate = source.hotels || [];
  for (const hotel of hotelsToMigrate) {
    await db.collection('hotels').doc(hotel.id).set(sanitizeForFirestore(hotel));
  }
  const restaurantsToMigrate = source.restaurants || [];
  for (const restaurant of restaurantsToMigrate) {
    await db.collection('restaurants').doc(restaurant.id).set(sanitizeForFirestore(restaurant));
  }

  // 5. Migrate Menu Categories & Menu Items (Master Catalog)
  const menuCategories = source.menuCategories || [];
  for (const cat of menuCategories) {
    await db.collection('menuCategories').doc(cat.id).set(sanitizeForFirestore(cat));
  }
  const menuItems = source.menuItems || [];
  for (const item of menuItems) {
    await db.collection('menuItems').doc(item.id).set(sanitizeForFirestore(item));
  }
  console.log(`✅ Menu Master Catalog Migrated: ${menuCategories.length} Categories, ${menuItems.length} Items`);

  // 6. Migrate Master Config (Billing Settings & Payment Config)
  if (source.billingSettings) {
    await db.collection('billingSettings').doc('default').set(sanitizeForFirestore(source.billingSettings));
  }
  if (source.paymentConfig) {
    await db.collection('paymentConfig').doc('default').set(sanitizeForFirestore(source.paymentConfig));
  }

  console.log('\n====================================================');
  console.log('🚫 EXCLUDED HISTORICAL TRANSACTIONS (CLEAN PRODUCTION SLATE):');
  console.log('   - Orders: NOT MIGRATED (0 records in Firestore)');
  console.log('   - Payments: NOT MIGRATED (0 records in Firestore)');
  console.log('   - Invoices: NOT MIGRATED (0 records in Firestore)');
  console.log('   - Bookings: NOT MIGRATED (0 records in Firestore)');
  console.log('   - Stock Movements: NOT MIGRATED (0 records in Firestore)');
  console.log('   - Historical Reports: NOT MIGRATED');
  console.log('====================================================');

  return {
    userCount,
    roleCount,
    tableCount,
    menuCategoriesCount: menuCategories.length,
    menuItemsCount: menuItems.length
  };
}
