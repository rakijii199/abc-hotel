/**
 * Express API Routes for Inventory & Stock Management Engine
 */
import { Router } from 'express';
import { InventoryService } from '../services/inventoryService.ts';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.ts';

const router = Router();

// Require Staff / Manager / Admin role for inventory operations
router.use(authenticateToken);
router.use(requireRole('ADMIN', 'MANAGER', 'STAFF', 'KITCHEN'));

/**
 * GET /api/inventory/items
 * List all raw material inventory items with optional search & category filtering
 */
router.get('/items', (req, res) => {
  try {
    const { category, search, month } = req.query;
    const items = InventoryService.getAllItems(
      category as string | undefined,
      search as string | undefined,
      month as string | undefined
    );
    res.json({
      success: true,
      data: items
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'INVENTORY_ERROR', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/items
 * Create a new inventory item with opening stock and reorder threshold
 */
router.post('/items', async (req, res) => {
  try {
    const user = (req as any).user;
    const item = await InventoryService.createItem({
      ...req.body,
      userId: user?.id
    });
    res.status(201).json({
      success: true,
      data: item,
      message: `Inventory item "${item.name}" created successfully.`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_ITEM_FAILED', message: err.message }
    });
  }
});

/**
 * PUT /api/inventory/items/:id
 * Update inventory item details, threshold, or unit cost
 */
router.put('/items/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const item = await InventoryService.updateItem(req.params.id, req.body, user?.id);
    res.json({
      success: true,
      data: item,
      message: `Inventory item "${item.name}" updated.`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'UPDATE_ITEM_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/items/:id/replenish
 * Replenish / Record Purchase Stock Received
 */
router.post('/items/:id/replenish', async (req, res) => {
  try {
    const user = (req as any).user;
    const { quantityAdded, supplier, totalCost, notes, date, reason, month, type, invoiceNumber } = req.body;
    const updated = await InventoryService.replenishStock({
      inventoryItemId: req.params.id,
      quantityAdded: Number(quantityAdded),
      supplier,
      totalCost: totalCost ? Number(totalCost) : undefined,
      notes,
      reason,
      month,
      type,
      invoiceNumber,
      date,
      userId: user?.id
    });
    res.json({
      success: true,
      data: updated,
      message: `Replenished +${quantityAdded} ${updated.unit} for "${updated.name}". New Stock: ${updated.currentStock} ${updated.unit}.`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'REPLENISH_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/add-on-stock
 * Record Add-On Stock (Emergency / Mid-Month Extra Demand Workflow)
 */
router.post('/add-on-stock', async (req, res) => {
  try {
    const user = (req as any).user;
    const { inventoryItemId, quantityAdded, unitCost, totalCost, supplier, reason, month, date, invoiceNumber, notes } = req.body;
    
    if (!inventoryItemId) {
      throw new Error('Inventory item ID is required.');
    }
    if (!quantityAdded || Number(quantityAdded) <= 0) {
      throw new Error('Valid add-on stock quantity is required.');
    }

    const result = await InventoryService.addOnStock({
      inventoryItemId,
      quantityAdded: Number(quantityAdded),
      unitCost: unitCost !== undefined ? Number(unitCost) : undefined,
      totalCost: totalCost !== undefined ? Number(totalCost) : undefined,
      supplier,
      reason,
      month,
      date,
      invoiceNumber,
      notes,
      userId: user?.id
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `✓ Added +${quantityAdded} ${result.item.unit} add-on stock for "${result.item.name}" (Rolled into ${result.movement.month || 'monthly'} calculations).`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'ADD_ON_STOCK_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/wastage
 * Record Kitchen / Raw Material Wastage
 */
router.post('/wastage', async (req, res) => {
  try {
    const user = (req as any).user;
    const { inventoryItemId, quantity, reason, date } = req.body;
    if (!inventoryItemId) {
      throw new Error('Inventory item ID is required.');
    }
    if (!quantity || Number(quantity) <= 0) {
      throw new Error('Valid wastage quantity is required.');
    }
    const result = await InventoryService.recordWastage({
      inventoryItemId,
      quantity: Number(quantity),
      reason: reason || 'Kitchen Wastage',
      date,
      userId: user?.id
    });
    res.status(201).json({
      success: true,
      data: result,
      message: `✓ Recorded wastage of ${quantity} ${result.item.unit} for "${result.item.name}".`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'RECORD_WASTAGE_FAILED', message: err.message }
    });
  }
});

/**
 * DELETE /api/inventory/items/:id
 * Delete an inventory item (Strictly ADMIN only - STAFF and KITCHEN forbidden)
 */
router.delete('/items/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const user = (req as any).user;
    const deleted = await InventoryService.deleteItem(req.params.id, user?.id);
    res.json({
      success: true,
      data: { deleted }
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_ITEM_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/inventory/recipes
 * Get all menu item ingredient recipes
 */
router.get('/recipes', (_req, res) => {
  try {
    const recipes = InventoryService.getRecipes();
    res.json({
      success: true,
      data: recipes
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'RECIPES_ERROR', message: err.message }
    });
  }
});

/**
 * GET /api/inventory/recipes/:menuItemId
 * Get ingredient recipe for a specific menu item
 */
router.get('/recipes/:menuItemId', (req, res) => {
  try {
    const recipe = InventoryService.getRecipeByMenuItemId(req.params.menuItemId);
    res.json({
      success: true,
      data: recipe || null
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'RECIPE_FETCH_FAILED', message: err.message }
    });
  }
});

/**
 * PUT /api/inventory/recipes/:menuItemId
 * Save / Update ingredient recipe mapping for a menu item
 */
router.put('/recipes/:menuItemId', (req, res) => {
  try {
    const user = (req as any).user;
    const { ingredients } = req.body;
    const recipe = InventoryService.saveRecipe({
      menuItemId: req.params.menuItemId,
      ingredients,
      userId: user?.id
    });
    res.json({
      success: true,
      data: recipe,
      message: 'Menu dish ingredient recipe saved.'
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'RECIPE_SAVE_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/inventory/movements
 * Get audit trail of stock purchases & auto-deduction movements
 */
router.get('/movements', (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 2000;
    const movements = InventoryService.getMovements(limit);
    res.json({
      success: true,
      data: movements
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'MOVEMENTS_ERROR', message: err.message }
    });
  }
});

/**
 * GET /api/inventory/stats
 * Summary metrics: valuation, low stock alerts count, out of stock
 */
router.get('/stats', (_req, res) => {
  try {
    const stats = InventoryService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'STATS_ERROR', message: err.message }
    });
  }
});

/**
 * GET /api/inventory/daily
 * Get list of DailyStockLog entries for a specific date (YYYY-MM-DD)
 */
router.get('/daily', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      throw new Error('Query parameter "date" (YYYY-MM-DD) is required.');
    }
    const logs = InventoryService.getDailyLogs(date as string);
    res.json({
      success: true,
      data: logs
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'DAILY_LOGS_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/daily/reconcile
 * Reconcile / submit closing physical count for a single raw material
 */
router.post('/daily/reconcile', (req, res) => {
  try {
    const user = (req as any).user;
    const { date, inventoryItemId, physicalStock, notes } = req.body;
    if (!date || !inventoryItemId || physicalStock === undefined) {
      throw new Error('Date, inventoryItemId, and physicalStock are required.');
    }
    const log = InventoryService.reconcileDailyItem({
      date,
      inventoryItemId,
      physicalStock: Number(physicalStock),
      notes,
      userId: user?.id
    });
    res.json({
      success: true,
      data: log,
      message: `✓ Daily reconciliation submitted for "${log.inventoryItemName}".`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'DAILY_RECONCILE_FAILED', message: err.message }
    });
  }
});

/**
 * GET /api/inventory/monthly
 * Get MonthlyReconciliation metrics for a specific month (YYYY-MM)
 */
router.get('/monthly', (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      throw new Error('Query parameter "month" (YYYY-MM) is required.');
    }
    const report = InventoryService.getMonthlyReconciliation(month as string);
    res.json({
      success: true,
      data: report
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'MONTHLY_REPORT_FAILED', message: err.message }
    });
  }
});

/**
 * POST /api/inventory/monthly/close
 * Close / lock inventory reconciliation cycle for a specific month
 */
router.post('/monthly/close', (req, res) => {
  try {
    const user = (req as any).user;
    const { month } = req.body;
    if (!month) {
      throw new Error('Month parameter (YYYY-MM) is required.');
    }
    const report = InventoryService.closeMonthlyReconciliation(month, user?.id);
    res.json({
      success: true,
      data: report,
      message: `✓ Inventory reconciliation cycle closed/locked for ${month}.`
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'MONTHLY_CLOSE_FAILED', message: err.message }
    });
  }
});

export default router;
