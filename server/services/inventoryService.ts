/**
 * Inventory Service for Stock Auto-Deductions, Purchase Replenishments,
 * Low Stock Alerts, and Recipe Mappings.
 */
import { InventoryRepository } from '../repositories/inventoryRepository.ts';
import { MenuRepository } from '../repositories/menuRepository.ts';
import { NotificationRepository } from '../repositories/notificationRepository.ts';
import { AuditRepository } from '../repositories/auditRepository.ts';
import { getFirestoreDb, saveDocToFirestore } from '../database/firestoreSync.ts';
import { db } from '../database/db.ts';
import {
  InventoryItem,
  MenuItemRecipe,
  StockMovement,
  Order,
  OrderItem,
  InventoryCategory,
  InventoryUnit,
  MonthlyReconciliation
} from '../types/index.ts';

export class InventoryService {
  /**
   * Get all inventory items with optional search & category filter
   */
  public static getAllItems(category?: string, search?: string, month?: string) {
    return InventoryRepository.getAllItems(category, search, month);
  }

  /**
   * Create a new Inventory Item (Raw Material / Ingredient)
   */
  public static async createItem(params: {
    name: string;
    category: InventoryCategory;
    openingStock: number;
    unit: InventoryUnit;
    minThreshold: number;
    unitCost: number;
    supplier?: string;
    userId?: string;
  }): Promise<InventoryItem> {
    if (!params.name || !params.name.trim()) {
      throw new Error('Item name is required.');
    }
    if (params.openingStock < 0) {
      throw new Error('Opening stock cannot be negative.');
    }
    if (params.minThreshold < 0) {
      throw new Error('Reorder threshold cannot be negative.');
    }

    const itemId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newItem: InventoryItem = {
      id: itemId,
      name: params.name.trim(),
      category: params.category || 'Pantry',
      currentStock: Number(params.openingStock) || 0,
      unit: params.unit || 'kg',
      minThreshold: Number(params.minThreshold) || 5,
      unitCost: Number(params.unitCost) || 0,
      supplier: params.supplier?.trim() || undefined,
      lastRestockedAt: params.openingStock > 0 ? now : undefined,
      createdAt: now,
      updatedAt: now
    };

    const created = await InventoryRepository.createItem(newItem);

    // Record initial movement if opening stock > 0
    if (newItem.currentStock > 0) {
      InventoryRepository.recordMovement({
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        inventoryItemId: created.id,
        inventoryItemName: created.name,
        type: 'PURCHASE',
        quantity: created.currentStock,
        unit: created.unit,
        supplier: created.supplier,
        cost: created.currentStock * created.unitCost,
        notes: 'Opening Stock Configured',
        createdAt: now,
        createdBy: params.userId
      });
    }

    AuditRepository.record({
      adminId: params.userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'INVENTORY_ITEM_CREATED',
      entity: 'SETTINGS',
      entityId: created.id,
      details: `Created new inventory item "${created.name}" with opening stock ${created.currentStock} ${created.unit}.`
    });

    return created;
  }

  /**
   * Update Inventory Item properties
   */
  public static async updateItem(
    id: string,
    updates: Partial<InventoryItem>,
    userId?: string
  ): Promise<InventoryItem> {
    const existing = await InventoryRepository.getItemById(id);
    if (!existing) {
      throw new Error('Inventory item not found.');
    }

    const updated = await InventoryRepository.updateItem(id, updates);

    AuditRepository.record({
      adminId: userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'INVENTORY_ITEM_UPDATED',
      entity: 'SETTINGS',
      entityId: id,
      details: `Updated inventory item "${updated.name}" settings.`
    });

    return updated;
  }

  /**
   * Replenish / Record Purchase Stock Received
   */
  public static async replenishStock(params: {
    inventoryItemId: string;
    quantityAdded: number;
    supplier?: string;
    totalCost?: number;
    notes?: string;
    reason?: string;
    month?: string;
    type?: 'PURCHASE' | 'ADD_ON_STOCK';
    invoiceNumber?: string;
    date?: string;
    userId?: string;
  }): Promise<InventoryItem> {
    const item = await InventoryRepository.getItemById(params.inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found.');
    }

    if (params.quantityAdded <= 0) {
      throw new Error('Replenish quantity must be greater than zero.');
    }

    const now = params.date ? new Date(`${params.date}T12:00:00.000Z`).toISOString() : new Date().toISOString();
    const movementMonth = params.month || (params.date ? params.date.substring(0, 7) : now.substring(0, 7));
    const newStock = Number((item.currentStock + params.quantityAdded).toFixed(2));
    
    // Update stock level and restocked timestamp
    const updated = await InventoryRepository.updateItem(item.id, {
      currentStock: newStock,
      lastRestockedAt: now,
      supplier: params.supplier?.trim() || item.supplier
    });

    const movementType = params.type || 'PURCHASE';

    // Log Stock Movement
    InventoryRepository.recordMovement({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      type: movementType,
      quantity: params.quantityAdded,
      unit: item.unit,
      supplier: params.supplier?.trim() || item.supplier,
      cost: params.totalCost !== undefined ? params.totalCost : params.quantityAdded * item.unitCost,
      reason: params.reason || (movementType === 'ADD_ON_STOCK' ? 'Mid-Month Add-On Demand' : 'Standard Purchase Restock'),
      month: movementMonth,
      invoiceNumber: params.invoiceNumber,
      notes: params.notes?.trim() || (movementType === 'ADD_ON_STOCK' ? 'Add-On Stock Received' : 'Purchase Stock Received'),
      createdAt: now,
      createdBy: params.userId
    });

    AuditRepository.record({
      adminId: params.userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: movementType === 'ADD_ON_STOCK' ? 'ADD_ON_STOCK_RECORDED' as any : 'STOCK_REPLENISHED',
      entity: 'SETTINGS',
      entityId: item.id,
      details: `${movementType === 'ADD_ON_STOCK' ? 'Added extra add-on stock' : 'Replenished'} +${params.quantityAdded} ${item.unit} for "${item.name}". New Stock: ${newStock} ${item.unit}. Month: ${movementMonth}.`
    });

    return updated;
  }

  /**
   * Add-On Stock (Emergency / Mid-Month Extra Demand Workflow)
   */
  public static async addOnStock(params: {
    inventoryItemId: string;
    quantityAdded: number;
    unitCost?: number;
    totalCost?: number;
    supplier?: string;
    reason?: string;
    month?: string;
    date?: string;
    invoiceNumber?: string;
    notes?: string;
    userId?: string;
  }): Promise<{ item: InventoryItem; movement: StockMovement; monthlyReport: MonthlyReconciliation }> {
    const item = await InventoryRepository.getItemById(params.inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found.');
    }

    if (!params.quantityAdded || params.quantityAdded <= 0) {
      throw new Error('Add-on stock quantity must be greater than zero.');
    }

    const effectiveDate = params.date || new Date().toISOString().split('T')[0];
    const effectiveMonth = params.month || effectiveDate.substring(0, 7);
    const now = new Date(`${effectiveDate}T12:00:00.000Z`).toISOString();
    const newStock = Number((item.currentStock + params.quantityAdded).toFixed(2));
    const effectiveCost = params.totalCost !== undefined 
      ? params.totalCost 
      : (params.unitCost !== undefined ? params.quantityAdded * params.unitCost : params.quantityAdded * item.unitCost);

    // Update stock level and supplier if provided
    const updated = await InventoryRepository.updateItem(item.id, {
      currentStock: newStock,
      lastRestockedAt: now,
      supplier: params.supplier?.trim() || item.supplier,
      unitCost: params.unitCost && params.unitCost > 0 ? params.unitCost : item.unitCost
    });

    // Record dedicated ADD_ON_STOCK movement
    const movement: StockMovement = {
      id: `mov-addon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      type: 'ADD_ON_STOCK',
      quantity: params.quantityAdded,
      unit: item.unit,
      supplier: params.supplier?.trim() || item.supplier,
      cost: Math.round(effectiveCost),
      reason: params.reason?.trim() || 'Mid-Month Extra Stock',
      month: effectiveMonth,
      invoiceNumber: params.invoiceNumber?.trim(),
      notes: params.notes?.trim() || `Add-on stock logged for ${effectiveMonth}`,
      createdAt: now,
      createdBy: params.userId
    };

    await InventoryRepository.recordMovement(movement);

    AuditRepository.record({
      adminId: params.userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'STOCK_REPLENISHED',
      entity: 'SETTINGS',
      entityId: item.id,
      details: `Added ${params.quantityAdded} ${item.unit} add-on stock for "${item.name}" (Reason: ${movement.reason}, Month: ${effectiveMonth}, Cost: ₹${effectiveCost}).`
    });

    const monthlyReport = InventoryRepository.getMonthlyReconciliation(effectiveMonth);

    return { item: updated, movement, monthlyReport };
  }

  /**
   * Record Kitchen Wastage for an Inventory Item
   */
  public static async recordWastage(params: {
    inventoryItemId: string;
    quantity: number;
    reason: string;
    date?: string;
    userId?: string;
  }): Promise<{ item: InventoryItem; movement: StockMovement }> {
    const item = await InventoryRepository.getItemById(params.inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found.');
    }

    if (!params.quantity || params.quantity <= 0) {
      throw new Error('Wastage quantity must be greater than zero.');
    }

    const wastageQty = Number(params.quantity);
    const newStock = Number(Math.max(0, item.currentStock - wastageQty).toFixed(2));
    const now = params.date
      ? (params.date.includes('T') ? params.date : `${params.date}T${new Date().toISOString().split('T')[1]}`)
      : new Date().toISOString();
    const wastageCost = Number((wastageQty * item.unitCost).toFixed(2));

    // Update inventory item stock level
    const updated = await InventoryRepository.updateItem(item.id, {
      currentStock: newStock
    });

    // Record Stock Wastage Movement
    const movement = await InventoryRepository.recordMovement({
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      inventoryItemId: item.id,
      inventoryItemName: item.name,
      type: 'WASTAGE',
      quantity: -wastageQty,
      unit: item.unit,
      cost: wastageCost,
      month: now.substring(0, 7),
      notes: params.reason?.trim() ? `Wastage: ${params.reason.trim()}` : 'Kitchen Wastage Recorded',
      createdAt: now,
      createdBy: params.userId
    });

    // If item fell to or below threshold, create notification
    if (newStock <= item.minThreshold) {
      NotificationRepository.create({
        type: 'LOW_STOCK_ALERT',
        title: `⚠️ Low Stock Alert: ${item.name}`,
        message: `Available stock for "${item.name}" dropped to ${newStock} ${item.unit} after wastage of ${wastageQty} ${item.unit}.`,
        entityId: item.id,
        entityType: 'inventory'
      });
    }

    AuditRepository.record({
      adminId: params.userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'INVENTORY_WASTAGE_RECORDED',
      entity: 'SETTINGS',
      entityId: item.id,
      details: `Recorded wastage of ${wastageQty} ${item.unit} for "${item.name}" (Cost: ₹${wastageCost}, Reason: ${params.reason || 'None'}). New Stock: ${newStock} ${item.unit}.`
    });

    return { item: updated, movement };
  }

  /**
   * Delete an Inventory Item
   */
  public static async deleteItem(id: string, userId?: string): Promise<boolean> {
    const item = await InventoryRepository.getItemById(id);
    if (!item) return false;

    const success = await InventoryRepository.deleteItem(id);
    if (success) {
      AuditRepository.record({
        adminId: userId || 'usr-admin-001',
        adminEmail: 'admin@abchotel.com',
        action: 'INVENTORY_ITEM_DELETED',
        entity: 'SETTINGS',
        entityId: id,
        details: `Deleted inventory item "${item.name}".`
      });
    }
    return success;
  }

  private static restoredOrders = new Set<string>();
  private static processedOrders = new Set<string>();

  /**
   * AUTOMATIC INGREDIENT DEDUCTION ENGINE
   * Verifies stock availability before deduction. Rejects order placement if stock is insufficient.
   * Atomically deducts ingredients in a Firestore Transaction and records durable idempotency markers.
   */
  public static async deductStockForOrder(order: Order): Promise<void> {
    if (!order.items || order.items.length === 0) return;

    const fsDb = getFirestoreDb();
    if (fsDb && (process.env.NODE_ENV === 'production' || process.env.USE_REAL_FIRESTORE === 'true')) {
      await fsDb.runTransaction(async (transaction) => {
        // 1. Durable Idempotency Check in Firestore
        const idempotencyRef = fsDb.collection('inventoryTransactions').doc(order.id);
        const idempotencyDoc = await transaction.get(idempotencyRef);
        if (idempotencyDoc.exists) {
          return; // Already processed idempotently
        }

        // 2. Aggregate required ingredient quantities across all ordered items
        const requiredMap: Map<string, { docRef: FirebaseFirestore.DocumentReference; totalRequired: number; itemName: string; invItemName?: string; unit?: string }> = new Map();

        for (const item of order.items) {
          const recipe = InventoryRepository.getRecipeByMenuItemId(item.menuItemId);
          if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) continue;

          for (const ing of recipe.ingredients) {
            const consumedQty = Number((ing.quantityRequired * item.quantity).toFixed(3));
            const existing = requiredMap.get(ing.inventoryItemId);
            if (existing) {
              existing.totalRequired += consumedQty;
            } else {
              requiredMap.set(ing.inventoryItemId, {
                docRef: fsDb.collection('inventoryItems').doc(ing.inventoryItemId),
                totalRequired: consumedQty,
                itemName: item.name
              });
            }
          }
        }

        if (requiredMap.size === 0) {
          transaction.set(idempotencyRef, { orderId: order.id, processedAt: new Date().toISOString() });
          return;
        }

        // 3. Read all required ingredient documents inside the atomic transaction
        const docSnaps = await Promise.all(
          Array.from(requiredMap.values()).map((entry) => transaction.get(entry.docRef))
        );

        // 4. Validate stock availability (Fail closed before updating anything)
        const updates: Array<{ ref: FirebaseFirestore.DocumentReference; newStock: number; id: string; name: string; unit: InventoryUnit; required: number }> = [];

        for (let i = 0; i < docSnaps.length; i++) {
          const docSnap = docSnaps[i];
          const entry = Array.from(requiredMap.values())[i];
          if (!docSnap.exists) continue;

          const invItem = docSnap.data() as InventoryItem;
          if (invItem.currentStock < entry.totalRequired) {
            throw new Error(
              `Insufficient stock for ingredient "${invItem.name}". Available: ${invItem.currentStock} ${invItem.unit}, required: ${entry.totalRequired} ${invItem.unit} for ${entry.itemName}.`
            );
          }

          const newStock = Number((invItem.currentStock - entry.totalRequired).toFixed(2));
          updates.push({
            ref: entry.docRef,
            newStock,
            id: invItem.id,
            name: invItem.name,
            unit: invItem.unit as InventoryUnit,
            required: entry.totalRequired
          });
        }

        // 5. Apply deductions and record movements atomically
        const now = new Date().toISOString();
        for (const u of updates) {
          transaction.update(u.ref, { currentStock: u.newStock, updatedAt: now });

          const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const movRef = fsDb.collection('stockMovements').doc(movId);
          const movData: StockMovement = {
            id: movId,
            inventoryItemId: u.id,
            inventoryItemName: u.name,
            type: 'AUTO_CONSUMPTION',
            quantity: -u.required,
            unit: u.unit,
            orderId: order.id,
            orderNumber: order.orderNumber,
            month: now.substring(0, 7),
            notes: `Auto-consumed for Order #${order.orderNumber}`,
            createdAt: now
          };
          transaction.set(movRef, movData);
        }

        // 6. Record durable idempotency marker
        transaction.set(idempotencyRef, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          deductedAt: now,
          itemsCount: order.items.length
        });
      });

      // Synchronize in-memory cache
      for (const item of order.items) {
        const recipe = InventoryRepository.getRecipeByMenuItemId(item.menuItemId);
        if (!recipe) continue;
        for (const ing of recipe.ingredients) {
          const inv = InventoryRepository.getItemByIdSync(ing.inventoryItemId);
          if (inv) {
            const consumed = Number((ing.quantityRequired * item.quantity).toFixed(3));
            inv.currentStock = Number((inv.currentStock - consumed).toFixed(2));
            db.inventoryItems.set(inv.id, inv);
          }
        }
      }
      return;
    }

    // Fallback in-memory atomic deduction for unit tests / standalone local mode
    if (this.processedOrders.has(order.id)) return;

    const requiredIngredients: Map<string, { invItem: InventoryItem; totalRequired: number; itemName: string }> = new Map();

    for (const item of order.items) {
      const recipe = InventoryRepository.getRecipeByMenuItemId(item.menuItemId);
      if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) continue;

      for (const ing of recipe.ingredients) {
        const invItem = InventoryRepository.getItemByIdSync(ing.inventoryItemId);
        if (!invItem) continue;

        const consumedQty = Number((ing.quantityRequired * item.quantity).toFixed(3));
        const existing = requiredIngredients.get(invItem.id);
        if (existing) {
          existing.totalRequired += consumedQty;
        } else {
          requiredIngredients.set(invItem.id, {
            invItem,
            totalRequired: consumedQty,
            itemName: item.name
          });
        }
      }
    }

    for (const [_, entry] of requiredIngredients) {
      if (entry.invItem.currentStock < entry.totalRequired) {
        throw new Error(
          `Insufficient stock for ingredient "${entry.invItem.name}". Available: ${entry.invItem.currentStock} ${entry.invItem.unit}, required: ${entry.totalRequired} ${entry.invItem.unit} for ${entry.itemName}.`
        );
      }
    }

    const now = new Date().toISOString();
    for (const [_, entry] of requiredIngredients) {
      const newStock = Number((entry.invItem.currentStock - entry.totalRequired).toFixed(2));

      InventoryRepository.updateItem(entry.invItem.id, {
        currentStock: newStock
      });

      InventoryRepository.recordMovement({
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        inventoryItemId: entry.invItem.id,
        inventoryItemName: entry.invItem.name,
        type: 'AUTO_CONSUMPTION',
        quantity: -entry.totalRequired,
        unit: entry.invItem.unit,
        orderId: order.id,
        orderNumber: order.orderNumber,
        month: now.substring(0, 7),
        notes: `Auto-consumed for Order #${order.orderNumber} (${entry.itemName})`,
        createdAt: now
      });

      if (newStock <= entry.invItem.minThreshold) {
        NotificationRepository.create({
          type: 'LOW_STOCK_ALERT',
          title: `⚠️ Low Stock Alert: ${entry.invItem.name}`,
          message: `Available stock for "${entry.invItem.name}" dropped to ${newStock} ${entry.invItem.unit} (At or below threshold of ${entry.invItem.minThreshold} ${entry.invItem.unit}). Please replenish stock.`,
          entityId: entry.invItem.id,
          entityType: 'inventory'
        });
      }
    }

    this.processedOrders.add(order.id);
  }

  /**
   * Idempotent Stock Restoration for Cancelled Orders
   * Restores inventory exactly once via Firestore transaction if an order was cancelled after deduction.
   */
  public static async restoreStockForOrder(orderId: string): Promise<boolean> {
    if (!orderId) return false;

    const fsDb = getFirestoreDb();
    if (fsDb && (process.env.NODE_ENV === 'production' || process.env.USE_REAL_FIRESTORE === 'true')) {
      return await fsDb.runTransaction(async (transaction) => {
        const restoreRef = fsDb.collection('inventoryRestorations').doc(orderId);
        const restoreDoc = await transaction.get(restoreRef);
        if (restoreDoc.exists) {
          return false; // Already restored idempotently
        }

        const dedRef = fsDb.collection('inventoryTransactions').doc(orderId);
        const dedDoc = await transaction.get(dedRef);
        if (!dedDoc.exists) {
          return false; // Was never deducted
        }

        const movQuery = await fsDb.collection('stockMovements')
          .where('orderId', '==', orderId)
          .where('type', '==', 'AUTO_CONSUMPTION')
          .get();

        const now = new Date().toISOString();
        for (const doc of movQuery.docs) {
          const mov = doc.data() as StockMovement;
          const invRef = fsDb.collection('inventoryItems').doc(mov.inventoryItemId);
          const invDoc = await transaction.get(invRef);
          if (invDoc.exists) {
            const currentStock = (invDoc.data() as InventoryItem).currentStock;
            const restoredStock = Number((currentStock + Math.abs(mov.quantity)).toFixed(2));
            transaction.update(invRef, { currentStock: restoredStock, updatedAt: now });
          }
        }

        transaction.set(restoreRef, { orderId, restoredAt: now });
        return true;
      });
    }

    // In-memory fallback
    if (this.restoredOrders.has(orderId)) {
      return false;
    }

    const movements = InventoryRepository.getMovements(5000).filter(
      (m: StockMovement) => m.orderId === orderId && m.type === 'AUTO_CONSUMPTION'
    );

    if (movements.length === 0) {
      return false;
    }

    const now = new Date().toISOString();
    for (const m of movements) {
      const invItem = InventoryRepository.getItemByIdSync(m.inventoryItemId);
      if (!invItem) continue;

      const restoredQty = Math.abs(m.quantity);
      const newStock = Number((invItem.currentStock + restoredQty).toFixed(2));

      InventoryRepository.updateItem(invItem.id, {
        currentStock: newStock
      });

      InventoryRepository.recordMovement({
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        inventoryItemId: invItem.id,
        inventoryItemName: invItem.name,
        type: 'PURCHASE',
        quantity: restoredQty,
        unit: invItem.unit,
        orderId,
        month: now.substring(0, 7),
        notes: `Stock restored from cancelled Order ${m.orderNumber || orderId}`,
        createdAt: now
      });
    }

    this.restoredOrders.add(orderId);
    return true;
  }

  /**
   * Auto-deduct inventory stock for add-on items added to an existing order
   */
  public static async deductStockForOrderItems(items: OrderItem[], orderId: string, orderNumber: string): Promise<void> {
    if (!items || items.length === 0) return;

    for (const item of items) {
      const recipe = InventoryRepository.getRecipeByMenuItemId(item.menuItemId);
      if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
        continue;
      }

      for (const ing of recipe.ingredients) {
        const invItem = await InventoryRepository.getItemById(ing.inventoryItemId);
        if (!invItem) continue;

        const consumedQty = Number((ing.quantityRequired * item.quantity).toFixed(3));
        const newStock = Number(Math.max(0, invItem.currentStock - consumedQty).toFixed(2));

        // Update inventory item stock
        await InventoryRepository.updateItem(invItem.id, {
          currentStock: newStock
        });

        // Record Auto-Consumption Movement
        const now = new Date().toISOString();
        await InventoryRepository.recordMovement({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          inventoryItemId: invItem.id,
          inventoryItemName: invItem.name,
          type: 'AUTO_CONSUMPTION',
          quantity: -consumedQty,
          unit: invItem.unit,
          orderId,
          orderNumber,
          month: now.substring(0, 7),
          notes: `Auto-consumed for Add-on ${item.quantity}x ${item.name}`,
          createdAt: now
        });

        if (newStock <= invItem.minThreshold) {
          NotificationRepository.create({
            type: 'LOW_STOCK_ALERT',
            title: `⚠️ Low Stock Alert: ${invItem.name}`,
            message: `Available stock for "${invItem.name}" is ${newStock} ${invItem.unit} (At or below threshold of ${invItem.minThreshold} ${invItem.unit}). Please replenish stock.`,
            entityId: invItem.id,
            entityType: 'inventory'
          });
        }
      }
    }
  }

  // --- Recipe Mappings ---
  public static getRecipes() {
    const recipes = InventoryRepository.getAllRecipes();
    // Populate menuItemName and ingredient details
    return recipes.map((r) => {
      const menuItem = MenuRepository.getItemByIdSync(r.menuItemId);
      const ingredientsWithNames = r.ingredients.map((ing) => {
        const inv = InventoryRepository.getItemByIdSync(ing.inventoryItemId);
        return {
          ...ing,
          inventoryItemName: inv?.name || ing.inventoryItemName || 'Unknown Ingredient',
          unit: inv?.unit || ing.unit || 'kg'
        };
      });

      return {
        ...r,
        menuItemName: menuItem?.name || r.menuItemName || 'Menu Dish',
        ingredients: ingredientsWithNames
      };
    });
  }

  public static getRecipeByMenuItemId(menuItemId: string) {
    const r = InventoryRepository.getRecipeByMenuItemId(menuItemId);
    if (!r) return undefined;
    const menuItem = MenuRepository.getItemByIdSync(menuItemId);
    return {
      ...r,
      menuItemName: menuItem?.name || r.menuItemName,
      ingredients: r.ingredients.map((ing) => {
        const inv = InventoryRepository.getItemByIdSync(ing.inventoryItemId);
        return {
          ...ing,
          inventoryItemName: inv?.name || ing.inventoryItemName,
          unit: inv?.unit || ing.unit
        };
      })
    };
  }

  public static async saveRecipe(params: {
    menuItemId: string;
    ingredients: Array<{ inventoryItemId: string; quantityRequired: number }>;
    userId?: string;
  }): Promise<MenuItemRecipe> {
    const menuItem = await MenuRepository.getItemById(params.menuItemId);
    if (!menuItem) {
      throw new Error('Menu item not found.');
    }

    const ingredientsWithDetails = await Promise.all(params.ingredients.map(async (ing) => {
      const inv = await InventoryRepository.getItemById(ing.inventoryItemId);
      return {
        inventoryItemId: ing.inventoryItemId,
        inventoryItemName: inv?.name || 'Ingredient',
        unit: (inv?.unit || 'kg') as InventoryUnit,
        quantityRequired: Number(ing.quantityRequired) || 0
      };
    }));

    const recipe: MenuItemRecipe = {
      menuItemId: params.menuItemId,
      menuItemName: menuItem.name,
      ingredients: ingredientsWithDetails,
      updatedAt: new Date().toISOString()
    };

    const saved = await InventoryRepository.saveRecipe(recipe);

    AuditRepository.record({
      adminId: params.userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'RECIPE_CONFIGURED',
      entity: 'MENU_ITEM',
      entityId: params.menuItemId,
      details: `Configured ingredient recipe for "${menuItem.name}" with ${ingredientsWithDetails.length} raw material(s).`
    });

    return saved;
  }

  // --- Movements & Stats ---
  public static getMovements(limit?: number) {
    return InventoryRepository.getMovements(limit);
  }

  public static getStats() {
    return InventoryRepository.getStats();
  }

  // --- Daily Reconciliations ---
  public static getDailyLogs(date: string) {
    return InventoryRepository.getDailyLogs(date);
  }

  public static reconcileDailyItem(params: {
    date: string;
    inventoryItemId: string;
    physicalStock: number;
    notes?: string;
    userId?: string;
  }) {
    const log = InventoryRepository.reconcileDailyItem(
      params.date,
      params.inventoryItemId,
      params.physicalStock,
      params.notes,
      params.userId
    );

    AuditRepository.record({
      adminId: params.userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'DAILY_STOCK_RECONCILED',
      entity: 'SETTINGS',
      entityId: params.inventoryItemId,
      details: `Reconciled daily stock on ${params.date} for "${log.inventoryItemName}". Physical count: ${params.physicalStock} ${log.unit}, Variance: ${log.variance} ${log.unit}.`
    });

    return log;
  }

  // --- Monthly Reconciliations ---
  public static getMonthlyReconciliation(month: string) {
    return InventoryRepository.getMonthlyReconciliation(month);
  }

  public static closeMonthlyReconciliation(month: string, userId?: string) {
    const rec = InventoryRepository.closeMonthlyReconciliation(month, userId);

    AuditRepository.record({
      adminId: userId || 'usr-admin-001',
      adminEmail: 'admin@abchotel.com',
      action: 'MONTHLY_INVENTORY_CLOSED',
      entity: 'SETTINGS',
      entityId: rec.id,
      details: `Closed monthly stock reconciliation for ${month}. Opening Valuation: ₹${rec.totalOpeningValuation}, Purchases: ₹${rec.totalPurchases}, Consumption: ₹${rec.totalConsumption}, Wastage: ₹${rec.totalWastage}, Closing Valuation: ₹${rec.totalClosingValuation}.`
    });

    return rec;
  }
}
