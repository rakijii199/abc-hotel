import { db } from '../database/db.ts';
import { PurchaseOrder } from '../types/index.ts';

export class PurchaseOrderRepository {
  public static getAll(): PurchaseOrder[] {
    return Array.from(db.purchaseOrders.values());
  }

  public static getById(id: string): PurchaseOrder | undefined {
    return db.purchaseOrders.get(id);
  }

  public static save(po: PurchaseOrder): PurchaseOrder {
    db.purchaseOrders.set(po.id, po);
    db.persist();
    return po;
  }
}
