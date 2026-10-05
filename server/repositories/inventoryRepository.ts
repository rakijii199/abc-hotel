/**
 * Inventory Repository for persistent stock tracking, recipes & movements
 */
import { db } from '../database/db.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  saveDocToFirestore,
  deleteDocFromFirestore
} from '../database/firestoreSync.ts';
import {
  InventoryItem,
  MenuItemRecipe,
  StockMovement,
  InventoryStats,
  InventoryCategory,
  StockMovementType,
  DailyStockLog,
  MonthlyReconciliation
} from '../types/index.ts';

export class InventoryRepository {
  public static getAllItems(category?: string, search?: string, targetMonth?: string): InventoryItem[] {
    const currentMonth = targetMonth || new Date().toISOString().substring(0, 7);
    let items = Array.from(db.inventoryItems.values());

    if (category && category !== 'ALL') {
      items = items.filter((i) => i.category === category);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.supplier && i.supplier.toLowerCase().includes(q))
      );
    }

    // Enrich each item with lifetime and monthly movement aggregates
    return items
      .map((item) => {
        let totalPurchased = 0;
        let totalConsumed = 0;
        let totalWasted = 0;
        let monthlyPurchased = 0;
        let monthlyConsumed = 0;
        let monthlyWasted = 0;

        for (const m of db.stockMovements) {
          if (m.inventoryItemId !== item.id) continue;
          const mMth = m.month || (m.createdAt ? m.createdAt.substring(0, 7) : '');
          const isMonth = mMth === currentMonth;
          const qty = Math.abs(m.quantity);

          if (m.type === 'PURCHASE' || m.type === 'ADD_ON_STOCK') {
            totalPurchased += m.quantity;
            if (isMonth) monthlyPurchased += m.quantity;
          } else if (m.type === 'AUTO_CONSUMPTION') {
            totalConsumed += qty;
            if (isMonth) monthlyConsumed += qty;
          } else if (m.type === 'WASTAGE') {
            totalWasted += qty;
            if (isMonth) monthlyWasted += qty;
          }
        }

        // Determine baseline opening stock if not set
        const computedOpening = item.openingStock !== undefined
          ? item.openingStock
          : Number((item.currentStock + totalConsumed + totalWasted - totalPurchased).toFixed(2));

        return {
          ...item,
          openingStock: computedOpening >= 0 ? computedOpening : (item.currentStock > 0 ? item.currentStock : 25),
          totalPurchased: Number(totalPurchased.toFixed(2)),
          totalConsumed: Number(totalConsumed.toFixed(2)),
          totalWasted: Number(totalWasted.toFixed(2)),
          monthlyPurchased: Number(monthlyPurchased.toFixed(2)),
          monthlyConsumed: Number(monthlyConsumed.toFixed(2)),
          monthlyWasted: Number(monthlyWasted.toFixed(2))
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public static async getItemById(id: string): Promise<InventoryItem | undefined> {
    const fsItem = await getDocFromFirestore<InventoryItem>('inventoryItems', id);
    if (fsItem) {
      db.inventoryItems.set(fsItem.id, fsItem);
      return fsItem;
    }
    return db.inventoryItems.get(id);
  }

  public static getItemByIdSync(id: string): InventoryItem | undefined {
    return db.inventoryItems.get(id);
  }

  public static async createItem(item: InventoryItem): Promise<InventoryItem> {
    db.inventoryItems.set(item.id, item);
    await saveDocToFirestore('inventoryItems', item.id, item);
    db.persist();
    return item;
  }

  public static async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const existing = await this.getItemById(id);
    if (!existing) {
      throw new Error(`Inventory item with ID ${id} not found.`);
    }

    const updated: InventoryItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    db.inventoryItems.set(id, updated);
    await saveDocToFirestore('inventoryItems', id, updated);
    db.persist();
    return updated;
  }

  public static async deleteItem(id: string): Promise<boolean> {
    const deleted = db.inventoryItems.delete(id);
    await deleteDocFromFirestore('inventoryItems', id);
    db.persist();
    return deleted;
  }

  // Recipes
  public static getAllRecipes(): MenuItemRecipe[] {
    return Array.from(db.menuItemRecipes.values());
  }

  public static getRecipeByMenuItemId(menuItemId: string): MenuItemRecipe | undefined {
    return db.menuItemRecipes.get(menuItemId);
  }

  public static async saveRecipe(recipe: MenuItemRecipe): Promise<MenuItemRecipe> {
    const data = {
      ...recipe,
      updatedAt: new Date().toISOString()
    };
    db.menuItemRecipes.set(recipe.menuItemId, data);
    await saveDocToFirestore('menuItemRecipes', recipe.menuItemId, data);
    db.persist();
    return recipe;
  }

  // Stock Movements
  public static async recordMovement(movement: StockMovement): Promise<StockMovement> {
    const withMonth: StockMovement = {
      ...movement,
      month: movement.month || (movement.createdAt ? movement.createdAt.substring(0, 7) : new Date().toISOString().substring(0, 7))
    };
    db.stockMovements.unshift(withMonth); // Newest first
    if (db.stockMovements.length > 25000) {
      db.stockMovements = db.stockMovements.slice(0, 25000);
    }
    await saveDocToFirestore('stockMovements', withMonth.id, withMonth);
    db.persist();
    return withMonth;
  }

  public static getMovements(limit = 2000): StockMovement[] {
    return db.stockMovements.slice(0, limit);
  }

  // Stats & Reports
  public static getStats(): InventoryStats {
    const items = Array.from(db.inventoryItems.values());
    const totalValuation = items.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
    const lowStockItemsCount = items.filter(
      (item) => item.currentStock <= item.minThreshold
    ).length;
    const outOfStockItemsCount = items.filter((item) => item.currentStock <= 0).length;

    return {
      totalItems: items.length,
      totalValuation: Math.round(totalValuation),
      lowStockItemsCount,
      outOfStockItemsCount,
      recentMovementsCount: db.stockMovements.length,
      suppliersCount: db.suppliers.size,
      pendingPOsCount: Array.from(db.purchaseOrders.values()).filter(po => po.status === 'SUBMITTED').length
    };
  }

  // --- Daily Stock Logs ---
  public static getDailyLogs(date: string): DailyStockLog[] {
    const items = this.getAllItems();
    const logs: DailyStockLog[] = [];

    for (const item of items) {
      const logId = `${date}_${item.id}`;
      let log = db.dailyStockLogs.get(logId);

      // Compute consumption and replenishment for this item on this date
      const dayMovements = db.stockMovements.filter((m) => {
        const movDate = m.createdAt.split('T')[0];
        return movDate === date && m.inventoryItemId === item.id;
      });

      const autoConsumed = Math.abs(
        dayMovements
          .filter((m) => m.type === 'AUTO_CONSUMPTION')
          .reduce((sum, m) => sum + m.quantity, 0)
      );

      const replenished = dayMovements
        .filter((m) => m.type === 'PURCHASE')
        .reduce((sum, m) => sum + m.quantity, 0);

      // Treat opening as current stock before today's net movements.
      const openingStock = Number(Math.max(0, item.currentStock + autoConsumed - replenished).toFixed(2));
      const expectedStock = Number((openingStock + replenished - autoConsumed).toFixed(2));

      if (!log) {
        log = {
          id: logId,
          date,
          inventoryItemId: item.id,
          inventoryItemName: item.name,
          unit: item.unit,
          openingStock,
          autoConsumed,
          replenished,
          expectedStock,
          status: 'PENDING'
        };
        db.dailyStockLogs.set(logId, log);
      } else {
        if (log.status === 'PENDING') {
          log.openingStock = openingStock;
          log.autoConsumed = autoConsumed;
          log.replenished = replenished;
          log.expectedStock = expectedStock;
        }
      }

      logs.push(log);
    }

    db.persist();
    return logs;
  }

  public static reconcileDailyItem(
    date: string,
    itemId: string,
    physicalStock: number,
    notes?: string,
    userId?: string
  ): DailyStockLog {
    const logId = `${date}_${itemId}`;
    this.getDailyLogs(date); // ensures log exists
    const log = db.dailyStockLogs.get(logId);

    if (!log) {
      throw new Error(`Daily log for item ${itemId} on ${date} not found.`);
    }

    const variance = Number((log.expectedStock - physicalStock).toFixed(2));
    
    log.physicalStock = physicalStock;
    log.variance = variance;
    log.status = 'RECONCILED';
    log.notes = notes || 'Daily stock reconciled';
    log.reconciledAt = new Date().toISOString();
    log.reconciledBy = userId || 'usr-admin-001';

    db.dailyStockLogs.set(logId, log);

    // Update physical currentStock
    const item = db.inventoryItems.get(itemId);
    if (item) {
      item.currentStock = physicalStock;
      item.updatedAt = new Date().toISOString();
      db.inventoryItems.set(itemId, item);
    }

    // Log wastage / adjustment movement
    if (variance !== 0) {
      const type = variance > 0 ? 'WASTAGE' : 'MANUAL_ADJUSTMENT';
      const changeQty = -variance; // negative for wastage, positive for extra stock

      this.recordMovement({
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        inventoryItemId: itemId,
        inventoryItemName: item?.name || log.inventoryItemName,
        type,
        quantity: changeQty,
        unit: log.unit,
        notes: `Daily reconciliation variance: expected ${log.expectedStock}, physical ${physicalStock}. ${notes || ''}`,
        createdAt: new Date().toISOString(),
        createdBy: userId
      });
    }

    db.persist();
    return log;
  }

  // --- Monthly Reconciliation ---
  public static getMonthlyReconciliation(month: string): MonthlyReconciliation {
    let rec = db.monthlyReconciliations.get(month);

    const monthMovements = db.stockMovements.filter((m) => {
      return (m.createdAt && m.createdAt.startsWith(month)) || m.month === month;
    });

    const items = this.getAllItems();
    
    // Compute item-by-item breakdown and rolling balances
    const itemsBreakdown = items.map((item) => {
      const itemMovements = monthMovements.filter((m) => m.inventoryItemId === item.id);
      
      const purchaseMovs = itemMovements.filter((m) => m.type === 'PURCHASE');
      const addOnMovs = itemMovements.filter((m) => m.type === 'ADD_ON_STOCK');
      const consumptionMovs = itemMovements.filter((m) => m.type === 'AUTO_CONSUMPTION');
      const wastageMovs = itemMovements.filter((m) => m.type === 'WASTAGE');

      const basePurchasesQty = purchaseMovs.reduce((sum, m) => sum + Math.max(0, m.quantity), 0);
      const basePurchasesCost = purchaseMovs.reduce((sum, m) => sum + (m.cost || Math.max(0, m.quantity) * item.unitCost), 0);

      const addOnStockQty = addOnMovs.reduce((sum, m) => sum + Math.max(0, m.quantity), 0);
      const addOnStockCost = addOnMovs.reduce((sum, m) => sum + (m.cost || Math.max(0, m.quantity) * item.unitCost), 0);

      const consumedQty = consumptionMovs.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const consumedCost = consumedQty * item.unitCost;

      const wastageQty = wastageMovs.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const wastageCost = wastageQty * item.unitCost;

      // Calculate realistic opening stock for this month
      const openingStock = Math.max(0, Number((item.currentStock - basePurchasesQty - addOnStockQty + consumedQty + wastageQty).toFixed(2)));
      const closingStock = Math.max(0, Number((openingStock + basePurchasesQty + addOnStockQty - consumedQty - wastageQty).toFixed(2)));
      const closingValuation = Math.round(closingStock * item.unitCost);

      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        unitCost: item.unitCost,
        openingStock,
        basePurchasesQty,
        basePurchasesCost: Math.round(basePurchasesCost),
        addOnStockQty,
        addOnStockCost: Math.round(addOnStockCost),
        consumedQty: Number(consumedQty.toFixed(2)),
        consumedCost: Math.round(consumedCost),
        wastageQty: Number(wastageQty.toFixed(2)),
        wastageCost: Math.round(wastageCost),
        closingStock,
        closingValuation,
        addOnOrdersCount: addOnMovs.length
      };
    });

    const totalOpeningValuation = itemsBreakdown.reduce((sum, i) => sum + (i.openingStock * i.unitCost), 0);
    const totalPurchases = itemsBreakdown.reduce((sum, i) => sum + i.basePurchasesCost, 0);
    const totalAddOnStock = itemsBreakdown.reduce((sum, i) => sum + i.addOnStockCost, 0);
    const totalAddOnStockQty = itemsBreakdown.reduce((sum, i) => sum + i.addOnStockQty, 0);
    const totalConsumption = itemsBreakdown.reduce((sum, i) => sum + i.consumedCost, 0);
    const totalWastage = itemsBreakdown.reduce((sum, i) => sum + i.wastageCost, 0);
    const totalClosingValuation = Math.max(0, totalOpeningValuation + totalPurchases + totalAddOnStock - totalConsumption - totalWastage);

    if (!rec) {
      rec = {
        id: `mrec-${month}`,
        month,
        totalOpeningValuation: Math.round(totalOpeningValuation),
        totalPurchases: Math.round(totalPurchases),
        totalAddOnStock: Math.round(totalAddOnStock),
        totalAddOnStockQty: Number(totalAddOnStockQty.toFixed(2)),
        totalConsumption: Math.round(totalConsumption),
        totalWastage: Math.round(totalWastage),
        totalClosingValuation: Math.round(totalClosingValuation),
        itemsBreakdown,
        status: 'OPEN'
      };
      db.monthlyReconciliations.set(month, rec);
      db.persist();
    } else {
      if (rec.status === 'OPEN') {
        rec.totalOpeningValuation = Math.round(totalOpeningValuation);
        rec.totalPurchases = Math.round(totalPurchases);
        rec.totalAddOnStock = Math.round(totalAddOnStock);
        rec.totalAddOnStockQty = Number(totalAddOnStockQty.toFixed(2));
        rec.totalConsumption = Math.round(totalConsumption),
        rec.totalWastage = Math.round(totalWastage);
        rec.totalClosingValuation = Math.round(totalClosingValuation);
        rec.itemsBreakdown = itemsBreakdown;
      }
    }

    return rec;
  }

  public static closeMonthlyReconciliation(month: string, userId?: string): MonthlyReconciliation {
    const rec = this.getMonthlyReconciliation(month);
    rec.status = 'CLOSED';
    rec.closedAt = new Date().toISOString();
    rec.closedBy = userId || 'usr-admin-001';
    db.monthlyReconciliations.set(month, rec);
    db.persist();
    return rec;
  }
}
