/**
 * Invoice Repository
 * Authoritative Firestore persistence with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { Invoice, BillingSettings, BillingAuditLog } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  queryFirestore,
  saveDocToFirestore
} from '../database/firestoreSync.ts';

export class InvoiceRepository {
  public static async getAll(): Promise<Invoice[]> {
    const fsInvoices = await loadCollectionFromFirestore<Invoice>('invoices');
    if (fsInvoices && fsInvoices.length > 0) {
      for (const inv of fsInvoices) {
        db.invoices.set(inv.id, inv);
        if (inv.invoiceNumber) db.invoiceNumberIndex.set(inv.invoiceNumber.toUpperCase(), inv.id);
        if (inv.publicToken) db.invoiceTokenIndex.set(inv.publicToken, inv.id);
        if (inv.orderId) db.orderInvoiceIndex.set(inv.orderId, inv.id);
      }
      return fsInvoices.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return Array.from(db.invoices.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static getAllSync(): Invoice[] {
    return Array.from(db.invoices.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static async getById(id: string): Promise<Invoice | null> {
    if (!id) return null;
    const fsInv = await getDocFromFirestore<Invoice>('invoices', id);
    if (fsInv) {
      db.invoices.set(fsInv.id, fsInv);
      if (fsInv.invoiceNumber) db.invoiceNumberIndex.set(fsInv.invoiceNumber.toUpperCase(), fsInv.id);
      if (fsInv.publicToken) db.invoiceTokenIndex.set(fsInv.publicToken, fsInv.id);
      if (fsInv.orderId) db.orderInvoiceIndex.set(fsInv.orderId, fsInv.id);
      return fsInv;
    }
    return db.invoices.get(id) || null;
  }

  public static getByIdSync(id: string): Invoice | null {
    return db.invoices.get(id) || null;
  }

  public static async getByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    if (!invoiceNumber) return null;
    const clean = invoiceNumber.toUpperCase().trim();
    const fsInvs = await queryFirestore<Invoice>('invoices', 'invoiceNumber', '==', clean);
    if (fsInvs && fsInvs.length > 0) {
      const inv = fsInvs[0];
      db.invoices.set(inv.id, inv);
      db.invoiceNumberIndex.set(clean, inv.id);
      return inv;
    }
    const id = db.invoiceNumberIndex.get(clean);
    if (id) return db.invoices.get(id) || null;
    return null;
  }

  public static async getByToken(token: string): Promise<Invoice | null> {
    if (!token) return null;
    const fsInvs = await queryFirestore<Invoice>('invoices', 'publicToken', '==', token);
    if (fsInvs && fsInvs.length > 0) {
      const inv = fsInvs[0];
      db.invoices.set(inv.id, inv);
      db.invoiceTokenIndex.set(token, inv.id);
      return inv;
    }
    const id = db.invoiceTokenIndex.get(token);
    if (id) return db.invoices.get(id) || null;
    return null;
  }

  public static async getByOrderId(orderId: string): Promise<Invoice | null> {
    if (!orderId) return null;
    const fsInvs = await queryFirestore<Invoice>('invoices', 'orderId', '==', orderId);
    if (fsInvs && fsInvs.length > 0) {
      const inv = fsInvs[0];
      db.invoices.set(inv.id, inv);
      db.orderInvoiceIndex.set(orderId, inv.id);
      return inv;
    }
    const id = db.orderInvoiceIndex.get(orderId);
    if (id) return db.invoices.get(id) || null;
    return null;
  }

  public static getByOrderIdSync(orderId: string): Invoice | null {
    const id = db.orderInvoiceIndex.get(orderId);
    if (id) return db.invoices.get(id) || null;
    return null;
  }

  public static async save(invoice: Invoice): Promise<Invoice> {
    db.invoices.set(invoice.id, invoice);
    db.invoiceNumberIndex.set(invoice.invoiceNumber.toUpperCase(), invoice.id);
    db.invoiceTokenIndex.set(invoice.publicToken, invoice.id);
    db.orderInvoiceIndex.set(invoice.orderId, invoice.id);
    await saveDocToFirestore('invoices', invoice.id, invoice);
    db.persist();
    return invoice;
  }

  public static getNextInvoiceNumber(prefix?: string): string {
    const pfx = prefix || db.billingSettings.invoicePrefix || 'INV';
    const year = new Date().getFullYear();
    db.invoiceCounter += 1;
    const seq = db.invoiceCounter.toString().padStart(6, '0');
    db.persist();
    return `${pfx}-${year}-${seq}`;
  }

  public static getSettings(): BillingSettings {
    return db.billingSettings;
  }

  public static async updateSettings(settings: Partial<BillingSettings>): Promise<BillingSettings> {
    db.billingSettings = {
      ...db.billingSettings,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    await saveDocToFirestore('billingSettings', db.billingSettings.id, db.billingSettings);
    db.persist();
    return db.billingSettings;
  }

  public static async recordAudit(audit: Omit<BillingAuditLog, 'id' | 'timestamp'>): Promise<BillingAuditLog> {
    const newAudit: BillingAuditLog = {
      ...audit,
      id: `audit_bill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    db.billingAuditLogs.set(newAudit.id, newAudit);
    await saveDocToFirestore('billingAuditLogs', newAudit.id, newAudit);
    db.persist();
    return newAudit;
  }

  public static getAuditLogs(orderId?: string, invoiceId?: string): BillingAuditLog[] {
    return Array.from(db.billingAuditLogs.values())
      .filter((log) => {
        if (orderId && log.orderId !== orderId) return false;
        if (invoiceId && log.invoiceId !== invoiceId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
