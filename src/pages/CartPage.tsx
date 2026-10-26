/**
 * Shopping Cart Page with Quantities, Promo Code, and Cost Breakdown
 * High-End Luxury Dining UI with clean typography, refined cards, and seamless responsive layout.
 */
import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  UtensilsCrossed,
  ShieldCheck,
  Check,
  Sparkles,
  MessageSquare,
  ArrowLeft,
  ChefHat,
  Flame,
  Percent,
  Info
} from 'lucide-react';
import { priceCartLine, useCart } from '../context/CartContext.tsx';
import { MenuApi } from '../api/index.ts';
import { ItemCustomizerModal } from '../components/menu/ItemCustomizer.tsx';
import { describeSelection, hasCustomization } from '../../shared/menuConfig.ts';
import type { CartItem } from '../types/index.ts';
import { useToast } from '../context/ToastContext.tsx';
import { formatCurrency } from '../utils/formatters.ts';
import { EmptyState, Modal } from '../components/common/Footer.tsx';

export const CartPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const {
    items,
    itemCount,
    subtotal,
    tax,
    discount,
    discountCode,
    serviceCharge,
    total,
    updateQuantity,
    updateInstructions,
    updateSelection,
    invalidLineIds,
    syncMenuItems,
    removeItem,
    applyDiscount,
    removeDiscount,
    clearCart
  } = useCart();

  const { success, error } = useToast();
  const [editingLine, setEditingLine] = useState<CartItem | null>(null);

  // Prices/options may have changed since items were added: refresh from the live menu.
  useEffect(() => {
    MenuApi.getItems().then(syncMenuItems).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [promoInput, setPromoInput] = useState(discountCode || 'WELCOME10');
  const [clearCartModalOpen, setClearCartModalOpen] = useState(false);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);

  const handleApplyPromo = (codeToApply?: string) => {
    const targetCode = (codeToApply || promoInput).trim().toUpperCase();
    if (!targetCode) return;
    const ok = applyDiscount(targetCode);
    if (ok) {
      setPromoInput(targetCode);
      success(`Promo code "${targetCode}" applied! Discount updated.`);
    } else {
      error(`Invalid promo code "${targetCode}". Try "WELCOME10" or "ROYAL15".`);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center animate-[lux-rise_0.7s_var(--ease-lux)]">
        <div className="relative w-28 h-28 mx-auto mb-8 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full text-gold lux-spin-slow" aria-hidden="true">
            <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.8" />
            <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="1 6" />
          </svg>
          <ShoppingBag className="w-10 h-10 text-amber-700" strokeWidth={1.2} />
        </div>
        <p className="lux-eyebrow text-amber-700 justify-center">Your Dining Cart</p>
        <h2 className="lux-display text-[clamp(2.25rem,5vw,3.5rem)] text-stone-900 mt-4">Your Dining Cart is Empty</h2>
        <p className="text-stone-600 text-sm max-w-md mx-auto mt-4 leading-relaxed">
          You haven't selected any gourmet dishes yet. Explore our royal menu of artisanal appetizers, royal main courses, and handcrafted desserts.
        </p>
        <div className="mt-8">
          <button
            onClick={() => navigate('menu')}
            className="lux-btn lux-btn-wine mx-auto"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Explore Royal Menu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* 1. Header & Breadcrumb Tracker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-[var(--brand-text)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Step 1 of 2 • Order Review</span>
          </div>
          <h1 className="lux-display text-[clamp(2.25rem,4.5vw,3.25rem)] text-stone-900 mt-2">
            Dining Cart <span className="text-stone-500 text-xl font-normal font-sans">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('menu')}
            className="btn btn-secondary"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </button>

          <button
            onClick={() => setClearCartModalOpen(true)}
            className="btn btn-ghost !text-rose-700 hover:!bg-rose-50"
            title="Remove all items from cart"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cart</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2 Cols): Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-3.5">
            {items.map((line) => {
              const { lineId, menuItem, quantity, specialInstructions } = line;
              const pricing = priceCartLine(line);
              const choices = pricing.resolved ? describeSelection(pricing.resolved) : '';
              return (
              <div
                key={lineId}
                className="surface lift !rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 justify-between items-start sm:items-center"
              >
                {/* Item Thumbnail + Info */}
                <div className="flex items-start gap-4 flex-1 w-full min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={menuItem.imageUrl}
                      alt={menuItem.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-stone-100 border border-stone-200/80 shadow-2xs"
                    />
                    {menuItem.vegetarian !== undefined && (
                      <span
                        className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-md bg-white border flex items-center justify-center shadow-xs ${
                          menuItem.vegetarian ? 'border-emerald-600' : 'border-rose-600'
                        }`}
                        title={menuItem.vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            menuItem.vegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}
                        />
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="section-title !text-base sm:!text-lg leading-snug truncate">
                        {menuItem.name}
                      </h3>
                    </div>

                    {choices && (
                      <p className="text-xs text-stone-600" data-testid="cart-line-choices">{choices}</p>
                    )}
                    {pricing.resolved && (pricing.resolved.portionId || pricing.resolved.addons.length > 0) && (
                      <p className="text-[11px] text-stone-500 font-mono">
                        {formatCurrency(pricing.resolved.basePrice)}
                        {pricing.resolved.addons.map((a) => ` + ${formatCurrency(a.price)}`).join('')}
                      </p>
                    )}
                    {pricing.error && (
                      <p className="text-xs font-semibold text-rose-700" role="alert">{pricing.error}</p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span className="font-mono font-bold text-[var(--brand-text)] text-sm">
                        {formatCurrency(pricing.unitPrice)}
                      </span>
                      <span className="text-stone-400">each</span>
                      {hasCustomization(menuItem) && (
                        <button
                          type="button"
                          onClick={() => setEditingLine(line)}
                          className="ml-1 text-[11px] font-bold text-[var(--brand-text)] hover:underline underline-offset-2 cursor-pointer min-h-8 px-1"
                        >
                          {pricing.error ? 'Update choices' : 'Edit choices'}
                        </button>
                      )}
                    </div>

                    {/* Special instruction input */}
                    <div className="pt-1 w-full max-w-md">
                      <div className={`flex items-center gap-2 px-3 rounded-xl border transition-all ${
                        focusedNoteId === lineId
                          ? 'bg-white border-[var(--brand)] ring-2 ring-[var(--brand-ring-soft)]'
                          : 'bg-[var(--surface-muted)] border-[var(--border-subtle)] hover:border-[var(--brand-border)]'
                      }`}>
                        <MessageSquare className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Add kitchen note (e.g., less spicy, extra lemon)..."
                          value={specialInstructions || ''}
                          onFocus={() => setFocusedNoteId(lineId)}
                          onBlur={() => setFocusedNoteId(null)}
                          onChange={(e) => updateInstructions(lineId, e.target.value)}
                          className="text-xs bg-transparent text-stone-800 w-full min-h-10 focus:outline-hidden placeholder:text-stone-400 placeholder:text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quantity Stepper & Line Total */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
                  {/* Stepper */}
                  <div className="flex items-center bg-[var(--brand-soft)] border border-[var(--brand-border)] rounded-full overflow-hidden shadow-[var(--shadow-xs)]">
                    <button
                      onClick={() => updateQuantity(lineId, quantity - 1)}
                      className="w-10 h-10 flex items-center justify-center text-amber-900 hover:bg-amber-100/80 transition-colors cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold font-mono text-stone-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(lineId, quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center text-amber-900 hover:bg-amber-100/80 transition-colors cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-right min-w-[90px]">
                    <span className="font-display font-bold text-xl text-stone-900 block leading-tight">
                      {formatCurrency(pricing.lineTotal)}
                    </span>
                    <button
                      onClick={() => removeItem(lineId)}
                      className="text-[11px] font-semibold text-stone-500 hover:text-rose-700 transition-colors cursor-pointer mt-0.5 inline-flex items-center min-h-8 px-1 -mr-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {editingLine && (
            <ItemCustomizerModal
              isOpen={!!editingLine}
              onClose={() => setEditingLine(null)}
              item={editingLine.menuItem}
              initialSelection={{ portionId: editingLine.portionId, addonIds: editingLine.addonIds }}
              initialQuantity={editingLine.quantity}
              confirmLabel="Update Item"
              onConfirm={(selection, qty) => {
                updateSelection(editingLine.lineId, selection, qty);
                setEditingLine(null);
                success(`Updated ${editingLine.menuItem.name}`);
              }}
            />
          )}

          {/* Add more dishes banner */}
          <div className="pt-2">
            <button
              onClick={() => navigate('menu')}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-dashed border-stone-300 hover:border-[var(--brand-border)] text-xs font-bold text-stone-700 hover:text-[var(--brand-text)] bg-white/60 hover:bg-[var(--brand-soft)] flex items-center justify-center sm:justify-start gap-2.5 transition-all cursor-pointer shadow-2xs"
            >
              <UtensilsCrossed className="w-4 h-4 text-amber-700" />
              <span>+ Add more gourmet dishes from menu</span>
            </button>
          </div>

          {/* Luxury Dining Guarantee Card */}
          <div className="p-4 bg-gradient-to-r from-[var(--brand-soft)] via-white to-white rounded-2xl border border-[var(--brand-border)] flex items-center gap-3 text-xs text-stone-700 shadow-[var(--shadow-xs)]">
            <div className="w-9 h-9 rounded-xl bg-white border border-[var(--brand-border)] text-[var(--brand)] flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <p className="font-bold text-stone-900 text-xs">Fresh Culinary Preparation</p>
              <p className="text-[11px] text-stone-600">
                All dishes are cooked freshly upon order placement by our executive culinary masters.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Order Summary */}
        <div className="lg:col-span-1 space-y-4 sticky top-24">
          <div className="surface-raised !rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="label-caps !text-[var(--brand-text)]">
                Payment Breakdown
              </span>
              <h2 className="section-title mt-1">
                Order Summary
              </h2>
            </div>

            {/* Promo Code Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-700" />
                <span>Promo / Coupon Code</span>
              </label>

              <form onSubmit={(e) => { e.preventDefault(); handleApplyPromo(); }} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter WELCOME10"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="field flex-1 min-w-0 !rounded-xl text-xs font-mono uppercase text-stone-900 placeholder:text-stone-400"
                />
                <button
                  type="submit"
                  className="btn btn-primary shrink-0"
                >
                  Apply
                </button>
              </form>

              {/* Quick promo chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-stone-500 font-medium">Offers:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPromo('WELCOME10')}
                  className="px-2.5 min-h-8 rounded-full bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] text-[10px] font-mono font-semibold text-[var(--brand-text)] border border-dashed border-[var(--brand-border)] transition-colors cursor-pointer"
                >
                  WELCOME10 (-10%)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPromo('ROYAL15')}
                  className="px-2.5 min-h-8 rounded-full bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] text-[10px] font-mono font-semibold text-[var(--brand-text)] border border-dashed border-[var(--brand-border)] transition-colors cursor-pointer"
                >
                  ROYAL15 (-15%)
                </button>
              </div>

              {discountCode && (
                <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 animate-in fade-in duration-150">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Code '{discountCode}' Active</span>
                  </span>
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="text-stone-500 hover:text-rose-700 font-bold cursor-pointer transition-colors min-h-8 px-1 -mr-1"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Breakdown List */}
            <div className="space-y-2.5 text-xs text-stone-600 border-t border-stone-100 pt-4">
              <div className="flex justify-between items-center">
                <span>Items Subtotal</span>
                <span className="font-mono font-bold text-stone-900">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-semibold">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    <span>Special Discount ({discountCode})</span>
                  </span>
                  <span className="font-mono font-bold">-{formatCurrency(discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <span>GST Tax (5%)</span>
                </span>
                <span className="font-mono font-medium text-stone-900">
                  {formatCurrency(tax)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>Restaurant Service Fee</span>
                <span className="font-mono font-medium text-stone-900">
                  {formatCurrency(serviceCharge)}
                </span>
              </div>

              <div className="flex justify-between items-baseline text-base font-bold text-stone-900 pt-3.5 mt-1 border-t border-dashed border-[var(--brand-border)]">
                <span className="font-display text-lg text-stone-900">Grand Total</span>
                <span className="font-display text-3xl font-bold text-[var(--brand-text)]">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Proceed to Checkout CTA */}
            <button
              onClick={() => {
                if (invalidLineIds.length > 0) {
                  error('Some items need their choices updated before checkout.');
                  return;
                }
                navigate('checkout');
              }}
              className="lux-btn lux-btn-wine w-full !min-h-[3.25rem] group"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-1 justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Instant kitchen dispatch with live order tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Cart Confirmation Modal */}
      <Modal
        isOpen={clearCartModalOpen}
        onClose={() => setClearCartModalOpen(false)}
        title="Clear Dining Cart"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-stone-600">
          <p className="leading-relaxed">
            Are you sure you want to remove all items from your dining cart? This action will reset your selected gourmet meals.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              onClick={() => setClearCartModalOpen(false)}
              className="btn btn-ghost"
            >
              Keep Items
            </button>
            <button
              onClick={() => {
                clearCart();
                setClearCartModalOpen(false);
              }}
              className="btn btn-danger"
            >
              Clear Entire Cart
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
