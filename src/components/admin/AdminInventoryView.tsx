/**
 * Admin & Manager Inventory Management Component
 * Features:
 * 1. Raw Materials Stock & Reorder Thresholds
 * 2. Automated Ingredient Auto-Deduction Engine on Order Placement/Preparation
 * 3. Low Stock Alert Banners & Notifications
 * 4. Purchase Stock Received / Replenishments
 * 5. Menu Dish Recipe Portion Mappings
 * 6. Real-Time Stock Movement Audit Log
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Warehouse,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Boxes,
  ChefHat,
  History,
  Edit2,
  Trash2,
  PackagePlus,
  FileText,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  FileCheck,
  Lock,
  Unlock,
  Eye,
  MoreVertical,
  MoreHorizontal,
  RotateCcw
} from 'lucide-react';
import {
  InventoryItem,
  MenuItemRecipe,
  StockMovement,
  InventoryStats,
  InventoryCategory,
  InventoryUnit,
  MenuItem,
  DailyStockLog,
  MonthlyReconciliation
} from '../../types/index.ts';
import { InventoryApi, AdminApi } from '../../api/index.ts';
import { formatCurrency, formatDate } from '../../utils/formatters.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Modal } from '../common/Footer.tsx';

export const AdminInventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'RECIPES' | 'DAILY' | 'MONTHLY' | 'WASTAGE'>('ITEMS');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<MenuItemRecipe[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Workflow View States
  const [overviewMonth, setOverviewMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [flowScope, setFlowScope] = useState<'ALL' | 'MONTH'>('ALL');
  const [utilizationDate, setUtilizationDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Daily Workflows State
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyLogs, setDailyLogs] = useState<DailyStockLog[]>([]);
  const [loadingDaily, setLoadingDaily] = useState<boolean>(false);
  const [reconcilingLog, setReconcilingLog] = useState<DailyStockLog | null>(null);
  const [reconcileCount, setReconcileCount] = useState<number>(0);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [submittingReconcile, setSubmittingReconcile] = useState<boolean>(false);

  // Monthly Workflows State
  const [monthlyMonth, setMonthlyMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReconciliation | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState<boolean>(false);
  const [submittingMonthlyClose, setSubmittingMonthlyClose] = useState<boolean>(false);

  // Filters State
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals State
  const [createItemModalOpen, setCreateItemModalOpen] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<InventoryCategory>('Dairy');
  const [newItemOpeningStock, setNewItemOpeningStock] = useState<number>(10);
  const [newItemUnit, setNewItemUnit] = useState<InventoryUnit>('kg');
  const [newItemMinThreshold, setNewItemMinThreshold] = useState<number>(3);
  const [newItemUnitCost, setNewItemUnitCost] = useState<number>(100);
  const [newItemSupplier, setNewItemSupplier] = useState<string>('');
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false);

  // Replenish / Purchase Modal State
  const [replenishItem, setReplenishItem] = useState<InventoryItem | null>(null);
  const [replenishQty, setReplenishQty] = useState<number>(10);
  const [replenishSupplier, setReplenishSupplier] = useState<string>('');
  const [replenishTotalCost, setReplenishTotalCost] = useState<number>(0);
  const [replenishNotes, setReplenishNotes] = useState<string>('');
  const [submittingReplenish, setSubmittingReplenish] = useState<boolean>(false);

  // Edit Item Modal State
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editMinThreshold, setEditMinThreshold] = useState<number>(5);
  const [editUnitCost, setEditUnitCost] = useState<number>(100);
  const [editSupplier, setEditSupplier] = useState<string>('');
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);

  // Add-On Stock Modal State
  const [addOnModalOpen, setAddOnModalOpen] = useState<boolean>(false);
  const [selectedAddOnItemId, setSelectedAddOnItemId] = useState<string>('');
  const [addOnQty, setAddOnQty] = useState<number>(10);
  const [addOnUnitCost, setAddOnUnitCost] = useState<number>(100);
  const [addOnTotalCost, setAddOnTotalCost] = useState<number>(1000);
  const [addOnReason, setAddOnReason] = useState<string>('Mid-Month Surge Demand');
  const [customAddOnReason, setCustomAddOnReason] = useState<string>('');
  const [addOnMonth, setAddOnMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [addOnDate, setAddOnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [addOnSupplier, setAddOnSupplier] = useState<string>('');
  const [addOnInvoice, setAddOnInvoice] = useState<string>('');
  const [addOnNotes, setAddOnNotes] = useState<string>('');
  const [submittingAddOn, setSubmittingAddOn] = useState<boolean>(false);

  const handleOpenAddOnModal = (itemOrId?: InventoryItem | string) => {
    let targetItem: InventoryItem | undefined;
    if (typeof itemOrId === 'object' && itemOrId) {
      targetItem = itemOrId;
      setSelectedAddOnItemId(itemOrId.id);
    } else if (typeof itemOrId === 'string' && itemOrId) {
      targetItem = items.find((i) => i.id === itemOrId);
      setSelectedAddOnItemId(itemOrId);
    } else if (items.length > 0) {
      targetItem = items[0];
      setSelectedAddOnItemId(items[0].id);
    }

    if (targetItem) {
      setAddOnQty(10);
      setAddOnUnitCost(targetItem.unitCost);
      setAddOnTotalCost(Math.round(10 * targetItem.unitCost));
      setAddOnSupplier(targetItem.supplier || '');
    } else {
      setAddOnQty(10);
      setAddOnUnitCost(100);
      setAddOnTotalCost(1000);
      setAddOnSupplier('');
    }
    setAddOnReason('Mid-Month Surge Demand');
    setCustomAddOnReason('');
    setAddOnMonth(activeTab === 'MONTHLY' ? monthlyMonth : overviewMonth);
    setAddOnDate(new Date().toISOString().split('T')[0]);
    setAddOnInvoice('');
    setAddOnNotes('');
    setAddOnModalOpen(true);
  };

  const handleSubmitAddOnStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddOnItemId) {
      error('Please select an ingredient.');
      return;
    }
    const item = items.find((i) => i.id === selectedAddOnItemId);
    if (!item) {
      error('Selected inventory item not found.');
      return;
    }
    if (addOnQty <= 0) {
      error('Please enter a valid add-on quantity greater than zero.');
      return;
    }

    const finalReason =
      addOnReason === 'Other' ? customAddOnReason.trim() || 'Additional Demand' : addOnReason;

    setSubmittingAddOn(true);
    try {
      await InventoryApi.addOnStock({
        inventoryItemId: item.id,
        quantityAdded: Number(addOnQty),
        unitCost: Number(addOnUnitCost),
        totalCost: Number(addOnTotalCost),
        supplier: addOnSupplier.trim() || item.supplier,
        reason: finalReason,
        month: addOnMonth,
        date: addOnDate,
        invoiceNumber: addOnInvoice.trim() || undefined,
        notes: addOnNotes.trim() || undefined
      });

      success(
        `✓ Add-on stock recorded! Added +${addOnQty} ${item.unit} for "${item.name}" (Rolled into ${addOnMonth} calculation).`
      );
      setAddOnModalOpen(false);

      await loadAllInventoryData();
      if (activeTab === 'MONTHLY') {
        loadMonthlyReport(monthlyMonth);
      } else if (activeTab === 'DAILY') {
        loadDailyLogs(dailyDate);
      }
    } catch (err: any) {
      error(err.message || 'Failed to record add-on stock.');
    } finally {
      setSubmittingAddOn(false);
    }
  };

  // View Item Modal State
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);

  // Wastage Modal State
  const [wastageModalOpen, setWastageModalOpen] = useState<boolean>(false);
  const [selectedWastageItemId, setSelectedWastageItemId] = useState<string>('');
  const [wastageQty, setWastageQty] = useState<number>(1);
  const [wastageReason, setWastageReason] = useState<string>('Spoilage / Expiry');
  const [customWastageReason, setCustomWastageReason] = useState<string>('');
  const [wastageDate, setWastageDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submittingWastage, setSubmittingWastage] = useState<boolean>(false);

  // Table Row Action Dropdown Menu State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setOpenActionMenuId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Recipe Modal State
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ inventoryItemId: string; quantityRequired: number }>
  >([]);
  const [submittingRecipe, setSubmittingRecipe] = useState<boolean>(false);

  const handleOpenWastageModal = (preselectedItemId?: string) => {
    if (preselectedItemId) {
      setSelectedWastageItemId(preselectedItemId);
    } else if (items.length > 0) {
      setSelectedWastageItemId(items[0].id);
    }
    setWastageQty(1);
    setWastageReason('Spoilage / Expiry');
    setCustomWastageReason('');
    setWastageDate(utilizationDate || new Date().toISOString().split('T')[0]);
    setWastageModalOpen(true);
  };

  const handleRecordWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWastageItemId) {
      error('Please select a raw material ingredient.');
      return;
    }
    const item = items.find((i) => i.id === selectedWastageItemId);
    if (!item) {
      error('Selected inventory item not found.');
      return;
    }
    if (wastageQty <= 0) {
      error('Please enter a valid wastage quantity greater than zero.');
      return;
    }

    const finalReason =
      wastageReason === 'Other'
        ? customWastageReason.trim() || 'Other Kitchen Wastage'
        : wastageReason;

    setSubmittingWastage(true);
    try {
      await InventoryApi.recordWastage({
        inventoryItemId: item.id,
        quantity: Number(wastageQty),
        reason: finalReason,
        date: wastageDate
      });

      const costLost = Math.round(Number(wastageQty) * item.unitCost);
      success(`✓ Wastage recorded! Deducted ${wastageQty} ${item.unit} for "${item.name}" (Est. Loss: ${formatCurrency(costLost)}).`);
      setWastageModalOpen(false);

      // Refresh all inventory datasets to automatically update monthly summaries & movements
      await loadAllInventoryData();
      if (activeTab === 'MONTHLY') {
        loadMonthlyReport(monthlyMonth);
      } else if (activeTab === 'DAILY') {
        loadDailyLogs(dailyDate);
      }
    } catch (err: any) {
      error(err.message || 'Failed to record wastage.');
    } finally {
      setSubmittingWastage(false);
    }
  };

  const { success, error } = useToast();

  const loadAllInventoryData = async () => {
    setLoading(true);
    try {
      const [itemsRes, recipesRes, movementsRes, statsRes, menuRes] = await Promise.allSettled([
        InventoryApi.getItems(),
        InventoryApi.getRecipes(),
        InventoryApi.getMovements(),
        InventoryApi.getStats(),
        AdminApi.getMenuItems()
      ]);

      if (itemsRes.status === 'fulfilled') {
        setItems(itemsRes.value || []);
      }
      if (recipesRes.status === 'fulfilled') {
        setRecipes(recipesRes.value || []);
      }
      if (movementsRes.status === 'fulfilled') {
        setMovements(movementsRes.value || []);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value || null);
      }
      if (menuRes.status === 'fulfilled') {
        setMenuItems(menuRes.value || []);
      }

      // If items themselves failed, show error toast
      if (itemsRes.status === 'rejected') {
        error(itemsRes.reason?.message || 'Failed to load raw materials. Please refresh.');
      }
    } catch (err: any) {
      error(err.message || 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllInventoryData();
  }, []);

  const loadDailyLogs = async (dateStr: string) => {
    setLoadingDaily(true);
    try {
      const logs = await InventoryApi.getDailyLogs(dateStr);
      setDailyLogs(logs || []);
    } catch (err: any) {
      error(err.message || 'Failed to load daily stock logs.');
    } finally {
      setLoadingDaily(false);
    }
  };

  const loadMonthlyReport = async (monthStr: string) => {
    setLoadingMonthly(true);
    try {
      const report = await InventoryApi.getMonthlyReconciliation(monthStr);
      setMonthlyReport(report || null);
    } catch (err: any) {
      error(err.message || 'Failed to load monthly reconciliation report.');
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DAILY') {
      loadDailyLogs(dailyDate);
    } else if (activeTab === 'MONTHLY') {
      loadMonthlyReport(monthlyMonth);
    }
  }, [activeTab, dailyDate, monthlyMonth]);

  const handleOpenReconcile = (log: DailyStockLog) => {
    setReconcilingLog(log);
    setReconcileCount(log.physicalStock !== undefined ? log.physicalStock : log.expectedStock);
    setReconcileNotes(log.notes || '');
  };

  const handleSubmitReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingLog) return;
    setSubmittingReconcile(true);
    try {
      await InventoryApi.reconcileDailyItem({
        date: dailyDate,
        inventoryItemId: reconcilingLog.inventoryItemId,
        physicalStock: Number(reconcileCount),
        notes: reconcileNotes.trim()
      });
      success(`✓ Daily stock reconciled for "${reconcilingLog.inventoryItemName}". Active stock updated to ${reconcileCount} ${reconcilingLog.unit}.`);
      setReconcilingLog(null);
      loadDailyLogs(dailyDate);
      loadAllInventoryData();
    } catch (err: any) {
      error(err.message || 'Failed to submit reconciliation.');
    } finally {
      setSubmittingReconcile(false);
    }
  };

  const handleCloseMonthlyBook = async () => {
    if (!window.confirm(`Are you sure you want to close and lock the inventory books for ${monthlyMonth}? This action is irreversible for this cycle.`)) {
      return;
    }
    setSubmittingMonthlyClose(true);
    try {
      await InventoryApi.closeMonthlyReconciliation(monthlyMonth);
      success(`✓ Inventory cycle sealed & locked for ${monthlyMonth}!`);
      loadMonthlyReport(monthlyMonth);
    } catch (err: any) {
      error(err.message || 'Failed to close monthly inventory book.');
    } finally {
      setSubmittingMonthlyClose(false);
    }
  };

  // Filtered inventory items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter === 'LOW_STOCK') {
        if (item.currentStock > item.minThreshold) return false;
      } else if (statusFilter === 'OUT_OF_STOCK') {
        if (item.currentStock > 0) return false;
      } else if (statusFilter === 'IN_STOCK') {
        if (item.currentStock <= item.minThreshold) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        const matchSupplier = item.supplier && item.supplier.toLowerCase().includes(q);
        if (!matchName && !matchCategory && !matchSupplier) return false;
      }

      return true;
    });
  }, [items, categoryFilter, statusFilter, searchQuery]);

  // Handle Create Inventory Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      error('Please enter ingredient name.');
      return;
    }
    setSubmittingCreate(true);
    try {
      const created = await InventoryApi.createItem({
        name: newItemName,
        category: newItemCategory,
        openingStock: Number(newItemOpeningStock) || 0,
        unit: newItemUnit,
        minThreshold: Number(newItemMinThreshold) || 1,
        unitCost: Number(newItemUnitCost) || 0,
        supplier: newItemSupplier.trim() || undefined
      });
      success(`✓ Inventory item "${created.name}" created with opening stock ${created.currentStock} ${created.unit}!`);
      setCreateItemModalOpen(false);
      // Reset form
      setNewItemName('');
      setNewItemOpeningStock(10);
      setNewItemSupplier('');
      loadAllInventoryData();
    } catch (err: any) {
      error(err.message || 'Failed to create inventory item.');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Open Replenish Modal
  const handleOpenReplenish = (item: InventoryItem) => {
    setReplenishItem(item);
    setReplenishQty(10);
    setReplenishSupplier(item.supplier || '');
    setReplenishTotalCost(Math.round(10 * item.unitCost));
    setReplenishNotes('Purchase Stock Received');
  };

  // Handle Submit Replenish
  const handleReplenishStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishItem) return;
    if (replenishQty <= 0) {
      error('Please enter valid quantity added.');
      return;
    }
    setSubmittingReplenish(true);
    try {
      const updated = await InventoryApi.replenishStock(replenishItem.id, {
        quantityAdded: Number(replenishQty),
        supplier: replenishSupplier.trim() || undefined,
        totalCost: Number(replenishTotalCost) || undefined,
        notes: replenishNotes.trim()
      });
      success(`✓ Stock updated! Added +${replenishQty} ${updated.unit} for "${updated.name}". New Stock: ${updated.currentStock} ${updated.unit}`);
      setReplenishItem(null);
      loadAllInventoryData();
    } catch (err: any) {
      error(err.message || 'Failed to replenish stock.');
    } finally {
      setSubmittingReplenish(false);
    }
  };

  // Open Edit Item Modal
  const handleOpenEdit = (item: InventoryItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditMinThreshold(item.minThreshold);
    setEditUnitCost(item.unitCost);
    setEditSupplier(item.supplier || '');
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSubmittingEdit(true);
    try {
      await InventoryApi.updateItem(editItem.id, {
        name: editName.trim(),
        minThreshold: Number(editMinThreshold),
        unitCost: Number(editUnitCost),
        supplier: editSupplier.trim() || undefined
      });
      success(`✓ Settings for "${editName}" updated successfully.`);
      setEditItem(null);
      loadAllInventoryData();
    } catch (err: any) {
      error(err.message || 'Failed to update item.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (item: InventoryItem) => {
    if (!window.confirm(`Are you sure you want to delete raw material "${item.name}"?`)) return;
    try {
      await InventoryApi.deleteItem(item.id);
      success(`Item "${item.name}" deleted.`);
      loadAllInventoryData();
    } catch (err: any) {
      error(err.message || 'Failed to delete item.');
    }
  };

  // Open Recipe Modal for a Menu Item
  const handleOpenRecipeModal = (menuItem: MenuItem) => {
    setSelectedMenuItem(menuItem);
    const existingRecipe = recipes.find((r) => r.menuItemId === menuItem.id);
    if (existingRecipe && existingRecipe.ingredients) {
      setRecipeIngredients(
        existingRecipe.ingredients.map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          quantityRequired: ing.quantityRequired
        }))
      );
    } else {
      setRecipeIngredients([]);
    }
  };

  // Add ingredient line to recipe
  const handleAddRecipeIngredient = () => {
    if (items.length === 0) {
      error('No inventory raw materials created yet.');
      return;
    }
    const defaultInv = items[0];
    setRecipeIngredients([
      ...recipeIngredients,
      { inventoryItemId: defaultInv.id, quantityRequired: 0.1 }
    ]);
  };

  const handleRemoveRecipeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, idx) => idx !== index));
  };

  // Save Recipe
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItem) return;
    setSubmittingRecipe(true);
    try {
      await InventoryApi.saveRecipe(selectedMenuItem.id, recipeIngredients);
      success(`✓ Recipe portions for "${selectedMenuItem.name}" saved! Auto-deduction is active.`);
      setSelectedMenuItem(null);
      loadAllInventoryData();
    } catch (err: any) {
      error(err.message || 'Failed to save recipe.');
    } finally {
      setSubmittingRecipe(false);
    }
  };

  // Low stock alerts list
  const lowStockAlertItems = useMemo(() => {
    return items.filter((i) => i.currentStock <= i.minThreshold);
  }, [items]);

  // Real-time live inventory asset valuation of stock on hand
  const totalCurrentStockValuation = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.currentStock * item.unitCost), 0);
  }, [items]);

  // Aggregate Financial Stats
  const aggregateStats = useMemo(() => {
    let totalInitialValue = 0;
    let totalUtilizedValue = 0;
    let totalWastageValue = 0;
    
    items.forEach(item => {
      // Filter movements by the selected overview month or all time
      const itemMovements = movements.filter(m => {
        if (m.inventoryItemId !== item.id) return false;
        if (flowScope === 'MONTH') {
          return (m.createdAt && m.createdAt.startsWith(overviewMonth)) || m.month === overviewMonth;
        }
        return true;
      });
      
      const purchasedUnits = flowScope === 'MONTH'
        ? (itemMovements.filter(m => m.type === 'PURCHASE' || m.type === 'ADD_ON_STOCK').reduce((sum, m) => sum + m.quantity, 0) || (item.monthlyPurchased || 0))
        : (itemMovements.filter(m => m.type === 'PURCHASE' || m.type === 'ADD_ON_STOCK').reduce((sum, m) => sum + m.quantity, 0) || (item.totalPurchased || item.openingStock || 0));
      
      const utilizedUnits = flowScope === 'MONTH'
        ? (itemMovements.filter(m => m.type === 'AUTO_CONSUMPTION').reduce((sum, m) => sum + Math.abs(m.quantity), 0) || (item.monthlyConsumed || 0))
        : (itemMovements.filter(m => m.type === 'AUTO_CONSUMPTION').reduce((sum, m) => sum + Math.abs(m.quantity), 0) || (item.totalConsumed || 0));

      const wastageUnits = flowScope === 'MONTH'
        ? (itemMovements.filter(m => m.type === 'WASTAGE').reduce((sum, m) => sum + Math.abs(m.quantity), 0) || (item.monthlyWasted || 0))
        : (itemMovements.filter(m => m.type === 'WASTAGE').reduce((sum, m) => sum + Math.abs(m.quantity), 0) || (item.totalWasted || 0));
      
      totalInitialValue += (purchasedUnits * item.unitCost);
      totalUtilizedValue += (utilizedUnits * item.unitCost);
      totalWastageValue += (wastageUnits * item.unitCost);
    });

    return {
      totalInitialValue,
      totalUtilizedValue,
      totalWastageValue
    };
  }, [items, movements, overviewMonth, flowScope]);

  return (
    <div className="space-y-4">
      {/* Sleek Inventory Sub-Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`py-2 px-3.5 text-xs font-bold flex items-center gap-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'ITEMS'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Stock Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('RECIPES')}
            className={`py-2 px-3.5 text-xs font-bold flex items-center gap-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'RECIPES'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Recipes & BOM</span>
          </button>

          <button
            onClick={() => setActiveTab('DAILY')}
            className={`py-2 px-3.5 text-xs font-bold flex items-center gap-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'DAILY'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Daily Stocktaking</span>
          </button>

          <button
            onClick={() => setActiveTab('WASTAGE')}
            className={`py-2 px-3.5 text-xs font-bold flex items-center gap-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'WASTAGE'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-rose-50 hover:text-rose-700'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Record Wastage</span>
          </button>

          <button
            onClick={() => setActiveTab('MONTHLY')}
            className={`py-2 px-3.5 text-xs font-bold flex items-center gap-2 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'MONTHLY'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Monthly Rollup & Add-On Stock</span>
          </button>
        </div>

        <button
          onClick={loadAllInventoryData}
          className="p-2 bg-stone-50 hover:bg-stone-100 text-stone-600 rounded-xl transition-all cursor-pointer shrink-0 border border-stone-200/60 flex items-center gap-1.5 text-xs font-bold"
          title="Refresh Inventory"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-800' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Urgent Low Stock Alert Banner (Visible if any items low in stock) */}
      {lowStockAlertItems.length > 0 && activeTab === 'ITEMS' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-950">
                ⚠️ Low Stock Alert ({lowStockAlertItems.length} Item{lowStockAlertItems.length > 1 ? 's' : ''})
              </h4>
              <p className="text-[11px] text-amber-900/90 leading-tight">
                {lowStockAlertItems.map((i) => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')} reached reorder threshold!
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveTab('ITEMS');
              setStatusFilter('LOW_STOCK');
              setCategoryFilter('ALL');
              setSearchQuery('');
              setFlowScope('ALL');
            }}
            className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-bold rounded-xl transition-all shadow-2xs cursor-pointer shrink-0"
          >
            View Low Stock Items →
          </button>
        </div>
      )}

      {/* TAB 1: RAW MATERIALS STOCK & REORDER THRESHOLDS */}
      {activeTab === 'ITEMS' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
          {/* Controls: Clean 2-Row Layout */}
          <div className="space-y-3 pb-3 border-b border-stone-100">
            {/* Row 1: Search Input (Full prominent field) + Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Box with solid width */}
              <div className="flex items-center gap-2.5 bg-stone-50 px-3.5 py-2 rounded-2xl border border-stone-200/90 w-full sm:w-80 md:w-96 shadow-2xs">
                <Search className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search raw materials, suppliers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-stone-400 hover:text-stone-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Action Buttons: Quick Add-On Stock + Add New Item */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenAddOnModal()}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Quick Add-On Stock (Emergency / Mid-Month Extra Demand)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>+ Quick Add-On</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateItemModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Item</span>
                </button>
              </div>
            </div>

            {/* Row 2: Status Pills (Left) and Period Scope Filter (Right) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'ALL', label: 'All Items', count: items.length },
                  { id: 'IN_STOCK', label: 'In Stock', count: items.filter((i) => i.currentStock > i.minThreshold).length },
                  { id: 'LOW_STOCK', label: '⚠️ Low Stock Alerts', count: lowStockAlertItems.length },
                  { id: 'OUT_OF_STOCK', label: 'Out of Stock', count: items.filter((i) => i.currentStock <= 0).length }
                ].map((pill) => {
                  const isSelected = statusFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setStatusFilter(pill.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-800 text-white font-bold shadow-2xs'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-stone-200/70 text-stone-700'
                        }`}
                      >
                        {pill.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Period Flow Selector: All Time vs Specific Month */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200/80">
                  <button
                    type="button"
                    onClick={() => setFlowScope('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      flowScope === 'ALL'
                        ? 'bg-amber-800 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    All Time
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFlowScope('MONTH');
                      setOverviewMonth(new Date().toISOString().substring(0, 7));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      flowScope === 'MONTH' && overviewMonth === new Date().toISOString().substring(0, 7)
                        ? 'bg-amber-800 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFlowScope('MONTH');
                      setOverviewMonth('2026-09');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      flowScope === 'MONTH' && overviewMonth === '2026-09'
                        ? 'bg-amber-800 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Sep 2026
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-200">
                  <span className="text-[10px] font-bold text-stone-400 uppercase whitespace-nowrap">Month:</span>
                  <input
                    type="month"
                    value={overviewMonth}
                    onChange={(e) => {
                      setOverviewMonth(e.target.value);
                      setFlowScope('MONTH');
                    }}
                    className="text-xs font-bold text-stone-900 bg-transparent focus:outline-hidden cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Stock Table */}
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-stone-500 space-y-3 bg-stone-50/50 rounded-2xl border border-stone-200/60">
              {statusFilter === 'LOW_STOCK' && lowStockAlertItems.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-stone-900 text-sm">All Inventory Levels Healthy!</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    There are currently no raw materials at or below their reorder threshold. All items have sufficient stock.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setCategoryFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>View All Materials ({items.length})</span>
                  </button>
                </>
              ) : (
                <>
                  <Boxes className="w-10 h-10 mx-auto text-stone-300" />
                  <h3 className="font-bold text-stone-800 text-sm">No Raw Materials Found</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    No inventory items match your search or selected filter.
                  </p>
                  {(statusFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setCategoryFilter('ALL');
                        setSearchQuery('');
                      }}
                      className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                      <span>Reset All Filters</span>
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="border border-stone-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto max-h-[580px] overflow-y-auto scrollbar-thin">
                <table className="w-full min-w-[1100px] text-left text-xs text-stone-800 border-collapse">
                  <thead className="sticky top-0 bg-stone-50/95 backdrop-blur-xs border-b border-stone-200 z-10 shadow-2xs">
                    <tr className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Material Name</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">
                        {flowScope === 'ALL' ? 'Purchased / Add-Ons' : `Purchased (${overviewMonth})`}
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Unit Cost</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Stock Value</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-amber-700 text-right bg-stone-50">
                        {flowScope === 'ALL' ? 'Utilized Units' : `Utilized (${overviewMonth})`}
                      </th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-amber-700 text-right bg-stone-50">Utilize Value</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Available Stock</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {filteredItems.map((item) => {
                      const isLow = item.currentStock > 0 && item.currentStock <= item.minThreshold;
                      const isOut = item.currentStock <= 0;
                      
                      // Filter movements for this item by flowScope
                      const itemMovements = movements.filter(m => {
                        if (m.inventoryItemId !== item.id) return false;
                        if (flowScope === 'MONTH') {
                          return (m.createdAt && m.createdAt.startsWith(overviewMonth)) || m.month === overviewMonth;
                        }
                        return true;
                      });
                      
                      const purchasedUnits = itemMovements
                        .filter(m => m.type === 'PURCHASE')
                        .reduce((sum, m) => sum + m.quantity, 0);

                      const addOnUnits = itemMovements
                        .filter(m => m.type === 'ADD_ON_STOCK')
                        .reduce((sum, m) => sum + m.quantity, 0);

                      const totalStockInflow = flowScope === 'MONTH'
                        ? (purchasedUnits + addOnUnits > 0 ? (purchasedUnits + addOnUnits) : (item.monthlyPurchased || 0))
                        : (purchasedUnits + addOnUnits > 0 ? (purchasedUnits + addOnUnits) : (item.totalPurchased || item.openingStock || 0));
                      
                      const clientUtilized = itemMovements
                        .filter(m => m.type === 'AUTO_CONSUMPTION')
                        .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
                      
                      const allTimeConsumed = item.totalConsumed !== undefined
                        ? item.totalConsumed
                        : movements
                            .filter(m => m.inventoryItemId === item.id && m.type === 'AUTO_CONSUMPTION')
                            .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

                      const utilizedUnits = flowScope === 'MONTH'
                        ? (clientUtilized > 0 ? clientUtilized : (item.monthlyConsumed || 0))
                        : (clientUtilized > 0 ? clientUtilized : allTimeConsumed);
                      
                      const utilizedMoney = utilizedUnits * item.unitCost;

                      // Real live on-hand valuation
                      const currentStockValuation = item.currentStock * item.unitCost;

                      return (
                        <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-stone-900 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span>{item.name}</span>
                              {(isLow || isOut) && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-sm w-fit font-bold uppercase tracking-tight ${
                                  isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {isOut ? 'Out of Stock' : 'Low Stock'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-stone-600 whitespace-nowrap text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span>
                                {totalStockInflow > 0
                                  ? `${totalStockInflow.toFixed(2)} ${item.unit}`
                                  : item.openingStock
                                  ? `${item.openingStock.toFixed(2)} ${item.unit}`
                                  : '-'}
                              </span>
                              {addOnUnits > 0 ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  +{addOnUnits.toFixed(1)} Add-On
                                </span>
                              ) : item.openingStock && item.openingStock > 0 ? (
                                <span className="text-[9px] text-stone-400">
                                  Opening: {item.openingStock.toFixed(1)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-stone-600 whitespace-nowrap text-right">
                            {formatCurrency(item.unitCost)}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-stone-900 whitespace-nowrap text-right">
                            {formatCurrency(currentStockValuation)}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-amber-700 whitespace-nowrap text-right">
                            {utilizedUnits > 0 ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span>{utilizedUnits.toFixed(2)} {item.unit}</span>
                                {flowScope === 'MONTH' && allTimeConsumed > utilizedUnits && (
                                  <span className="text-[9px] text-stone-400 font-normal">
                                    ({allTimeConsumed.toFixed(1)} all-time)
                                  </span>
                                )}
                              </div>
                            ) : flowScope === 'MONTH' ? (
                              <div
                                className="flex flex-col items-end gap-0.5"
                                title={`0 consumed in ${overviewMonth}, total ${allTimeConsumed.toFixed(2)} ${item.unit} consumed all-time`}
                              >
                                <span className="text-stone-400 font-normal text-xs">0.00 {item.unit}</span>
                                {allTimeConsumed > 0 ? (
                                  <span className="text-[9px] text-amber-800/90 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
                                    {allTimeConsumed.toFixed(1)} {item.unit} all-time
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-stone-400 font-normal">in {overviewMonth.split('-')[1]}</span>
                                )}
                              </div>
                            ) : allTimeConsumed > 0 ? (
                              <span>{allTimeConsumed.toFixed(2)} {item.unit}</span>
                            ) : (
                              <span className="text-stone-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-amber-900 whitespace-nowrap text-right">
                            {utilizedMoney > 0
                              ? formatCurrency(utilizedMoney)
                              : flowScope === 'MONTH' && allTimeConsumed > 0
                              ? formatCurrency(allTimeConsumed * item.unitCost)
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-black text-sm whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}>
                                {item.currentStock.toFixed(2)} {item.unit}
                              </span>
                              {(isLow || isOut) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReplenish(item)}
                                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title={`Replenish stock for ${item.name}`}
                                >
                                  <PackagePlus className="w-3 h-3 text-amber-700" />
                                  <span>Restock</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                title="More Actions"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenuId(openActionMenuId === item.id ? null : item.id);
                                }}
                                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                  openActionMenuId === item.id
                                    ? 'bg-amber-800 text-white border-amber-900 shadow-2xs'
                                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200/80 hover:border-stone-300'
                                }`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openActionMenuId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-stone-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 text-left"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleOpenReplenish(item);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <PackagePlus className="w-4 h-4 text-emerald-700 shrink-0" />
                                    <span>+ Restock Purchase Stock</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleOpenAddOnModal(item);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                                    <span>+ Add-On Stock</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setViewItem(item);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4 text-stone-500 shrink-0" />
                                    <span>View Details</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleOpenReplenish(item);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <PackagePlus className="w-4 h-4 text-amber-800 shrink-0" />
                                    <span>Replenish Stock</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleOpenEdit(item);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-4 h-4 text-stone-500 shrink-0" />
                                    <span>Edit Details</span>
                                  </button>

                                  <div className="my-1 border-t border-stone-100" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleDeleteItem(item);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>Delete Material</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MENU DISH RECIPES & BOM CONFIG */}
      {activeTab === 'RECIPES' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Menu Recipes & BOM Mapping
              </h3>
              <p className="text-xs text-stone-500">
                Configure raw ingredient Bill of Materials (BOM) for each menu dish to enable automatic stock deductions on kitchen order confirmation.
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
            {menuItems.map((menuItem) => {
              const recipe = recipes.find((r) => r.menuItemId === menuItem.id);
              const hasRecipe = recipe && recipe.ingredients && recipe.ingredients.length > 0;
              const ingredientCount = hasRecipe ? recipe.ingredients.length : 0;

              return (
                <div
                  key={menuItem.id}
                  className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200/60 hover:border-amber-200 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xs group-hover:bg-amber-800 group-hover:text-white transition-colors">
                      {menuItem.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">{menuItem.name}</h4>
                      <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                        {menuItem.categoryName || 'General'} • {hasRecipe ? `${ingredientCount} ${ingredientCount === 1 ? 'Ingredient' : 'Ingredients'} Configured` : 'No Recipe Configured'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 font-medium uppercase block">Price</span>
                      <span className="text-xs font-bold text-stone-800">{formatCurrency(menuItem.price)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenRecipeModal(menuItem)}
                      className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all shadow-2xs cursor-pointer ${
                        hasRecipe
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-stone-900 text-white hover:bg-amber-800'
                      }`}
                    >
                      {hasRecipe ? 'Recipe Config' : 'Set Recipe'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: DEDICATED RECORD WASTAGE TAB */}
      {activeTab === 'WASTAGE' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Record Kitchen Wastage & Spoilage
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Log discarded, spoiled, burnt, or damaged raw ingredients. Automatically deducts live stock and recalculates monthly summaries.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenWastageModal()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl transition-all shadow-sm flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Log New Wastage</span>
            </button>
          </div>

          {/* Wastage Summary KPI Cards */}
          {(() => {
            const allWastage = movements.filter(m => m.type === 'WASTAGE');
            const totalWastageCost = allWastage.reduce((sum, m) => {
              const item = items.find(i => i.id === m.inventoryItemId);
              return sum + (m.cost || Math.abs(m.quantity) * (item?.unitCost || 0));
            }, 0);
            const todayStr = new Date().toISOString().split('T')[0];
            const todayWastage = allWastage.filter(m => m.createdAt.startsWith(todayStr));
            const todayWastageCost = todayWastage.reduce((sum, m) => {
              const item = items.find(i => i.id === m.inventoryItemId);
              return sum + (m.cost || Math.abs(m.quantity) * (item?.unitCost || 0));
            }, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80">
                  <div className="flex items-center justify-between text-rose-900 text-xs font-bold">
                    <span className="uppercase tracking-wider">Total Recorded Loss</span>
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="font-serif text-2xl font-black text-rose-950 mt-1">
                    {formatCurrency(totalWastageCost)}
                  </p>
                  <p className="text-[10px] text-rose-700 font-medium mt-0.5">
                    {allWastage.length} total wastage entries logged
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80">
                  <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
                    <span className="uppercase tracking-wider">Today's Wastage</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="font-serif text-2xl font-black text-amber-950 mt-1">
                    {formatCurrency(todayWastageCost)}
                  </p>
                  <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                    {todayWastage.length} incidents recorded today
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center justify-between text-stone-700 text-xs font-bold">
                    <span className="uppercase tracking-wider">Available Raw Materials</span>
                    <Boxes className="w-4 h-4 text-stone-500" />
                  </div>
                  <p className="font-serif text-2xl font-black text-stone-900 mt-1">
                    {items.length} items
                  </p>
                  <p className="text-[10px] text-stone-500 font-medium mt-0.5">
                    Ready for quick wastage deduction
                  </p>
                </div>
              </div>
            );
          })()}

          {/* History of Recorded Wastage Logs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-stone-500" />
                <span>Recorded Wastage History</span>
              </h4>
              <span className="text-xs text-stone-500">
                {movements.filter(m => m.type === 'WASTAGE').length} logs found
              </span>
            </div>

            {movements.filter(m => m.type === 'WASTAGE').length === 0 ? (
              <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <Trash2 className="w-8 h-8 mx-auto text-stone-300 mb-1" />
                <p className="text-xs font-medium">No kitchen wastage has been recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto scrollbar-thin rounded-2xl border border-stone-200/80 shadow-2xs bg-white">
                <table className="w-full min-w-[850px] text-left text-xs text-stone-800 border-collapse">
                  <thead className="sticky top-0 bg-stone-50/95 backdrop-blur-xs border-b border-stone-200 z-10 shadow-2xs">
                    <tr className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Date & Time</th>
                      <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Raw Material</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Quantity Lost</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Loss Value</th>
                      <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Reason / Details</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap bg-stone-50">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {movements
                      .filter(m => m.type === 'WASTAGE')
                      .map((mov) => {
                        const invItem = items.find(i => i.id === mov.inventoryItemId);
                        const loss = mov.cost || (Math.abs(mov.quantity) * (invItem?.unitCost || 0));
                        return (
                          <tr key={mov.id} className="hover:bg-rose-50/30 transition-colors">
                            <td className="py-2.5 px-3.5 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                              {formatDate(mov.createdAt)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-stone-900 whitespace-nowrap">
                              {mov.inventoryItemName}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-rose-600 text-right whitespace-nowrap">
                              {mov.quantity} {mov.unit}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-rose-700 text-right whitespace-nowrap">
                              {formatCurrency(loss)}
                            </td>
                            <td className="py-2.5 px-3.5 text-stone-600 max-w-xs truncate whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-medium mr-1.5">
                                {mov.notes?.replace('Wastage: ', '') || 'Kitchen Wastage'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenWastageModal(mov.inventoryItemId)}
                                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:underline cursor-pointer"
                              >
                                + Log Again
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DAILY RECONCILIATIONS & AUDIT SHEETS */}
      {activeTab === 'DAILY' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Daily Stocktaking & Audit Sheets
              </h3>
              <p className="text-xs text-stone-500">
                Submit actual closing physical counts of ingredients. Variances automatically log as Wastage or Adjustment.
              </p>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-700">Audit Date:</span>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-hidden"
              />
            </div>
          </div>

          {loadingDaily ? (
            <div className="p-12 text-center text-stone-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-800 mb-2" />
              <p className="text-xs">Generating daily stocktaking logs...</p>
            </div>
          ) : dailyLogs.length === 0 ? (
            <div className="p-12 text-center text-stone-400">
              No inventory materials registered to reconcile.
            </div>
          ) : (
            <div className="border border-stone-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto scrollbar-thin">
                <table className="w-full min-w-[1050px] text-left text-xs text-stone-800 border-collapse">
                  <thead className="sticky top-0 bg-stone-50/95 backdrop-blur-xs border-b border-stone-200 z-10 shadow-2xs">
                    <tr className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Ingredient Name</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Opening Stock</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right text-emerald-700 bg-stone-50">Purchased Today</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right text-rose-700 bg-stone-50">Recipe Consumed</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Expected Stock</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Closing Count</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Variance</th>
                      <th className="py-3 px-3.5 whitespace-nowrap text-center bg-stone-50">Audit Status</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap bg-stone-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {dailyLogs.map((log) => {
                      const isReconciled = log.status === 'RECONCILED';

                      return (
                        <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-stone-900 whitespace-nowrap">
                            {log.inventoryItemName}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-stone-600 text-right whitespace-nowrap">
                            {log.openingStock} {log.unit}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-emerald-700 font-bold text-right whitespace-nowrap">
                            +{log.replenished} {log.unit}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-rose-600 font-bold text-right whitespace-nowrap">
                            -{log.autoConsumed} {log.unit}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-stone-900 text-right whitespace-nowrap">
                            {log.expectedStock} {log.unit}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-right whitespace-nowrap">
                            {isReconciled ? (
                              <span className="text-emerald-700">{log.physicalStock} {log.unit}</span>
                            ) : (
                              <span className="text-stone-400 italic">Unsubmitted</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-right whitespace-nowrap">
                            {isReconciled ? (
                              log.variance === 0 ? (
                                <span className="text-emerald-700">0</span>
                              ) : log.variance! > 0 ? (
                                <span className="text-rose-600">-{log.variance} {log.unit} (Wastage)</span>
                              ) : (
                                <span className="text-emerald-600">+{Math.abs(log.variance!)} {log.unit}</span>
                              )
                            ) : (
                              <span className="text-stone-400 italic">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            {isReconciled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Reconciled</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-amber-700" />
                                <span>Pending Count</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenReconcile(log)}
                              className={`px-3 py-1 font-bold text-[11px] rounded-xl transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer ${
                                isReconciled
                                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                                  : 'bg-amber-800 hover:bg-amber-900 text-white'
                              }`}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>{isReconciled ? 'Re-audit' : 'Record Count'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: MONTHLY STOCK ROLLUP & ADD-ON WORKFLOW */}
      {activeTab === 'MONTHLY' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Monthly Accounting & Rolling Cycle
                </span>
                <span className="text-xs text-stone-400">•</span>
                <span className="text-xs font-semibold text-stone-600">
                  {monthlyReport?.status === 'CLOSED' ? 'Book Sealed' : 'Rolling Live'}
                </span>
              </div>
              <h3 className="font-serif font-bold text-xl text-stone-900 mt-1 flex items-center gap-2">
                <Layers className="w-6 h-6 text-amber-800" />
                <span>Monthly Stock Rollup & Add-On Calculation</span>
              </h3>
              <p className="text-xs text-stone-500 max-w-2xl mt-0.5">
                Calculate opening stock, base restocks, supplemental add-on demand, kitchen consumption auto-deductions, and recorded wastage rolled across the month.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Month Picker */}
              <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-2xl border border-stone-200">
                <span className="text-[11px] font-bold text-stone-600">Month:</span>
                <input
                  type="month"
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(e.target.value)}
                  className="text-xs font-bold text-stone-900 bg-transparent focus:outline-hidden cursor-pointer"
                />
              </div>

              {/* Add-On Stock CTA */}
              <button
                type="button"
                onClick={() => handleOpenAddOnModal()}
                className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-2xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <PackagePlus className="w-4 h-4" />
                <span>+ Log Add-On Stock</span>
              </button>
            </div>
          </div>

          {loadingMonthly ? (
            <div className="p-16 text-center text-stone-500 space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-800" />
              <p className="text-xs font-medium">Computing monthly stock rollups & add-on figures...</p>
            </div>
          ) : !monthlyReport ? (
            <div className="p-16 text-center text-stone-400 space-y-2">
              <Boxes className="w-10 h-10 mx-auto text-stone-300" />
              <h3 className="font-bold text-stone-700 text-sm">No Inventory Data For {monthlyMonth}</h3>
              <p className="text-xs text-stone-500">Record purchases, add-on stock, or recipes to initiate rolling monthly reports.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cycle Status Banner */}
              <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                monthlyReport.status === 'CLOSED'
                  ? 'bg-stone-50 border-stone-300 text-stone-900'
                  : 'bg-amber-500/10 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    monthlyReport.status === 'CLOSED' ? 'bg-stone-200 text-stone-700' : 'bg-amber-600 text-white'
                  }`}>
                    {monthlyReport.status === 'CLOSED' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-bold text-base">
                        Month Status: {monthlyReport.status === 'CLOSED' ? 'CLOSED & LOCKED' : 'OPEN / ACTIVE ROLLING'}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        monthlyReport.status === 'CLOSED' ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {monthlyMonth}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600/90 mt-0.5">
                      {monthlyReport.status === 'CLOSED'
                        ? `This cycle was finalized and sealed on ${formatDate(monthlyReport.closedAt!)}.`
                        : 'Stock additions, kitchen order deductions, and extra add-ons roll continuously into the closing balance.'}
                    </p>
                  </div>
                </div>

                {monthlyReport.status === 'OPEN' && (
                  <button
                    type="button"
                    onClick={handleCloseMonthlyBook}
                    disabled={submittingMonthlyClose}
                    className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Seal & Lock Cycle</span>
                  </button>
                )}
              </div>

              {/* 6 Summary Accounting KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">1. Opening Stock</span>
                  <p className="font-serif text-base sm:text-lg font-bold text-stone-900 mt-1">
                    {formatCurrency(monthlyReport.totalOpeningValuation)}
                  </p>
                  <span className="text-[10px] text-stone-400 font-medium">Brought Forward</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">2. Base Purchases</span>
                  <p className="font-serif text-base sm:text-lg font-bold text-emerald-800 mt-1">
                    +{formatCurrency(monthlyReport.totalPurchases)}
                  </p>
                  <span className="text-[10px] text-emerald-700/80 font-medium">Standard Restocks</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-900 font-black uppercase tracking-wider block">3. Add-On Stock</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <p className="font-serif text-base sm:text-lg font-bold text-amber-950 mt-1">
                    +{formatCurrency(monthlyReport.totalAddOnStock || 0)}
                  </p>
                  <span className="text-[10px] text-amber-900/90 font-bold">
                    {monthlyReport.totalAddOnStockQty || 0} units extra
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                  <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block">4. Kitchen Consumed</span>
                  <p className="font-serif text-base sm:text-lg font-bold text-rose-800 mt-1">
                    -{formatCurrency(monthlyReport.totalConsumption)}
                  </p>
                  <span className="text-[10px] text-rose-700/80 font-medium">Order Auto-Deductions</span>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">5. Wastage Loss</span>
                  <p className="font-serif text-base sm:text-lg font-bold text-stone-800 mt-1">
                    -{formatCurrency(monthlyReport.totalWastage)}
                  </p>
                  <span className="text-[10px] text-stone-500 font-medium">Spoilage / Drops</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-800 text-white shadow-sm border border-amber-900">
                  <span className="text-[10px] text-amber-200 font-bold uppercase tracking-wider block">6. Rolling Closing</span>
                  <p className="font-serif text-base sm:text-lg font-bold text-white mt-1">
                    ={formatCurrency(monthlyReport.totalClosingValuation)}
                  </p>
                  <span className="text-[10px] text-amber-200/90 font-medium">Current Valuation</span>
                </div>
              </div>

              {/* Rolling Formula Banner */}
              <div className="px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-stone-700 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2 font-mono text-[11px]">
                <span className="font-bold text-stone-900">
                  Rolling Stock Formula: Opening ({formatCurrency(monthlyReport.totalOpeningValuation)}) + Base Restocks (+{formatCurrency(monthlyReport.totalPurchases)}) + Add-On Stock (+{formatCurrency(monthlyReport.totalAddOnStock || 0)}) - Consumption (-{formatCurrency(monthlyReport.totalConsumption)}) - Wastage (-{formatCurrency(monthlyReport.totalWastage)}) = {formatCurrency(monthlyReport.totalClosingValuation)}
                </span>
                <span className="text-[10px] text-amber-800 font-sans font-bold bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                  ✓ Auto-Rolled For Calculations
                </span>
              </div>

              {/* SECTION 1: ITEM-BY-ITEM ROLLING CALCULATION MATRIX */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-amber-800" />
                      <span>Item-by-Item Monthly Rolling Breakdown</span>
                    </h4>
                    <p className="text-xs text-stone-500">
                      View opening stock balance, purchases, mid-month add-on demand, and calculated rolling closing stock per ingredient.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAddOnModal()}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                      <span>+ Add-On Stock</span>
                    </button>
                  </div>
                </div>

                <div className="border border-stone-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto max-h-[560px] overflow-y-auto scrollbar-thin">
                    <table className="w-full min-w-[1100px] text-left text-xs text-stone-800 border-collapse">
                      <thead className="sticky top-0 bg-stone-50/95 backdrop-blur-xs border-b border-stone-200 z-10 shadow-2xs">
                        <tr className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                          <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Raw Material</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Unit Cost</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Opening Stock</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right text-emerald-800 bg-stone-50">Base Restock (+)</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right text-amber-900 bg-amber-50/40">Add-On Stock (+)</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right text-rose-800 bg-stone-50">Consumed (-)</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right text-stone-600 bg-stone-50">Wastage (-)</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right font-bold text-stone-900 bg-stone-50">Closing Stock</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right font-bold text-stone-900 bg-stone-50">Closing Value</th>
                          <th className="py-3 px-3.5 text-right whitespace-nowrap bg-stone-50">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {(monthlyReport.itemsBreakdown || []).map((row) => {
                          const hasAddOn = row.addOnStockQty > 0;
                          return (
                            <tr key={row.itemId} className="hover:bg-amber-50/20 transition-colors">
                              <td className="py-2.5 px-3.5 font-bold text-stone-900 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span>{row.itemName}</span>
                                  <span className="text-[10px] text-stone-400 font-normal">{row.category}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right text-stone-600 whitespace-nowrap">
                                {formatCurrency(row.unitCost)} / {row.unit}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right text-stone-700 whitespace-nowrap">
                                {row.openingStock} {row.unit}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right text-emerald-700 font-medium whitespace-nowrap">
                                {row.basePurchasesQty > 0 ? `+${row.basePurchasesQty} ${row.unit}` : '-'}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right text-amber-950 font-bold whitespace-nowrap bg-amber-50/30">
                                {hasAddOn ? (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 text-xs">
                                    +{row.addOnStockQty} {row.unit} ({formatCurrency(row.addOnStockCost)})
                                  </span>
                                ) : (
                                  <span className="text-stone-400 font-normal">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right text-rose-700 font-medium whitespace-nowrap">
                                {row.consumedQty > 0 ? `-${row.consumedQty} ${row.unit}` : '-'}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right text-stone-600 whitespace-nowrap">
                                {row.wastageQty > 0 ? `-${row.wastageQty} ${row.unit}` : '-'}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right font-bold text-stone-900 whitespace-nowrap">
                                <span className={row.closingStock <= 0 ? 'text-rose-600' : 'text-stone-900'}>
                                  {row.closingStock} {row.unit}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-right font-bold text-emerald-700 whitespace-nowrap">
                                {formatCurrency(row.closingValuation)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  title={`Log Add-On Stock for ${row.itemName}`}
                                  onClick={() => handleOpenAddOnModal(row.itemId)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[11px] rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-700" />
                                  <span>+ Add-On</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ADD-ON STOCK MOVEMENTS LOG FOR THIS MONTH */}
              {(() => {
                const monthAddOnMovements = movements.filter(
                  (m) => m.type === 'ADD_ON_STOCK' && ((m.createdAt && m.createdAt.startsWith(monthlyMonth)) || m.month === monthlyMonth)
                );

                return (
                  <div className="space-y-3 pt-4 border-t border-stone-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                          <PackagePlus className="w-4 h-4 text-amber-800" />
                          <span>Add-On Stock Incident Audit Log ({monthlyMonth})</span>
                        </h4>
                        <p className="text-xs text-stone-500">
                          Complete audit history of mid-month supplemental purchases, event surges, and ad-hoc replenish records.
                        </p>
                      </div>

                      <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1 rounded-full w-fit">
                        {monthAddOnMovements.length} Add-On Record{monthAddOnMovements.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {monthAddOnMovements.length === 0 ? (
                      <div className="p-8 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                        <PackagePlus className="w-8 h-8 mx-auto text-stone-300" />
                        <p className="text-xs font-bold text-stone-700">No Add-On Stock Recorded for {monthlyMonth}</p>
                        <p className="text-[11px] text-stone-500 max-w-md mx-auto">
                          When kitchen needs more stock during the month due to weekend surges or events, record it using the "+ Log Add-On Stock" button.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-stone-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
                        <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-thin">
                          <table className="w-full min-w-[950px] text-left text-xs text-stone-800 border-collapse">
                            <thead className="sticky top-0 bg-stone-50/95 backdrop-blur-xs border-b border-stone-200 z-10 shadow-2xs">
                              <tr className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                                <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Timestamp / Date</th>
                                <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Raw Material</th>
                                <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Qty Added</th>
                                <th className="py-3 px-3.5 whitespace-nowrap text-right bg-stone-50">Total Cost</th>
                                <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Reason / Trigger</th>
                                <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Supplier & Invoice</th>
                                <th className="py-3 px-3.5 whitespace-nowrap bg-stone-50">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 bg-white">
                              {monthAddOnMovements.map((mov) => (
                                <tr key={mov.id} className="hover:bg-amber-50/20 transition-colors">
                                  <td className="py-2.5 px-3.5 font-mono text-stone-600 text-[11px] whitespace-nowrap">
                                    {formatDate(mov.createdAt)}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-bold text-stone-900 whitespace-nowrap">
                                    {mov.inventoryItemName}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-mono text-right font-bold text-amber-900 whitespace-nowrap">
                                    +{mov.quantity} {mov.unit}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-mono text-right font-bold text-emerald-700 whitespace-nowrap">
                                    {mov.cost ? formatCurrency(mov.cost) : '-'}
                                  </td>
                                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">
                                      {mov.reason || 'Mid-Month Extra Stock'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5 text-stone-600 text-xs whitespace-nowrap">
                                    <div>{mov.supplier || 'Standard Supplier'}</div>
                                    {mov.invoiceNumber && (
                                      <div className="text-[10px] font-mono text-stone-400">Inv #{mov.invoiceNumber}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-stone-500 text-xs max-w-xs truncate whitespace-nowrap">
                                    {mov.notes || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE NEW RAW MATERIAL INVENTORY ITEM */}
      {createItemModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setCreateItemModalOpen(false)}
          title="Add New Raw Material Ingredient"
        >
          <form onSubmit={handleCreateItem} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Raw Material Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Royal Paneer, Amul Butter, Basmati Rice"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Category *
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                >
                  <option value="Dairy">Dairy</option>
                  <option value="Spices">Spices</option>
                  <option value="Grains & Rice">Grains & Rice</option>
                  <option value="Meat & Poultry">Meat & Poultry</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Oils & Fats">Oils & Fats</option>
                  <option value="Bakery & Flour">Bakery & Flour</option>
                  <option value="Pantry">Pantry</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Unit of Measure *
                </label>
                <select
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="L">Liters (L)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="packets">Packets</option>
                  <option value="boxes">Boxes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Opening Stock *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={newItemOpeningStock}
                  onChange={(e) => setNewItemOpeningStock(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Reorder Limit *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={newItemMinThreshold}
                  onChange={(e) => setNewItemMinThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Unit Cost (₹) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  min="0"
                  value={newItemUnitCost}
                  onChange={(e) => setNewItemUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Supplier Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Amul Dairy Ltd, Nandini Distributors"
                value={newItemSupplier}
                onChange={(e) => setNewItemSupplier(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateItemModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCreate}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingCreate ? 'Saving...' : 'Create Material Item'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: REPLENISH / RECORD PURCHASE STOCK RECEIVED */}
      {replenishItem && (
        <Modal
          isOpen={true}
          onClose={() => setReplenishItem(null)}
          title={`+ Replenish Purchase Stock: ${replenishItem.name}`}
        >
          <form onSubmit={handleReplenishStock} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between items-center font-bold text-stone-900">
                <span>Current Balance:</span>
                <span className="font-mono text-amber-900 text-sm">
                  {replenishItem.currentStock} {replenishItem.unit}
                </span>
              </div>
              <p className="text-[11px] text-stone-600">
                Reorder Threshold Limit: {replenishItem.minThreshold} {replenishItem.unit}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Quantity Added ({replenishItem.unit}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                value={replenishQty}
                onChange={(e) => {
                  const q = parseFloat(e.target.value) || 0;
                  setReplenishQty(q);
                  setReplenishTotalCost(Math.round(q * replenishItem.unitCost));
                }}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amul Dairy Co."
                  value={replenishSupplier}
                  onChange={(e) => setReplenishSupplier(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Purchase Invoice Cost (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={replenishTotalCost}
                  onChange={(e) => setReplenishTotalCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Purchase Notes / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. Purchase Order #PO-8812, Quality Checked"
                value={replenishNotes}
                onChange={(e) => setReplenishNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplenishItem(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReplenish}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingReplenish ? 'Updating Stock...' : 'Confirm Stock Purchase'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: EDIT INVENTORY ITEM DETAILS */}
      {editItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditItem(null)}
          title={`Edit Inventory Item: ${editItem.name}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Material Name
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Reorder Threshold ({editItem.unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={editMinThreshold}
                  onChange={(e) => setEditMinThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Unit Cost (₹ / {editItem.unit})
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  min="0"
                  value={editUnitCost}
                  onChange={(e) => setEditUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                value={editSupplier}
                onChange={(e) => setEditSupplier(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-600"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingEdit ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: RECIPE PORTIONS CONFIGURATION */}
      {selectedMenuItem && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMenuItem(null)}
          title={`Recipe Portion Ingredients: ${selectedMenuItem.name}`}
        >
          <form onSubmit={handleSaveRecipe} className="space-y-4">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Menu Item Portion Auto-Deduction
              </span>
              <h4 className="font-bold text-stone-900 text-sm">{selectedMenuItem.name} ({formatCurrency(selectedMenuItem.price)})</h4>
              <p className="text-[11px] text-stone-500">
                Select raw materials and specify the portion quantity consumed for 1 portion of this dish.
              </p>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {recipeIngredients.length === 0 ? (
                <div className="p-4 text-center text-stone-400 text-xs border border-dashed border-stone-200 rounded-2xl">
                  No ingredients added yet. Click below to add raw materials consumed by this dish.
                </div>
              ) : (
                recipeIngredients.map((ing, idx) => {
                  const inv = items.find((i) => i.id === ing.inventoryItemId);

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-2"
                    >
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                          Raw Material Ingredient
                        </label>
                        <select
                          value={ing.inventoryItemId}
                          onChange={(e) => {
                            const copy = [...recipeIngredients];
                            copy[idx].inventoryItemId = e.target.value;
                            setRecipeIngredients(copy);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden"
                        >
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <label className="block text-[10px] font-bold text-stone-500 uppercase mb-0.5">
                          Qty ({inv?.unit || 'kg'})
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          value={ing.quantityRequired}
                          onChange={(e) => {
                            const copy = [...recipeIngredients];
                            copy[idx].quantityRequired = parseFloat(e.target.value) || 0;
                            setRecipeIngredients(copy);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold font-mono text-stone-900 focus:outline-hidden"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeIngredient(idx)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer mt-4"
                        title="Remove Ingredient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={handleAddRecipeIngredient}
              className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Raw Material Ingredient</span>
            </button>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedMenuItem(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRecipe}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingRecipe ? 'Saving Recipe...' : 'Save Recipe Config'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 5: SUBMIT DAILY PHYSICAL STOCK COUNT */}
      {reconcilingLog && (
        <Modal
          isOpen={true}
          onClose={() => setReconcilingLog(null)}
          title={`Daily Stock Audit: ${reconcilingLog.inventoryItemName}`}
        >
          <form onSubmit={handleSubmitReconcile} className="space-y-4">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                Discrepancy Calculation sheet
              </span>
              <div className="grid grid-cols-2 gap-2 text-stone-700 font-mono">
                <div>Opening Stock:</div>
                <div className="font-bold text-right">{reconcilingLog.openingStock} {reconcilingLog.unit}</div>
                <div>Purchased:</div>
                <div className="font-bold text-right text-emerald-700">+{reconcilingLog.replenished} {reconcilingLog.unit}</div>
                <div>Recipe Consumed:</div>
                <div className="font-bold text-right text-rose-600">-{reconcilingLog.autoConsumed} {reconcilingLog.unit}</div>
                <div className="border-t border-stone-200 pt-1 font-bold text-stone-900">Expected Stock:</div>
                <div className="border-t border-stone-200 pt-1 font-bold text-stone-900 text-right">{reconcilingLog.expectedStock} {reconcilingLog.unit}</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Actual Physical closing Stock ({reconcilingLog.unit}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                value={reconcileCount}
                onChange={(e) => setReconcileCount(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Variance Explanation / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. 0.5kg spilled during cooking, or extra portion served"
                value={reconcileNotes}
                onChange={(e) => setReconcileNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setReconcilingLog(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReconcile}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingReconcile ? 'Submitting...' : '✓ Reconcile & Update Inventory'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* MODAL 6: VIEW ITEM COMPLETE DETAILS */}
      {viewItem && (
        <Modal
          isOpen={true}
          onClose={() => setViewItem(null)}
          title="Raw Material Complete Details"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 border-b border-stone-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-lg text-stone-900 leading-tight">{viewItem.name}</h4>
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">{viewItem.category}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Available Stock</span>
                <p className="font-mono font-bold text-stone-900">{viewItem.currentStock} {viewItem.unit}</p>
              </div>
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Reorder Level</span>
                <p className="font-mono font-bold text-stone-900">{viewItem.minThreshold} {viewItem.unit}</p>
              </div>
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Unit Cost</span>
                <p className="font-mono font-bold text-stone-900">{formatCurrency(viewItem.unitCost)} / {viewItem.unit}</p>
              </div>
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Current Value</span>
                <p className="font-mono font-bold text-emerald-700">{formatCurrency(viewItem.currentStock * viewItem.unitCost)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 space-y-1 col-span-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Supplier</span>
                <p className="font-bold text-stone-800">{viewItem.supplier || 'No supplier set'}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-900 text-white/90 text-[10px] font-mono space-y-1">
              <div className="flex justify-between">
                <span>Database ID:</span>
                <span className="text-amber-400">{viewItem.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Created At:</span>
                <span>{formatDate(viewItem.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span>{formatDate(viewItem.updatedAt)}</span>
              </div>
            </div>

            {/* Movement & Auto-Consumption Audit History */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-800" />
                  <span>Stock Movement & Consumption Audit Trail</span>
                </h5>
                <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                  {movements.filter(m => m.inventoryItemId === viewItem.id).length} Entries
                </span>
              </div>

              {(() => {
                const itemMovs = movements.filter(m => m.inventoryItemId === viewItem.id);
                const totalAutoConsumed = itemMovs
                  .filter(m => m.type === 'AUTO_CONSUMPTION')
                  .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
                const totalRestocked = itemMovs
                  .filter(m => m.type === 'PURCHASE' || m.type === 'ADD_ON_STOCK')
                  .reduce((sum, m) => sum + m.quantity, 0);

                if (itemMovs.length === 0) {
                  return (
                    <div className="p-4 bg-stone-50 rounded-xl text-center text-xs text-stone-400">
                      No stock movements recorded for this ingredient yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {/* Summary row */}
                    <div className="grid grid-cols-2 gap-2 text-xs p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80">
                      <div>
                        <span className="text-[10px] text-stone-500 block uppercase font-bold">Total Auto-Consumed</span>
                        <span className="font-mono font-bold text-amber-900">
                          {totalAutoConsumed.toFixed(2)} {viewItem.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 block uppercase font-bold">Total Inflow & Restock</span>
                        <span className="font-mono font-bold text-emerald-800">
                          +{totalRestocked.toFixed(2)} {viewItem.unit}
                        </span>
                      </div>
                    </div>

                    {/* Scrollable movements table */}
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white scrollbar-thin">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 text-[10px] uppercase font-bold text-stone-500">
                          <tr>
                            <th className="py-2 px-2.5 bg-stone-50">Date</th>
                            <th className="py-2 px-2.5 bg-stone-50">Type</th>
                            <th className="py-2 px-2.5 text-right bg-stone-50">Qty</th>
                            <th className="py-2 px-2.5 bg-stone-50">Details / Order</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-[11px]">
                          {itemMovs.map((mov) => {
                            const isNeg = mov.quantity < 0;
                            return (
                              <tr key={mov.id} className="hover:bg-stone-50/60">
                                <td className="py-1.5 px-2.5 font-mono text-[10px] text-stone-500 whitespace-nowrap">
                                  {formatDate(mov.createdAt)}
                                </td>
                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.2 rounded-md font-bold text-[9px] uppercase ${
                                    mov.type === 'AUTO_CONSUMPTION'
                                      ? 'bg-amber-100 text-amber-900'
                                      : mov.type === 'PURCHASE' || mov.type === 'ADD_ON_STOCK'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-rose-100 text-rose-900'
                                  }`}>
                                    {mov.type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className={`py-1.5 px-2.5 font-mono font-bold text-right whitespace-nowrap ${
                                  isNeg ? 'text-amber-900' : 'text-emerald-700'
                                }`}>
                                  {isNeg ? `${mov.quantity.toFixed(2)}` : `+${mov.quantity.toFixed(2)}`} {mov.unit}
                                </td>
                                <td className="py-1.5 px-2.5 text-stone-600 truncate max-w-[200px]" title={mov.notes}>
                                  {mov.orderNumber ? `#${mov.orderNumber} - ` : ''}{mov.notes || 'Movement'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = viewItem;
                  setViewItem(null);
                  handleOpenReplenish(target);
                }}
                className="flex-1 py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Restock Item Now</span>
              </button>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 7: RECORD KITCHEN WASTAGE */}
      {wastageModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setWastageModalOpen(false)}
          title="Record Kitchen Wastage"
        >
          <form onSubmit={handleRecordWastage} className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Kitchen Ingredient Wastage / Spoilage Entry</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Log discarded, spoiled, or damaged raw ingredients. This immediately deducts current stock balance, logs a verified wastage audit movement, and updates the monthly financial summary.
              </p>
            </div>

            {/* Select Item */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Select Raw Material / Ingredient *
              </label>
              {items.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No inventory raw materials found.</p>
              ) : (
                <select
                  value={selectedWastageItemId}
                  onChange={(e) => setSelectedWastageItemId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category}) — Available: {item.currentStock} {item.unit} @ {formatCurrency(item.unitCost)}/{item.unit}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {(() => {
              const selectedItem = items.find((i) => i.id === selectedWastageItemId);
              const unitCost = selectedItem?.unitCost || 0;
              const unit = selectedItem?.unit || 'kg';
              const curStock = selectedItem?.currentStock || 0;
              const lossVal = Math.round((Number(wastageQty) || 0) * unitCost);
              const projectedStock = Math.max(0, Number((curStock - (Number(wastageQty) || 0)).toFixed(2)));
              const isOverStock = (Number(wastageQty) || 0) > curStock;

              return (
                <>
                  {/* Quantity & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Quantity Wasted ({unit}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={wastageQty}
                        onChange={(e) => setWastageQty(parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold font-mono text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                      {isOverStock && (
                        <p className="text-[10px] text-amber-700 font-bold mt-1">
                          ⚠️ Entered quantity exceeds current stock ({curStock} {unit}). Stock balance will reach 0.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Incident Date *
                      </label>
                      <input
                        type="date"
                        value={wastageDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setWastageDate(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>
                  </div>

                  {/* Reason for Wastage */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Reason for Wastage *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                      {[
                        'Spoilage / Expiry',
                        'Kitchen Spillage / Dropped',
                        'Burnt / Overcooked',
                        'Quality Defect / Trimmings',
                        'Customer Return / Cancelled',
                        'Other'
                      ].map((reasonOption) => {
                        const isSelected = wastageReason === reasonOption;
                        return (
                          <button
                            type="button"
                            key={reasonOption}
                            onClick={() => setWastageReason(reasonOption)}
                            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs'
                                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            {reasonOption}
                          </button>
                        );
                      })}
                    </div>

                    {wastageReason === 'Other' && (
                      <input
                        type="text"
                        placeholder="Specify custom wastage reason / notes..."
                        value={customWastageReason}
                        onChange={(e) => setCustomWastageReason(e.target.value)}
                        required={wastageReason === 'Other'}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    )}
                  </div>

                  {/* Real-time Impact Breakdown Card */}
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Financial & Stock Impact Breakdown
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-white rounded-xl border border-stone-100">
                        <span className="text-[10px] text-stone-400 block font-medium">Unit Rate</span>
                        <span className="text-xs font-mono font-bold text-stone-800">
                          {formatCurrency(unitCost)}/{unit}
                        </span>
                      </div>
                      <div className="p-2 bg-rose-50/80 rounded-xl border border-rose-100">
                        <span className="text-[10px] text-rose-600 block font-bold">Total Loss</span>
                        <span className="text-xs font-mono font-black text-rose-700">
                          {formatCurrency(lossVal)}
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-stone-100">
                        <span className="text-[10px] text-stone-400 block font-medium">New Stock</span>
                        <span className="text-xs font-mono font-bold text-stone-900">
                          {projectedStock} {unit}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setWastageModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingWastage}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{submittingWastage ? 'Recording...' : 'Confirm & Record Wastage'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 8: LOG ADD-ON STOCK (EMERGENCY / MID-MONTH EXTRA DEMAND WORKFLOW) */}
      {addOnModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setAddOnModalOpen(false)}
          title="+ Log Add-On Stock (Mid-Month Extra Demand Workflow)"
        >
          <form onSubmit={handleSubmitAddOnStock} className="space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Supplemental / Mid-Month Extra Stock Inflow</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                When kitchen needs extra stock due to weekend demand surges, banquet party bookings, or emergency replenishment, log it here. This updates inventory balance and automatically rolls into the selected monthly calculation sheet.
              </p>
            </div>

            {/* Select Raw Material */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Select Raw Material / Ingredient *
              </label>
              {items.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No inventory raw materials found.</p>
              ) : (
                <select
                  value={selectedAddOnItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedAddOnItemId(id);
                    const it = items.find((i) => i.id === id);
                    if (it) {
                      setAddOnUnitCost(it.unitCost);
                      setAddOnTotalCost(Math.round(addOnQty * it.unitCost));
                      if (it.supplier) setAddOnSupplier(it.supplier);
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category}) — Current: {item.currentStock} {item.unit} @ {formatCurrency(item.unitCost)}/{item.unit}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {(() => {
              const selectedItem = items.find((i) => i.id === selectedAddOnItemId);
              const unit = selectedItem?.unit || 'kg';
              const curStock = selectedItem?.currentStock || 0;
              const unitCost = Number(addOnUnitCost) || selectedItem?.unitCost || 0;
              const calcTotalCost = Math.round(addOnQty * unitCost);
              const projectedStock = Number((curStock + Number(addOnQty || 0)).toFixed(2));

              return (
                <>
                  {/* Quantity & Accounting Month */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Add-On Quantity ({unit}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={addOnQty}
                        onChange={(e) => {
                          const q = parseFloat(e.target.value) || 0;
                          setAddOnQty(q);
                          setAddOnTotalCost(Math.round(q * unitCost));
                        }}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold font-mono text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Rolling Target Month *
                      </label>
                      <input
                        type="month"
                        value={addOnMonth}
                        onChange={(e) => setAddOnMonth(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Delivery Date *
                      </label>
                      <input
                        type="date"
                        value={addOnDate}
                        onChange={(e) => setAddOnDate(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>
                  </div>

                  {/* Financial Values */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Unit Rate (₹ / {unit})
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={addOnUnitCost}
                        onChange={(e) => {
                          const uc = parseFloat(e.target.value) || 0;
                          setAddOnUnitCost(uc);
                          setAddOnTotalCost(Math.round(addOnQty * uc));
                        }}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold font-mono text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Total Purchase Cost (₹)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={addOnTotalCost}
                        onChange={(e) => setAddOnTotalCost(parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold font-mono text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>
                  </div>

                  {/* Reason / Workflow Trigger */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Demand Trigger / Add-On Reason *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                      {[
                        'Mid-Month Surge Demand',
                        'Banquet / Event Extra Stock',
                        'Emergency Weekend Replenishment',
                        'Supplier Bulk Discount / Deal',
                        'Chef Special Promotion Demand',
                        'Buffer Safety Stock',
                        'Other'
                      ].map((rOption) => {
                        const isSelected = addOnReason === rOption;
                        return (
                          <button
                            type="button"
                            key={rOption}
                            onClick={() => setAddOnReason(rOption)}
                            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-2xs'
                                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            {rOption}
                          </button>
                        );
                      })}
                    </div>

                    {addOnReason === 'Other' && (
                      <input
                        type="text"
                        placeholder="Specify custom demand trigger / reason..."
                        value={customAddOnReason}
                        onChange={(e) => setCustomAddOnReason(e.target.value)}
                        required={addOnReason === 'Other'}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    )}
                  </div>

                  {/* Supplier & Invoice */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Supplier / Vendor Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Metro Cash & Carry, Local Farm"
                        value={addOnSupplier}
                        onChange={(e) => setAddOnSupplier(e.target.value)}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Invoice / PO Reference #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INV-90422 / PO-EXTRA-11"
                        value={addOnInvoice}
                        onChange={(e) => setAddOnInvoice(e.target.value)}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-700"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Manager Notes / Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Requested by Head Chef for 150-guest banquet hall booking"
                      value={addOnNotes}
                      onChange={(e) => setAddOnNotes(e.target.value)}
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden focus:border-amber-700"
                    />
                  </div>

                  {/* Real-time Rolling Calculation Preview Card */}
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                      Rolling Stock Impact ({addOnMonth})
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-white rounded-xl border border-stone-100">
                        <span className="text-[10px] text-stone-400 block font-medium">Current Balance</span>
                        <span className="text-xs font-mono font-bold text-stone-700">
                          {curStock} {unit}
                        </span>
                      </div>
                      <div className="p-2 bg-amber-50/80 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-900 block font-bold">New Balance</span>
                        <span className="text-xs font-mono font-black text-amber-950">
                          {projectedStock} {unit} (+{addOnQty})
                        </span>
                      </div>
                      <div className="p-2 bg-emerald-50/80 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 block font-bold">Month Inflow Value</span>
                        <span className="text-xs font-mono font-bold text-emerald-800">
                          +{formatCurrency(addOnTotalCost || calcTotalCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setAddOnModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAddOn}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>{submittingAddOn ? 'Saving Add-On...' : 'Confirm & Roll Into Monthly Stock'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
