/**
 * Shopping Cart Page with Quantities, Promo Code, and Cost Breakdown
 * High-End Luxury Dining UI with clean typography, refined cards, and seamless responsive layout.
 */
import React, { useState } from 'react';
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
import { useCart } from '../context/CartContext.tsx';
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
    removeItem,
    applyDiscount,
    removeDiscount,
    clearCart
  } = useCart();

  const { success, error } = useToast();
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
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 mb-6 shadow-sm">
          <ShoppingBag className="w-12 h-12 stroke-[1.5]" />
        </div>
        <h2 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">Your Dining Cart is Empty</h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto mt-2 leading-relaxed">
          You haven't selected any gourmet dishes yet. Explore our royal menu of artisanal appetizers, royal main courses, and handcrafted desserts.
        </p>
        <div className="mt-8">
          <button
            onClick={() => navigate('menu')}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-800 to-stone-900 hover:from-amber-900 hover:to-black text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 mx-auto cursor-pointer"
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
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-amber-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Step 1 of 2 • Order Review</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 mt-1">
            Dining Cart <span className="text-stone-500 text-xl font-normal font-sans">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('menu')}
            className="text-xs font-semibold text-stone-700 hover:text-stone-900 flex items-center gap-1.5 transition-all cursor-pointer px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200/60 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </button>

          <button
            onClick={() => setClearCartModalOpen(true)}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition-all cursor-pointer px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 shadow-2xs"
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
            {items.map(({ menuItem, quantity, specialInstructions }) => (
              <div
                key={menuItem.id}
                className="bg-white rounded-3xl border border-stone-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 sm:gap-5 justify-between items-start sm:items-center"
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
                      <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 leading-snug truncate">
                        {menuItem.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span className="font-mono font-bold text-stone-900 text-sm">
                        {formatCurrency(menuItem.price)}
                      </span>
                      <span className="text-stone-400">each</span>
                    </div>

                    {/* Special instruction input */}
                    <div className="pt-1 w-full max-w-md">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                        focusedNoteId === menuItem.id
                          ? 'bg-white border-amber-600 ring-2 ring-amber-600/20'
                          : 'bg-stone-50/80 border-stone-200/90 hover:border-stone-300'
                      }`}>
                        <MessageSquare className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Add kitchen note (e.g., less spicy, extra lemon)..."
                          value={specialInstructions || ''}
                          onFocus={() => setFocusedNoteId(menuItem.id)}
                          onBlur={() => setFocusedNoteId(null)}
                          onChange={(e) => updateInstructions(menuItem.id, e.target.value)}
                          className="text-xs bg-transparent text-stone-800 w-full focus:outline-hidden placeholder:text-stone-400 placeholder:text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quantity Stepper & Line Total */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
                  {/* Stepper */}
                  <div className="flex items-center bg-amber-50/90 border border-amber-200/90 rounded-2xl overflow-hidden shadow-2xs">
                    <button
                      onClick={() => updateQuantity(menuItem.id, quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-amber-900 hover:bg-amber-100/80 transition-colors cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold font-mono text-stone-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(menuItem.id, quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-amber-900 hover:bg-amber-100/80 transition-colors cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-right min-w-[90px]">
                    <span className="font-serif font-bold text-lg text-stone-900 block leading-tight">
                      {formatCurrency(menuItem.price * quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(menuItem.id)}
                      className="text-[11px] font-semibold text-stone-400 hover:text-rose-600 transition-colors cursor-pointer mt-0.5 inline-block"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add more dishes banner */}
          <div className="pt-2">
            <button
              onClick={() => navigate('menu')}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-dashed border-stone-300 hover:border-amber-600 text-xs font-bold text-stone-700 hover:text-amber-900 bg-stone-50/50 hover:bg-amber-50/40 flex items-center justify-center sm:justify-start gap-2.5 transition-all cursor-pointer shadow-2xs"
            >
              <UtensilsCrossed className="w-4 h-4 text-amber-700" />
              <span>+ Add more gourmet dishes from menu</span>
            </button>
          </div>

          {/* Luxury Dining Guarantee Card */}
          <div className="p-4 bg-gradient-to-r from-amber-50/70 via-stone-50 to-amber-50/50 rounded-2xl border border-amber-200/70 flex items-center gap-3 text-xs text-stone-700 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-100/80 border border-amber-300/60 text-amber-900 flex items-center justify-center shrink-0">
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
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-sm space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">
                Payment Breakdown
              </span>
              <h2 className="font-serif font-bold text-xl text-stone-900">
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
                  className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono uppercase text-stone-900 focus:outline-hidden focus:border-amber-700 focus:bg-white transition-all placeholder:text-stone-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-stone-900 hover:bg-black text-amber-300 font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all shrink-0"
                >
                  Apply
                </button>
              </form>

              {/* Quick promo chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-stone-400 font-medium">Offers:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPromo('WELCOME10')}
                  className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-amber-100 text-[10px] font-mono font-semibold text-stone-700 border border-stone-200 transition-colors cursor-pointer"
                >
                  WELCOME10 (-10%)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPromo('ROYAL15')}
                  className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-amber-100 text-[10px] font-mono font-semibold text-stone-700 border border-stone-200 transition-colors cursor-pointer"
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
                    className="text-stone-400 hover:text-rose-600 font-bold cursor-pointer transition-colors"
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

              <div className="flex justify-between items-baseline text-base font-bold text-stone-900 pt-3.5 border-t border-stone-200">
                <span className="font-serif text-stone-900">Grand Total</span>
                <span className="font-serif text-2xl font-bold text-amber-950">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Proceed to Checkout CTA */}
            <button
              onClick={() => navigate('checkout')}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-800 via-amber-900 to-stone-950 hover:from-amber-900 hover:to-black text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer group"
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
              className="px-4 py-2 font-medium text-stone-600 hover:text-stone-900 cursor-pointer transition-colors"
            >
              Keep Items
            </button>
            <button
              onClick={() => {
                clearCart();
                setClearCartModalOpen(false);
              }}
              className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Clear Entire Cart
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
