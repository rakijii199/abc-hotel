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
import { ItemCustomizerModal, ItemCustomizerPanel } from './ItemCustomizer.tsx';
import { ItemSelection, describeSelection, hasCustomization, resolveItemConfiguration, selectionKey, startingPrice } from '../../../shared/menuConfig.ts';

interface MenuItemCardProps {
  item: MenuItem;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { items, addItem, updateQuantity } = useCart();
  const { success } = useToast();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Items with portions/add-ons are chosen through the customizer; each set of
  // choices is its own cart line, so the card shows the total across lines.
  const configurable = hasCustomization(item);
  const itemLines = items.filter((i) => i.menuItem.id === item.id);
  const quantity = itemLines.reduce((sum, i) => sum + i.quantity, 0);
  const simpleLineId = selectionKey(item.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.available) return;
    if (configurable) {
      setCustomizerOpen(true);
      return;
    }
    addItem(item, 1);
    success(`Added ${item.name} to cart`);
  };

  const handleCustomized = (selection: ItemSelection, qty: number) => {
    addItem(item, qty, undefined, selection);
    const label = describeSelection(resolveItemConfiguration(item, selection));
    success(`Added ${qty} × ${item.name}${label ? ` (${label})` : ''} to cart`);
    setCustomizerOpen(false);
    setDetailModalOpen(false);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (configurable) {
      setCustomizerOpen(true);
      return;
    }
    updateQuantity(simpleLineId, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    const last = itemLines[itemLines.length - 1];
    if (last) updateQuantity(last.lineId, last.quantity - 1);
  };

  const priceLabel = configurable ? `From ${formatCurrency(startingPrice(item))}` : formatCurrency(item.price);

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
        className={`group surface lift relative h-full !rounded-2xl flex flex-col overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring-soft)] ${
          !item.available ? 'opacity-75' : ''
        }`}
      >
        {/* Dish Image Container */}
        <div className="relative aspect-[4/3.4] overflow-hidden bg-stone-100 lux-zoom">
          <RestaurantImage
            src={item.imageUrl}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] ${
              !item.available ? 'grayscale-[60%]' : ''
            }`}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent pointer-events-none" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-2">
            <DietaryBadge
              vegetarian={item.vegetarian}
              spicy={item.spicy}
              spiceLevel={item.spiceLevel}
              isChefSpecial={item.isChefSpecial}
            />

            {!item.available && (
              <span className="badge badge-danger !bg-white/95 uppercase tracking-wider !text-[10px] font-bold shadow-[var(--shadow-xs)] shrink-0">
                Sold Out
              </span>
            )}
          </div>

          {/* Quick Prep Time Pill */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-stone-800 text-[10.5px] font-semibold shadow-[var(--shadow-xs)]">
            <Clock className="w-3 h-3 text-[var(--brand)]" />
            <span>{item.prepTimeMinutes} mins</span>
          </div>

          {/* Quick Preview Action */}
          <div className="absolute bottom-3 right-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
            <span className="h-7 px-3 rounded-full bg-white/95 text-[var(--brand-text)] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[var(--shadow-xs)]">
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
              className={`badge shrink-0 !text-[10px] ${
                item.vegetarian ? 'badge-success' : 'badge-danger'
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
          <h3 className="lux-display !font-medium text-[1.6rem] !leading-[1.1] text-stone-900 mt-2.5 transition-colors group-hover:text-[var(--brand-text)]">
            {item.name}
          </h3>
          <p className="text-[13px] text-stone-600 line-clamp-2 leading-relaxed mt-2 mb-5">
            {item.description}
          </p>

          {/* Pricing & Add To Cart Button */}
          <div className="mt-auto pt-4 border-t border-stone-200/70 flex items-center justify-between gap-3">
            <span className="text-lg font-bold text-[var(--brand-text)] font-mono">
              {priceLabel}
            </span>

            {item.available ? (
              quantity > 0 ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center h-10 bg-[var(--brand)] text-white rounded-full overflow-hidden shadow-[var(--shadow-xs)]"
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
                  className="h-10 flex items-center gap-1.5 px-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--brand-text)] bg-[var(--brand-soft)] border border-[var(--brand-border)] hover:bg-[var(--brand)] hover:border-[var(--brand)] hover:text-white active:scale-[0.97] rounded-full transition-all duration-300 cursor-pointer"
                  aria-label={configurable ? `Customize and add ${item.name}` : `Add ${item.name} to cart`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )
            ) : (
              <span className="badge">Unavailable</span>
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
        onCustomized={configurable ? handleCustomized : undefined}
      />

      {configurable && (
        <ItemCustomizerModal
          isOpen={customizerOpen}
          onClose={() => setCustomizerOpen(false)}
          item={item}
          onConfirm={handleCustomized}
        />
      )}
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
  /** Set for configurable items: the detail view shows the customizer inline. */
  onCustomized?: (selection: ItemSelection, quantity: number) => void;
}> = ({ item, isOpen, onClose, quantity, onAdd, onIncrement, onDecrement, onCustomized }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item.name} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-stone-100 shadow-[var(--shadow-card)]">
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
            <span className="text-2xl font-bold font-mono text-[var(--brand-text)]">
              {onCustomized ? `From ${formatCurrency(startingPrice(item))}` : formatCurrency(item.price)}
            </span>
          </div>
          <p className="text-stone-600 text-sm leading-relaxed">{item.description}</p>
        </div>

        {/* Nutritional & Preparation Specs */}
        <div className="grid grid-cols-3 gap-3 p-3.5 bg-[var(--surface-muted)] rounded-xl border border-[var(--border-subtle)] text-center">
          <div>
            <span className="text-[11px] text-stone-500 block font-medium">Prep Time</span>
            <span className="text-xs font-bold text-stone-800 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {item.prepTimeMinutes} Mins
            </span>
          </div>
          <div>
            <span className="text-[11px] text-stone-500 block font-medium">Energy</span>
            <span className="text-xs font-bold text-stone-800 mt-0.5 block">
              {item.calories ? `${item.calories} kcal` : 'Chef Fresh'}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-stone-500 block font-medium">Spice Meter</span>
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

        {/* Configurable items: choose portion/add-ons right here */}
        {onCustomized && item.available && (
          <div className="pt-4 border-t border-stone-100">
            <ItemCustomizerPanel key={String(isOpen)} item={item} onConfirm={onCustomized} />
          </div>
        )}

        {/* Action Button */}
        <div className={`pt-4 border-t border-stone-100 flex items-center justify-between ${onCustomized && item.available ? 'hidden' : ''}`}>
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
                <div className="flex items-center bg-[var(--brand)] text-white rounded-full overflow-hidden shadow-[var(--shadow-xs)]">
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
            <span className="badge badge-danger !px-4 !py-2 !text-sm">
              Currently Sold Out
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};
