/**
 * Payment and Payment Attempt Repository
 * Authoritative Firestore persistence with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { Payment, PaymentAttempt, PaymentGatewayStatus } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  queryFirestore,
  saveDocToFirestore
} from '../database/firestoreSync.ts';

export class PaymentRepository {
  public static async getAll(): Promise<Payment[]> {
    const fsPayments = await loadCollectionFromFirestore<Payment>('payments');
    if (fsPayments && fsPayments.length > 0) {
      for (const p of fsPayments) {
        db.payments.set(p.id, p);
      }
      return fsPayments.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return Array.from(db.payments.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static getAllSync(): Payment[] {
    return Array.from(db.payments.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static async getById(id: string): Promise<Payment | null> {
    if (!id) return null;
    const fsPayment = await getDocFromFirestore<Payment>('payments', id);
    if (fsPayment) {
      db.payments.set(fsPayment.id, fsPayment);
      return fsPayment;
    }
    return db.payments.get(id) || null;
  }

  public static getByIdSync(id: string): Payment | null {
    return db.payments.get(id) || null;
  }

  public static async getByOrderId(orderId: string): Promise<Payment | null> {
    if (!orderId) return null;
    const fsPayments = await queryFirestore<Payment>('payments', 'orderId', '==', orderId);
    if (fsPayments && fsPayments.length > 0) {
      const p = fsPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      db.payments.set(p.id, p);
      return p;
    }
    const local = Array.from(db.payments.values()).filter((p) => p.orderId === orderId);
    if (local.length > 0) {
      return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }
    return null;
  }

  public static getByOrderIdSync(orderId: string): Payment | null {
    const local = Array.from(db.payments.values()).filter((p) => p.orderId === orderId);
    if (local.length > 0) {
      return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }
    return null;
  }

  public static async getByProviderOrderId(providerOrderId: string): Promise<Payment | null> {
    if (!providerOrderId) return null;
    const fsPayments = await queryFirestore<Payment>('payments', 'providerOrderId', '==', providerOrderId);
    if (fsPayments && fsPayments.length > 0) {
      const p = fsPayments[0];
      db.payments.set(p.id, p);
      return p;
    }
    const paymentId = db.providerOrderIndex.get(providerOrderId);
    if (paymentId) return db.payments.get(paymentId) || null;
    return Array.from(db.payments.values()).find((p) => p.providerOrderId === providerOrderId) || null;
  }

  public static async getByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    if (!providerPaymentId) return null;
    const fsPayments = await queryFirestore<Payment>('payments', 'providerPaymentId', '==', providerPaymentId);
    if (fsPayments && fsPayments.length > 0) {
      const p = fsPayments[0];
      db.payments.set(p.id, p);
      return p;
    }
    const paymentId = db.providerPaymentIndex.get(providerPaymentId);
    if (paymentId) return db.payments.get(paymentId) || null;
    return Array.from(db.payments.values()).find((p) => p.providerPaymentId === providerPaymentId) || null;
  }

  public static async save(payment: Payment): Promise<Payment> {
    db.payments.set(payment.id, payment);
    if (payment.providerOrderId) {
      db.providerOrderIndex.set(payment.providerOrderId, payment.id);
    }
    if (payment.providerPaymentId) {
      db.providerPaymentIndex.set(payment.providerPaymentId, payment.id);
    }
    await saveDocToFirestore('payments', payment.id, payment);
    db.persist();
    return payment;
  }

  public static async update(payment: Payment): Promise<Payment> {
    payment.updatedAt = new Date().toISOString();
    return await this.save(payment);
  }

  // Payment Attempts
  public static async saveAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt> {
    db.paymentAttempts.set(attempt.id, attempt);
    await saveDocToFirestore('paymentAttempts', attempt.id, attempt);
    db.persist();
    return attempt;
  }

  public static async getAttemptById(id: string): Promise<PaymentAttempt | null> {
    if (!id) return null;
    const fsAttempt = await getDocFromFirestore<PaymentAttempt>('paymentAttempts', id);
    if (fsAttempt) {
      db.paymentAttempts.set(fsAttempt.id, fsAttempt);
      return fsAttempt;
    }
    return db.paymentAttempts.get(id) || null;
  }

  public static getAttemptByIdSync(id: string): PaymentAttempt | null {
    return db.paymentAttempts.get(id) || null;
  }

  public static async getAllAttempts(): Promise<PaymentAttempt[]> {
    const fsAttempts = await loadCollectionFromFirestore<PaymentAttempt>('paymentAttempts');
    if (fsAttempts && fsAttempts.length > 0) {
      for (const a of fsAttempts) {
        db.paymentAttempts.set(a.id, a);
      }
      return fsAttempts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return Array.from(db.paymentAttempts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static async getAttemptsByOrderId(orderId: string): Promise<PaymentAttempt[]> {
    if (!orderId) return [];
    const fsAttempts = await queryFirestore<PaymentAttempt>('paymentAttempts', 'orderId', '==', orderId);
    if (fsAttempts && fsAttempts.length > 0) {
      for (const a of fsAttempts) {
        db.paymentAttempts.set(a.id, a);
      }
      return fsAttempts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return Array.from(db.paymentAttempts.values())
      .filter((pa) => pa.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Payment Configuration
  public static getConfig() {
    return db.paymentConfig;
  }

  public static async updateConfig(configData: Partial<typeof db.paymentConfig>) {
    db.paymentConfig = {
      ...db.paymentConfig,
      ...configData,
      updatedAt: new Date().toISOString()
    };
    await saveDocToFirestore('paymentConfigs', db.paymentConfig.id, db.paymentConfig);
    db.persist();
    return db.paymentConfig;
  }
}
