/**
 * Menu Category & Items Repository
 * Authoritative Firestore persistence with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { MenuCategory, MenuItem } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  saveDocToFirestore,
  deleteDocFromFirestore
} from '../database/firestoreSync.ts';

export class MenuRepository {
  // Categories
  public static async getAllCategories(): Promise<MenuCategory[]> {
    const fsCats = await loadCollectionFromFirestore<MenuCategory>('menuCategories');
    if (fsCats && fsCats.length > 0) {
      for (const c of fsCats) {
        db.menuCategories.set(c.id, c);
      }
      return fsCats.sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return Array.from(db.menuCategories.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public static getAllCategoriesSync(): MenuCategory[] {
    return Array.from(db.menuCategories.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public static async getCategoryById(id: string): Promise<MenuCategory | null> {
    if (!id) return null;
    const fsCat = await getDocFromFirestore<MenuCategory>('menuCategories', id);
    if (fsCat) {
      db.menuCategories.set(fsCat.id, fsCat);
      return fsCat;
    }
    return db.menuCategories.get(id) || null;
  }

  public static async createCategory(category: MenuCategory): Promise<MenuCategory> {
    db.menuCategories.set(category.id, category);
    await saveDocToFirestore('menuCategories', category.id, category);
    db.persist();
    return category;
  }

  public static async updateCategory(id: string, updates: Partial<MenuCategory>): Promise<MenuCategory | null> {
    const cat = await this.getCategoryById(id);
    if (!cat) return null;
    const updated = { ...cat, ...updates };
    db.menuCategories.set(id, updated);
    await saveDocToFirestore('menuCategories', id, updated);
    db.persist();
    return updated;
  }

  public static async deleteCategory(id: string): Promise<boolean> {
    db.menuCategories.delete(id);
    await deleteDocFromFirestore('menuCategories', id);
    db.persist();
    return true;
  }

  // Menu Items
  public static async getAllItems(): Promise<MenuItem[]> {
    const fsItems = await loadCollectionFromFirestore<MenuItem>('menuItems');
    const source = fsItems && fsItems.length > 0 ? fsItems : Array.from(db.menuItems.values());
    if (fsItems && fsItems.length > 0) {
      for (const i of fsItems) {
        db.menuItems.set(i.id, i);
      }
    }
    return source.map((item) => {
      const category = db.menuCategories.get(item.categoryId);
      return {
        ...item,
        categoryName: category ? category.name : 'General'
      };
    });
  }

  public static getAllItemsSync(): MenuItem[] {
    return Array.from(db.menuItems.values()).map((item) => {
      const category = db.menuCategories.get(item.categoryId);
      return {
        ...item,
        categoryName: category ? category.name : 'General'
      };
    });
  }

  public static async getItemById(id: string): Promise<MenuItem | null> {
    if (!id) return null;
    const fsItem = await getDocFromFirestore<MenuItem>('menuItems', id);
    if (fsItem) {
      db.menuItems.set(fsItem.id, fsItem);
      const category = db.menuCategories.get(fsItem.categoryId);
      return {
        ...fsItem,
        categoryName: category ? category.name : 'General'
      };
    }
    const item = db.menuItems.get(id);
    if (!item) return null;
    const category = db.menuCategories.get(item.categoryId);
    return {
      ...item,
      categoryName: category ? category.name : 'General'
    };
  }

  public static getItemByIdSync(id: string): MenuItem | null {
    const item = db.menuItems.get(id);
    if (!item) return null;
    const category = db.menuCategories.get(item.categoryId);
    return {
      ...item,
      categoryName: category ? category.name : 'General'
    };
  }

  public static async createItem(item: MenuItem): Promise<MenuItem> {
    db.menuItems.set(item.id, item);
    await saveDocToFirestore('menuItems', item.id, item);
    db.persist();
    return (await this.getItemById(item.id)) || item;
  }

  public static async updateItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem | null> {
    const item = await this.getItemById(id);
    if (!item) return null;
    const updated: MenuItem = {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    db.menuItems.set(id, updated);
    await saveDocToFirestore('menuItems', id, updated);
    db.persist();
    return await this.getItemById(id);
  }

  public static async deleteItem(id: string): Promise<boolean> {
    db.menuItems.delete(id);
    await deleteDocFromFirestore('menuItems', id);
    db.persist();
    return true;
  }
}
