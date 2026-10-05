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
  const [addonCart, setAddonCart] = useState<Record<string, { item: MenuItem; quantity: number; notes: string }>>({});
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

  const handleUpdateQuantity = (item: MenuItem, delta: number) => {
    setAddonCart((prev) => {
      const current = prev[item.id]?.quantity || 0;
      const next = current + delta;
      const updated = { ...prev };

      if (next <= 0) {
        delete updated[item.id];
      } else {
        updated[item.id] = {
          item,
          quantity: Math.min(20, next),
          notes: prev[item.id]?.notes || ''
        };
      }
      return updated;
    });
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
    (acc, curr) => acc + curr.item.price * curr.quantity,
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
        specialInstructions: entry.notes.trim() || undefined
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-950 to-amber-950 text-white flex items-center justify-between shrink-0 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center font-bold text-lg shrink-0">
              <Utensils className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base sm:text-lg leading-tight">
                Add More Dishes
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Appending to Order <strong>#{order.orderNumber}</strong> • {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-3 sm:p-4 bg-stone-50 border-b border-stone-200 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search appetizers, mains, desserts, beverages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:border-amber-700 focus:outline-hidden"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-amber-800 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
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
                    ? 'bg-amber-800 text-white font-bold shadow-2xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
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
            <div className="py-12 text-center space-y-2 text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-700" />
              <p className="text-xs font-medium">Loading restaurant menu...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-stone-400 space-y-1">
              <Utensils className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-xs font-medium text-stone-600">No matching dishes found</p>
              <p className="text-[11px] text-stone-400">Try changing your search term or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredItems.map((dish) => {
                const qty = addonCart[dish.id]?.quantity || 0;
                return (
                  <div
                    key={dish.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                      qty > 0
                        ? 'bg-amber-50/70 border-amber-400/80 shadow-2xs ring-1 ring-amber-400/30'
                        : 'bg-white border-stone-200/80 hover:border-stone-300'
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
                        <p className="font-mono font-bold text-xs text-amber-950 mt-1">
                          {formatCurrency(dish.price)}
                        </p>
                      </div>
                    </div>

                    {/* Stepper / Add Button */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      {qty > 0 ? (
                        <input
                          type="text"
                          placeholder="Kitchen note (e.g. Extra spicy)..."
                          value={addonCart[dish.id]?.notes || ''}
                          onChange={(e) => handleUpdateNotes(dish.id, e.target.value)}
                          className="flex-1 mr-2 px-2 py-1 text-[11px] bg-white border border-amber-300 rounded-lg focus:outline-hidden"
                        />
                      ) : (
                        <span className="text-[10px] text-stone-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>~{dish.prepTimeMinutes}m prep</span>
                        </span>
                      )}

                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(dish, 1)}
                          className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 bg-white border border-amber-400 rounded-xl p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(dish, -1)}
                            className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs text-amber-950">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(dish, 1)}
                            className="w-6 h-6 rounded-lg bg-amber-800 hover:bg-amber-900 text-white flex items-center justify-center font-bold cursor-pointer"
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
        <div className="p-4 bg-stone-50 border-t border-stone-200 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-stone-500 font-medium">Add-on Dishes:</span>
              <span className="font-bold text-stone-900 ml-1.5">
                {totalAddonItemsCount} {totalAddonItemsCount === 1 ? 'Dish' : 'Dishes'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-stone-500 font-medium mr-1.5">Additional Total:</span>
              <span className="font-serif font-bold text-base text-amber-950">
                +{formatCurrency(totalAddonAmount)}
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 font-bold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAddonOrder}
              disabled={submitting || totalAddonItemsCount === 0}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-800 to-amber-950 hover:from-amber-900 hover:to-black text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                {submitting
                  ? 'Adding to Order & Notifying Kitchen...'
                  : `Confirm Add-on Order (+${formatCurrency(totalAddonAmount)})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
