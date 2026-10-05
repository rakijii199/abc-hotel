/**
 * Menu Item Card & Dish Detail Modal
 */
import React, { useState } from 'react';
import { Plus, Minus, Check, Clock, Flame, Info, Eye } from 'lucide-react';
import { MenuItem } from '../../types/index.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { DietaryBadge, Modal } from '../common/Footer.tsx';
import { RestaurantImage } from '../common/RestaurantImage.tsx';
import { useCart } from '../../context/CartContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface MenuItemCardProps {
  item: MenuItem;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { items, addItem, updateQuantity } = useCart();
  const { success } = useToast();
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const cartItem = items.find((i) => i.menuItem.id === item.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.available) return;
    addItem(item, 1);
    success(`Added ${item.name} to cart`);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(item.id, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(item.id, quantity - 1);
  };

  return (
    <>
      <div
        onClick={() => setDetailModalOpen(true)}
        className={`group bg-white rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden cursor-pointer ${
          !item.available ? 'opacity-70 grayscale-[30%]' : ''
        }`}
      >
        {/* Dish Image Container */}
        <div className="relative aspect-4/3 overflow-hidden bg-stone-100">
          <RestaurantImage
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            <DietaryBadge
              vegetarian={item.vegetarian}
              spicy={item.spicy}
              spiceLevel={item.spiceLevel}
              isChefSpecial={item.isChefSpecial}
            />

            {!item.available && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-md">
                Sold Out
              </span>
            )}
          </div>

          {/* Quick Prep Time Pill */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-white text-[11px] font-medium">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{item.prepTimeMinutes} mins</span>
          </div>

          {/* Quick Preview Action */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="p-1.5 rounded-full bg-white/90 text-stone-900 text-xs shadow-md flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                {item.categoryName || 'Dishes'}
              </span>
              <span className="text-[11px] font-semibold flex items-center gap-1">
                {item.vegetarian ? (
                  <span className="text-emerald-700 flex items-center gap-1">🟢 Vegetarian</span>
                ) : (
                  <span className="text-rose-700 flex items-center gap-1">🔴 Non-Vegetarian</span>
                )}
              </span>
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900 group-hover:text-amber-800 transition-colors leading-snug mb-1">
              {item.name}
            </h3>
            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed mb-4">
              {item.description}
            </p>
          </div>

          {/* Pricing & Add To Cart Button */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold block">Price</span>
              <span className="text-lg font-bold text-stone-900 font-mono">
                {formatCurrency(item.price)}
              </span>
            </div>

            {item.available ? (
              quantity > 0 ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center bg-amber-700 text-white rounded-xl shadow-xs overflow-hidden"
                >
                  <button
                    onClick={handleDecrement}
                    className="p-2 hover:bg-amber-800 active:bg-amber-900 transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2.5 text-xs font-bold font-mono">{quantity}</span>
                  <button
                    onClick={handleIncrement}
                    className="p-2 hover:bg-amber-800 active:bg-amber-900 transition-colors cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-700 hover:text-white active:bg-amber-800 rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Cart
                </button>
              )
            ) : (
              <span className="text-xs text-stone-400 italic">Unavailable</span>
            )}
          </div>
        </div>
      </div>

      {/* Dish Detail Modal */}
      <DishDetailModal
        item={item}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        quantity={quantity}
        onAdd={handleAdd}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
      />
    </>
  );
};

export const DishDetailModal: React.FC<{
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  quantity: number;
  onAdd: (e: any) => void;
  onIncrement: (e: any) => void;
  onDecrement: (e: any) => void;
}> = ({ item, isOpen, onClose, quantity, onAdd, onIncrement, onDecrement }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item.name} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="relative aspect-16/9 rounded-xl overflow-hidden bg-stone-100 shadow-md">
          <RestaurantImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3">
            <DietaryBadge
              vegetarian={item.vegetarian}
              spicy={item.spicy}
              spiceLevel={item.spiceLevel}
              isChefSpecial={item.isChefSpecial}
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-800">
              {item.categoryName}
            </span>
            <span className="text-2xl font-bold font-mono text-stone-900">
              {formatCurrency(item.price)}
            </span>
          </div>
          <p className="text-stone-600 text-sm leading-relaxed">{item.description}</p>
        </div>

        {/* Nutritional & Preparation Specs */}
        <div className="grid grid-cols-3 gap-3 p-3.5 bg-stone-50 rounded-xl border border-stone-200/70 text-center">
          <div>
            <span className="text-[11px] text-stone-400 block font-medium">Prep Time</span>
            <span className="text-xs font-bold text-stone-800 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {item.prepTimeMinutes} Mins
            </span>
          </div>
          <div>
            <span className="text-[11px] text-stone-400 block font-medium">Energy</span>
            <span className="text-xs font-bold text-stone-800 mt-0.5 block">
              {item.calories ? `${item.calories} kcal` : 'Chef Fresh'}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-stone-400 block font-medium">Spice Meter</span>
            <span className="text-xs font-bold text-stone-800 flex items-center justify-center gap-1 mt-0.5">
              <Flame className="w-3.5 h-3.5 text-orange-600" />
              {item.spiceLevel}
            </span>
          </div>
        </div>

        {/* Allergens Info */}
        {item.allergens && item.allergens.length > 0 && (
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-700">
              <span className="font-semibold text-amber-900">Allergen Notice: </span>
              Contains {item.allergens.join(', ')}. If you have severe dietary allergies, please inform our culinary staff.
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
            Close
          </button>

          {item.available ? (
            quantity > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-500 font-medium">In Cart:</span>
                <div className="flex items-center bg-amber-700 text-white rounded-xl shadow-xs overflow-hidden">
                  <button
                    onClick={onDecrement}
                    className="p-2.5 hover:bg-amber-800 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm font-bold font-mono">{quantity}</span>
                  <button
                    onClick={onIncrement}
                    className="p-2.5 hover:bg-amber-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  onAdd(e);
                  onClose();
                }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add to Cart ({formatCurrency(item.price)})
              </button>
            )
          ) : (
            <span className="px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl">
              Currently Sold Out
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};
