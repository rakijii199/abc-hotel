/**
 * Restaurant & Table Repository
 * Authoritative Firestore persistence with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { Restaurant, DiningTable, Hotel } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  saveDocToFirestore,
  deleteDocFromFirestore
} from '../database/firestoreSync.ts';

export class RestaurantRepository {
  public static getHotel(): Hotel | null {
    return Array.from(db.hotels.values())[0] || null;
  }

  public static getRestaurant(): Restaurant | null {
    return Array.from(db.restaurants.values())[0] || null;
  }

  public static async getById(id: string): Promise<Restaurant | null> {
    const fsRest = await getDocFromFirestore<Restaurant>('restaurants', id);
    if (fsRest) {
      db.restaurants.set(fsRest.id, fsRest);
      return fsRest;
    }
    return db.restaurants.get(id) || null;
  }

  public static async updateSettings(updates: Partial<Restaurant>): Promise<Restaurant | null> {
    const restaurant = this.getRestaurant();
    if (!restaurant) return null;
    Object.assign(restaurant, updates);
    await saveDocToFirestore('restaurants', restaurant.id, restaurant);
    db.persist();
    return restaurant;
  }
}

export class TableRepository {
  public static async getAll(): Promise<DiningTable[]> {
    const fsTables = await loadCollectionFromFirestore<DiningTable>('tables');
    if (fsTables && fsTables.length > 0) {
      for (const t of fsTables) {
        db.tables.set(t.id, t);
      }
      return fsTables;
    }
    return Array.from(db.tables.values());
  }

  public static getAllSync(): DiningTable[] {
    return Array.from(db.tables.values());
  }

  public static async getById(id: string): Promise<DiningTable | null> {
    if (!id) return null;
    const fsTable = await getDocFromFirestore<DiningTable>('tables', id);
    if (fsTable) {
      db.tables.set(fsTable.id, fsTable);
      return fsTable;
    }
    return db.tables.get(id) || null;
  }

  public static getByIdSync(id: string): DiningTable | null {
    return db.tables.get(id) || null;
  }

  public static async create(table: DiningTable): Promise<DiningTable> {
    db.tables.set(table.id, table);
    await saveDocToFirestore('tables', table.id, table);
    db.persist();
    return table;
  }

  public static async update(id: string, updates: Partial<DiningTable>): Promise<DiningTable | null> {
    const table = await this.getById(id);
    if (!table) return null;
    const updated = { ...table, ...updates };
    db.tables.set(id, updated);
    await saveDocToFirestore('tables', id, updated);
    db.persist();
    return updated;
  }

  public static async updateStatus(id: string, status: DiningTable['status']): Promise<DiningTable | null> {
    return await this.update(id, { status });
  }

  public static async delete(id: string): Promise<boolean> {
    db.tables.delete(id);
    await deleteDocFromFirestore('tables', id);
    db.persist();
    return true;
  }
}
