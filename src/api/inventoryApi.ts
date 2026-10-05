/**
 * Frontend Inventory API Client
 */
import { request } from './client.ts';
import {
  InventoryItem,
  MenuItemRecipe,
  StockMovement,
  InventoryStats,
  InventoryCategory,
  InventoryUnit,
  DailyStockLog,
  MonthlyReconciliation
} from '../types/index.ts';

export const InventoryApi = {
  /**
   * Get all raw material inventory items
   */
  getItems: (category?: string, search?: string, month?: string): Promise<InventoryItem[]> => {
    const params = new URLSearchParams();
    if (category && category !== 'ALL') params.append('category', category);
    if (search?.trim()) params.append('search', search.trim());
    if (month?.trim()) params.append('month', month.trim());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<InventoryItem[]>(`/inventory/items${query}`);
  },

  /**
   * Create a new inventory item
   */
  createItem: (payload: {
    name: string;
    category: InventoryCategory;
    openingStock: number;
    unit: InventoryUnit;
    minThreshold: number;
    unitCost: number;
    supplier?: string;
  }): Promise<InventoryItem> =>
    request<InventoryItem>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  /**
   * Update an existing inventory item
   */
  updateItem: (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> =>
    request<InventoryItem>(`/inventory/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),

  /**
   * Replenish / Add-On Purchase Stock Received
   */
  replenishStock: (
    id: string,
    payload: {
      quantityAdded: number;
      supplier?: string;
      totalCost?: number;
      notes?: string;
      reason?: string;
      month?: string;
      type?: 'PURCHASE' | 'ADD_ON_STOCK';
      invoiceNumber?: string;
      date?: string;
    }
  ): Promise<InventoryItem> =>
    request<InventoryItem>(`/inventory/items/${id}/replenish`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  /**
   * Record Add-On Stock (Emergency / Mid-Month Extra Demand Workflow)
   */
  addOnStock: (payload: {
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
  }): Promise<{ item: InventoryItem; movement: StockMovement; monthlyReport: MonthlyReconciliation }> =>
    request<{ item: InventoryItem; movement: StockMovement; monthlyReport: MonthlyReconciliation }>('/inventory/add-on-stock', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  /**
   * Record Kitchen / Ingredient Wastage
   */
  recordWastage: (payload: {
    inventoryItemId: string;
    quantity: number;
    reason: string;
    date?: string;
  }): Promise<{ item: InventoryItem; movement: StockMovement }> =>
    request<{ item: InventoryItem; movement: StockMovement }>('/inventory/wastage', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  /**
   * Delete an inventory item
   */
  deleteItem: (id: string): Promise<{ deleted: boolean }> =>
    request<{ deleted: boolean }>(`/inventory/items/${id}`, {
      method: 'DELETE'
    }),

  /**
   * Get all menu dish recipes
   */
  getRecipes: (): Promise<MenuItemRecipe[]> =>
    request<MenuItemRecipe[]>('/inventory/recipes'),

  /**
   * Get recipe for a specific menu item
   */
  getRecipeByMenuItemId: (menuItemId: string): Promise<MenuItemRecipe | null> =>
    request<MenuItemRecipe | null>(`/inventory/recipes/${menuItemId}`),

  /**
   * Save ingredient recipe mapping for a menu item
   */
  saveRecipe: (
    menuItemId: string,
    ingredients: Array<{ inventoryItemId: string; quantityRequired: number }>
  ): Promise<MenuItemRecipe> =>
    request<MenuItemRecipe>(`/inventory/recipes/${menuItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ ingredients })
    }),

  /**
   * Get audit log of stock movements (purchases & auto-deductions)
   */
  getMovements: (limit = 2000): Promise<StockMovement[]> =>
    request<StockMovement[]>(`/inventory/movements?limit=${limit}`),

  /**
   * Get inventory summary metrics & stats
   */
  getStats: (): Promise<InventoryStats> =>
    request<InventoryStats>('/inventory/stats'),

  /**
   * Get daily stock reconciliation logs
   */
  getDailyLogs: (date: string): Promise<DailyStockLog[]> =>
    request<DailyStockLog[]>(`/inventory/daily?date=${encodeURIComponent(date)}`),

  /**
   * Submit physical stock reconciliation count for an ingredient on a date
   */
  reconcileDailyItem: (payload: {
    date: string;
    inventoryItemId: string;
    physicalStock: number;
    notes?: string;
  }): Promise<DailyStockLog> =>
    request<DailyStockLog>('/inventory/daily/reconcile', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  /**
   * Get monthly reconciliation metrics & status
   */
  getMonthlyReconciliation: (month: string): Promise<MonthlyReconciliation> =>
    request<MonthlyReconciliation>(`/inventory/monthly?month=${encodeURIComponent(month)}`),

  /**
   * Close and lock monthly inventory reconciliation cycle
   */
  closeMonthlyReconciliation: (month: string): Promise<MonthlyReconciliation> =>
    request<MonthlyReconciliation>('/inventory/monthly/close', {
      method: 'POST',
      body: JSON.stringify({ month })
    })
};
