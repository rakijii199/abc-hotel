/**
 * Order & Payment Repository with Strict State Transitions
 * Authoritative Firestore database with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { Order, OrderIdempotencyRecord, OrderStatus, Payment } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  queryFirestore,
  saveDocToFirestore
} from '../database/firestoreSync.ts';

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'PICKED_UP', 'SERVED', 'WAITING_FOR_PAYMENT', 'CUSTOMER_DONE', 'BILLING_PENDING', 'COMPLETED', 'CANCELLED'],
  DELIVERY_ASSIGNED: ['DELIVERY_ACCEPTED', 'PICKED_UP', 'CANCELLED'],
  DELIVERY_ACCEPTED: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'COMPLETED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'WAITING_FOR_PAYMENT', 'CANCELLED'],
  SERVED: ['CUSTOMER_DONE', 'BILLING_PENDING', 'BILL_GENERATED', 'WAITING_FOR_PAYMENT', 'COMPLETED', 'CANCELLED'],
  CUSTOMER_DONE: ['BILLING_PENDING', 'BILL_GENERATED', 'WAITING_FOR_PAYMENT', 'COMPLETED', 'CANCELLED'],
  BILLING_PENDING: ['BILL_GENERATED', 'WAITING_FOR_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED'],
  BILL_GENERATED: ['PAYMENT_PENDING', 'WAITING_FOR_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'WAITING_FOR_PAYMENT', 'COMPLETED', 'CANCELLED'],
  WAITING_FOR_PAYMENT: ['PAID', 'COMPLETED', 'CANCELLED'],
  PAID: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

export class OrderRepository {
  /**
   * Authoritative read: queries Firestore directly, caches locally
   */
  public static async getAll(): Promise<Order[]> {
    const fsOrders = await loadCollectionFromFirestore<Order>('orders');
    if (fsOrders && fsOrders.length > 0) {
      for (const o of fsOrders) {
        db.orders.set(o.id, o);
        if (o.orderNumber) db.orderNumberIndex.set(o.orderNumber.toUpperCase(), o.id);
      }
      return fsOrders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return Array.from(db.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Synchronous cache reader for instant in-process lookups
   */
  public static getAllSync(): Order[] {
    return Array.from(db.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Authoritative read: checks Firestore first, falls back to cache
   */
  public static async getById(id: string): Promise<Order | null> {
    if (!id) return null;
    const fsOrder = await getDocFromFirestore<Order>('orders', id);
    if (fsOrder) {
      db.orders.set(fsOrder.id, fsOrder);
      if (fsOrder.orderNumber) db.orderNumberIndex.set(fsOrder.orderNumber.toUpperCase(), fsOrder.id);
      return fsOrder;
    }
    return db.orders.get(id) || null;
  }

  public static getByIdSync(id: string): Order | null {
    return db.orders.get(id) || null;
  }

  public static async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    if (!orderNumber) return null;
    const clean = orderNumber.toUpperCase().trim();
    const fsOrders = await queryFirestore<Order>('orders', 'orderNumber', '==', clean);
    if (fsOrders && fsOrders.length > 0) {
      const o = fsOrders[0];
      db.orders.set(o.id, o);
      db.orderNumberIndex.set(clean, o.id);
      return o;
    }
    const id = db.orderNumberIndex.get(clean);
    if (id) return db.orders.get(id) || null;
    return null;
  }

  public static async getByUserId(userId: string): Promise<Order[]> {
    if (!userId) return [];
    const fsOrders = await queryFirestore<Order>('orders', 'userId', '==', userId);
    if (fsOrders && fsOrders.length > 0) {
      for (const o of fsOrders) {
        db.orders.set(o.id, o);
      }
      return fsOrders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return Array.from(db.orders.values())
      .filter((o) => o.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public static async getByDate(dateStr: string): Promise<Order[]> {
    const all = await this.getAll();
    return all.filter((o) => o.createdAt && o.createdAt.startsWith(dateStr));
  }

  /**
   * Authoritative mutation: updates local cache and awaits Firestore persistence
   */
  public static async create(order: Order): Promise<Order> {
    db.orders.set(order.id, order);
    db.orderNumberIndex.set(order.orderNumber.toUpperCase(), order.id);
    await saveDocToFirestore('orders', order.id, order);
    db.persist();
    return order;
  }

  public static async update(order: Order): Promise<Order> {
    db.orders.set(order.id, order);
    db.orderNumberIndex.set(order.orderNumber.toUpperCase(), order.id);
    await saveDocToFirestore('orders', order.id, order);
    db.persist();
    return order;
  }

  public static async updateStatus(
    id: string,
    status: OrderStatus,
    riderInfo?: { deliveryRiderId?: string; deliveryRiderName?: string; deliveryRiderPhone?: string }
  ): Promise<Order | null> {
    const order = await this.getById(id);
    if (!order) return null;

    if (order.status !== status) {
      const allowed = VALID_ORDER_TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        throw new Error(`Invalid order transition from ${order.status} to ${status}.`);
      }
    }

    order.status = status;
    if (riderInfo) {
      if (riderInfo.deliveryRiderId) order.deliveryRiderId = riderInfo.deliveryRiderId;
      if (riderInfo.deliveryRiderName) order.deliveryRiderName = riderInfo.deliveryRiderName;
      if (riderInfo.deliveryRiderPhone) order.deliveryRiderPhone = riderInfo.deliveryRiderPhone;
    }
    order.updatedAt = new Date().toISOString();
    return await this.update(order);
  }

  public static async recordPayment(payment: Payment): Promise<Payment> {
    db.payments.set(payment.id, payment);
    await saveDocToFirestore('payments', payment.id, payment);
    db.persist();
    return payment;
  }

  public static async getIdempotencyRecord(scopedKey: string): Promise<OrderIdempotencyRecord | null> {
    if (!scopedKey) return null;
    const fsRecord = await getDocFromFirestore<OrderIdempotencyRecord>('orderIdempotency', scopedKey);
    if (fsRecord) {
      db.orderIdempotency.set(scopedKey, fsRecord);
      return fsRecord;
    }
    return db.orderIdempotency.get(scopedKey) || null;
  }

  public static async saveIdempotencyRecord(record: OrderIdempotencyRecord): Promise<OrderIdempotencyRecord> {
    db.orderIdempotency.set(record.id, record);
    await saveDocToFirestore('orderIdempotency', record.id, record);
    db.persist();
    return record;
  }
}
