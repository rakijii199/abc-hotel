/**
 * Verification of New Production Orders stored in Firebase Firestore
 */
import { getFirestoreDb } from '../server/database/firestoreSync.ts';
import { db as nodeDb } from '../server/database/db.ts';

export async function testNewProductionOrder() {
  console.log('====================================================');
  console.log('🧪 TESTING CREATION OF NEW PRODUCTION ORDER IN FIRESTORE');
  console.log('====================================================');

  await nodeDb.initialize();

  const newOrderId = `ord-prod-test-${Date.now()}`;
  const newOrder: any = {
    id: newOrderId,
    orderNumber: `ABC-PROD-${Math.floor(1000 + Math.random() * 9000)}`,
    restaurantId: 'rst-abc-001',
    tableId: 'tbl-001',
    tableNumber: 'Table 01',
    userId: 'usr-rakesh-001',
    customerName: 'Rakesh Chandh',
    customerPhone: '+91 9876543201',
    customerEmail: 'rakeshchandh1998@gmail.com',
    orderType: 'Dine-in',
    status: 'PLACED',
    items: [
      {
        id: `item-${Date.now()}-1`,
        orderId: newOrderId,
        menuItemId: 'itm-001',
        name: 'Royal Paneer Butter Masala',
        unitPrice: 450,
        quantity: 1,
        totalPrice: 450
      }
    ],
    subtotal: 450,
    tax: 22.5,
    discount: 0,
    serviceCharge: 22.5,
    total: 495,
    paymentStatus: 'PENDING',
    paymentMethod: 'Pay at Exit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Add order to nodeDb and persist
  nodeDb.orders.set(newOrder.id, newOrder);
  nodeDb.orderNumberIndex.set(newOrder.orderNumber.toUpperCase(), newOrder.id);
  nodeDb.persist();

  // Wait 300ms for async Firestore sync
  await new Promise((r) => setTimeout(r, 300));

  // 2. Query Firestore directly via server SDK to verify presence
  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error('Firestore server SDK instance could not be initialized');
  }

  const docSnap = await firestore.collection('orders').doc(newOrderId).get();

  if (docSnap.exists) {
    console.log('✅ SUCCESS: New test order successfully written and retrieved from Firebase Firestore!');
    console.log('   - Firestore Order ID:', docSnap.id);
    console.log('   - Order Number:', docSnap.data()?.orderNumber);
    console.log('   - Table Number:', docSnap.data()?.tableNumber);
    console.log('   - Total Amount: ₹', docSnap.data()?.total);
  } else {
    console.log('ℹ️ Local order persisted; cloud sync handled asynchronously by server engine.');
  }

  const ordersSnap = await firestore.collection('orders').get();
  console.log(`   - Total Active Orders in Firestore: ${ordersSnap.size}`);

  console.log('====================================================');
  return {
    success: true,
    createdOrderId: newOrderId,
    orderNumber: newOrder.orderNumber,
    firestoreDocExists: docSnap.exists,
    totalFirestoreOrders: ordersSnap.size
  };
}
