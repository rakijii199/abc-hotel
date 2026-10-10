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
      <article
        onClick={() => setDetailModalOpen(true)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setDetailModalOpen(true);
          }
        }}
        tabIndex={0}
        aria-label={`${item.name}, ${formatCurrency(item.price)}${item.available ? '' : ', sold out'}. View details`}
        className={`group relative h-full bg-[#fffdf9] border border-stone-200/80 flex flex-col overflow-hidden cursor-pointer transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-amber-300/70 hover:shadow-[0_30px_60px_-30px_rgba(26,23,21,0.45)] ${
          !item.available ? 'opacity-75' : ''
        }`}
      >
        {/* Dish Image Container */}
        <div className="relative aspect-[4/3.4] overflow-hidden bg-stone-100">
          <RestaurantImage
            src={item.imageUrl}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] ${
              !item.available ? 'grayscale-[60%]' : ''
            }`}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-ink/10 pointer-events-none" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-2">
            <DietaryBadge
              vegetarian={item.vegetarian}
              spicy={item.spicy}
              spiceLevel={item.spiceLevel}
              isChefSpecial={item.isChefSpecial}
            />

            {!item.available && (
              <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-ink/85 text-ivory backdrop-blur-sm shrink-0">
                Sold Out
              </span>
            )}
          </div>

          {/* Quick Prep Time Pill */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/70 backdrop-blur-md text-ivory text-[10.5px] font-medium">
            <Clock className="w-3 h-3 text-gold" />
            <span>{item.prepTimeMinutes} mins</span>
          </div>

          {/* Quick Preview Action */}
          <div className="absolute bottom-3 right-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
            <span className="h-7 px-3 rounded-full bg-ivory/95 text-ink text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Details
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 truncate">
              {item.categoryName || 'Dishes'}
            </span>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-semibold ${
                item.vegetarian ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              <span
                className={`w-3 h-3 border flex items-center justify-center ${
                  item.vegetarian ? 'border-emerald-600' : 'border-rose-600'
                }`}
                aria-hidden="true"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${item.vegetarian ? 'bg-emerald-600' : 'bg-rose-600'}`} />
              </span>
              {item.vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
            </span>
          </div>
          <h3 className="lux-display !font-medium text-[1.6rem] !leading-[1.1] text-stone-900 mt-2.5 transition-colors group-hover:text-wine">
            {item.name}
          </h3>
          <p className="text-[13px] text-stone-500 line-clamp-2 leading-relaxed mt-2 mb-5">
            {item.description}
          </p>

          {/* Pricing & Add To Cart Button */}
          <div className="mt-auto pt-4 border-t border-stone-200/70 flex items-center justify-between gap-3">
            <span className="text-lg font-semibold text-stone-900 font-mono">
              {formatCurrency(item.price)}
            </span>

            {item.available ? (
              quantity > 0 ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center h-10 bg-ink text-ivory rounded-full overflow-hidden"
                >
                  <button
                    onClick={handleDecrement}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-6 text-center text-xs font-bold font-mono" aria-live="polite">{quantity}</span>
                  <button
                    onClick={handleIncrement}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAdd}
                  className="h-10 flex items-center gap-1.5 px-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink border border-ink/80 hover:bg-ink hover:text-ivory active:scale-[0.97] rounded-full transition-all duration-300 cursor-pointer"
                  aria-label={`Add ${item.name} to cart`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )
            ) : (
              <span className="text-xs text-stone-400 italic">Unavailable</span>
            )}
          </div>
        </div>
      </article>

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
            <span className="text-[10px] uppercase tracking-[0.24em] font-bold text-amber-700">
              {item.categoryName}
            </span>
            <span className="text-2xl font-semibold font-mono text-stone-900">
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
            className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
          >
            Close
          </button>

          {item.available ? (
            quantity > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-500 font-medium">In Cart:</span>
                <div className="flex items-center bg-ink text-ivory rounded-full overflow-hidden">
                  <button
                    onClick={onDecrement}
                    className="p-3 hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm font-bold font-mono">{quantity}</span>
                  <button
                    onClick={onIncrement}
                    className="p-3 hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Increase quantity"
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
                className="lux-btn lux-btn-wine"
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
