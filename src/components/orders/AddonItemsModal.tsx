/**
 * Add-on Items Modal for Open Orders
 * Allows customers to browse menu, select extra dishes, and append them to their active order.
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  Utensils,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { MenuItem, MenuCategory, Order } from '../../types/index.ts';
import { MenuApi, OrderApi } from '../../api/index.ts';
import { ItemCustomizerModal } from '../menu/ItemCustomizer.tsx';
import { ItemSelection, describeSelection, hasCustomization, resolveItemConfiguration, selectionKey, startingPrice } from '../../../shared/menuConfig.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatCurrency } from '../../utils/formatters.ts';

interface AddonItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onItemsAdded: (updatedOrder: Order) => void;
}

export const AddonItemsModal: React.FC<AddonItemsModalProps> = ({
  isOpen,
  onClose,
  order,
  onItemsAdded
}) => {
  const { error, success } = useToast();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Keyed by item + chosen portion/add-ons, so one dish can appear with different choices.
  const [addonCart, setAddonCart] = useState<Record<string, { item: MenuItem; quantity: number; notes: string; selection: ItemSelection }>>({});
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [cats, items] = await Promise.all([
          MenuApi.getCategories(),
          MenuApi.getItems()
        ]);
        if (isMounted) {
          setCategories(cats.filter((c) => c.status === 'ACTIVE'));
          setMenuItems(items.filter((i) => i.available));
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          error('Failed to load menu dishes for add-on.');
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const addEntry = (item: MenuItem, selection: ItemSelection, delta: number) => {
    const key = selectionKey(item.id, selection);
    setAddonCart((prev) => {
      const current = prev[key]?.quantity || 0;
      const next = current + delta;
      const updated = { ...prev };

      if (next <= 0) {
        delete updated[key];
      } else {
        updated[key] = {
          item,
          selection,
          quantity: Math.min(20, next),
          notes: prev[key]?.notes || ''
        };
      }
      return updated;
    });
  };

  const handleUpdateQuantity = (item: MenuItem, delta: number) => {
    if (hasCustomization(item)) {
      if (delta > 0) {
        setCustomizing(item);
        return;
      }
      // Reduce the most recently added configuration of this dish.
      const keys = Object.keys(addonCart).filter((k) => addonCart[k].item.id === item.id);
      const last = keys[keys.length - 1];
      if (last) addEntry(item, addonCart[last].selection, -1);
      return;
    }
    addEntry(item, {}, delta);
  };

  const entryUnitPrice = (entry: { item: MenuItem; selection: ItemSelection }) => {
    try {
      return resolveItemConfiguration(entry.item, entry.selection).unitPrice;
    } catch {
      return entry.item.price;
    }
  };

  const handleUpdateNotes = (itemId: string, notes: string) => {
    setAddonCart((prev) => {
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          notes
        }
      };
    });
  };

  const selectedItemsList = Object.values(addonCart);
  const totalAddonItemsCount = selectedItemsList.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalAddonAmount = selectedItemsList.reduce(
    (acc, curr) => acc + entryUnitPrice(curr) * curr.quantity,
    0
  );

  const filteredItems = menuItems.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.categoryId === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleConfirmAddonOrder = async () => {
    if (selectedItemsList.length === 0) {
      error('Please select at least one dish to add.');
      return;
    }

    setSubmitting(true);
    try {
      const payloadItems = selectedItemsList.map((entry) => ({
        menuItemId: entry.item.id,
        quantity: entry.quantity,
        specialInstructions: entry.notes.trim() || undefined,
        ...(entry.selection.portionId ? { portionId: entry.selection.portionId } : {}),
        ...(entry.selection.addonIds && entry.selection.addonIds.length ? { addonIds: entry.selection.addonIds } : {})
      }));

      const updatedOrder = await OrderApi.addOrderItems(order.id, payloadItems);
      success(`✓ Added ${totalAddonItemsCount} item(s) to Order #${order.orderNumber}! Sent to kitchen.`);
      setAddonCart({});
      onItemsAdded(updatedOrder);
      onClose();
    } catch (err: any) {
      error(err.message || 'Failed to add items to order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="surface-raised !rounded-2xl !shadow-[var(--shadow-float)] max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[var(--brand-soft)] to-white flex items-center justify-between gap-3 shrink-0 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[var(--brand)] border border-[var(--brand-border)] shadow-[var(--shadow-xs)] flex items-center justify-center font-bold text-lg shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="section-title !text-base sm:!text-lg leading-tight">
                Add More Dishes
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Appending to Order <strong>#{order.orderNumber}</strong> • {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--brand-soft)] text-stone-500 hover:text-stone-900 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-3 sm:p-4 bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search appetizers, mains, desserts, beverages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field !pl-9.5 !rounded-full text-xs"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[var(--brand)] border border-[var(--brand)] text-white shadow-[var(--shadow-xs)]'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
              }`}
            >
              All Dishes
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-[var(--brand)] border border-[var(--brand)] text-white shadow-[var(--shadow-xs)] font-bold'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Dish List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-2 text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--brand)]" />
              <p className="text-xs font-medium">Loading restaurant menu...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-stone-400 space-y-1">
              <Utensils className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-xs font-medium text-stone-600">No matching dishes found</p>
              <p className="text-[11px] text-stone-500">Try changing your search term or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredItems.map((dish) => {
                const dishEntries = Object.entries(addonCart).filter(([, e]) => e.item.id === dish.id);
                const qty = dishEntries.reduce((sum, [, e]) => sum + e.quantity, 0);
                const configurable = hasCustomization(dish);
                const noteKey = dishEntries.length === 1 ? dishEntries[0][0] : '';
                return (
                  <div
                    key={dish.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                      qty > 0
                        ? 'bg-[var(--brand-soft)] border-[var(--brand)] shadow-[var(--shadow-xs)] ring-2 ring-[var(--brand-ring-soft)]'
                        : 'bg-white border-stone-200/80 shadow-[var(--shadow-xs)] hover:border-[var(--brand-border)]'
                    }`}
                  >
                    <div className="flex gap-3 items-start">
                      <img
                        src={dish.imageUrl}
                        alt={dish.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-100 bg-stone-100"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              dish.vegetarian ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <h4 className="font-bold text-xs text-stone-900 truncate">{dish.name}</h4>
                        </div>
                        <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{dish.description}</p>
                        <p className="font-mono font-bold text-xs text-[var(--brand-text)] mt-1">
                          {configurable ? `From ${formatCurrency(startingPrice(dish))}` : formatCurrency(dish.price)}
                        </p>
                        {dishEntries.filter(([, e]) => e.selection.portionId || e.selection.addonIds?.length).map(([k, e]) => (
                          <p key={k} className="text-[10.5px] text-stone-600 mt-0.5">
                            {e.quantity}× {describeSelection(resolveItemConfiguration(dish, e.selection))}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Stepper / Add Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      {qty > 0 && noteKey ? (
                        <input
                          type="text"
                          placeholder="Kitchen note (e.g. Extra spicy)..."
                          value={addonCart[noteKey]?.notes || ''}
                          onChange={(e) => handleUpdateNotes(noteKey, e.target.value)}
                          className="flex-1 min-w-0 mr-2 px-2 py-1 text-[11px] bg-white border border-[var(--brand-border)] rounded-lg focus:outline-hidden focus:border-[var(--brand)]"
                        />
                      ) : (
                        <span className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>~{dish.prepTimeMinutes}m prep</span>
                        </span>
                      )}

                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(dish, 1)}
                          className="px-3 py-1.5 bg-[var(--brand-soft)] hover:bg-[var(--brand)] text-[var(--brand-text)] hover:text-white border border-[var(--brand-border)] hover:border-[var(--brand)] rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 bg-white border border-[var(--brand-border)] rounded-full p-0.5 shadow-[var(--shadow-xs)]">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(dish, -1)}
                            className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs text-[var(--brand-text)]">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(dish, 1)}
                            className="w-7 h-7 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white flex items-center justify-center font-bold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Bottom Tray & Confirmation Action */}
        <div className="p-4 bg-[var(--surface-muted)] border-t border-[var(--border-subtle)] shrink-0 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-stone-600 font-medium">Add-on Dishes:</span>
              <span className="font-bold text-stone-900 ml-1.5">
                {totalAddonItemsCount} {totalAddonItemsCount === 1 ? 'Dish' : 'Dishes'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-stone-600 font-medium mr-1.5">Additional Total:</span>
              <span className="font-display font-bold text-xl text-[var(--brand-text)]">
                +{formatCurrency(totalAddonAmount)}
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !min-h-12"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAddonOrder}
              disabled={submitting || totalAddonItemsCount === 0}
              className="lux-btn lux-btn-wine flex-1 !h-auto !py-3 !px-4 !tracking-[0.08em] text-center leading-snug disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                {submitting
                  ? 'Adding to Order & Notifying Kitchen...'
                  : `Confirm Add-on Order (+${formatCurrency(totalAddonAmount)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {customizing && (
        <ItemCustomizerModal
          isOpen={!!customizing}
          onClose={() => setCustomizing(null)}
          item={customizing}
          confirmLabel="Add to Order"
          onConfirm={(selection, qty) => {
            addEntry(customizing, selection, qty);
            setCustomizing(null);
          }}
        />
      )}
    </div>
  );
};
