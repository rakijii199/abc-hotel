import { db } from '../database/db.ts';
import { WastageRecord } from '../types/index.ts';

export class WastageRepository {
  public static getAll(): WastageRecord[] {
    return Array.from(db.wastageRecords.values());
  }

  public static getById(id: string): WastageRecord | undefined {
    return db.wastageRecords.get(id);
  }

  public static save(wastage: WastageRecord): WastageRecord {
    db.wastageRecords.set(wastage.id, wastage);
    db.persist();
    return wastage;
  }
}
