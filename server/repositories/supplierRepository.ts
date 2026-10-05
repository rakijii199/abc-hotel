import { db } from '../database/db.ts';
import { Supplier } from '../types/index.ts';

export class SupplierRepository {
  public static getAll(): Supplier[] {
    return Array.from(db.suppliers.values());
  }

  public static getById(id: string): Supplier | undefined {
    return db.suppliers.get(id);
  }

  public static save(supplier: Supplier): Supplier {
    db.suppliers.set(supplier.id, supplier);
    db.persist();
    return supplier;
  }
}
