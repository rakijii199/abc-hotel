/**
 * Shopping Cart Context & State Provider
 *
 * Each cart line is one menu item with one set of choices (portion + add-ons).
 * The same item with different choices is a separate line. Prices are
 * previewed with the shared pricing rule (shared/menuConfig.ts); the server
 * re-computes and enforces them when the order is placed.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem } from '../types/index.ts';
import {
  ItemSelection,
  ResolvedItemConfiguration,
  resolveItemConfiguration,
  selectionKey
} from '../../shared/menuConfig.ts';

export interface CartLinePricing {
  /** Null when the line's choices no longer match the item's configuration. */
  resolved: ResolvedItemConfiguration | null;
  unitPrice: number;
  lineTotal: number;
  error?: string;
}

/** Price one cart line from its menu item's configuration. */
export function priceCartLine(line: CartItem): CartLinePricing {
  try {
    const resolved = resolveItemConfiguration(line.menuItem, { portionId: line.portionId, addonIds: line.addonIds });
    return { resolved, unitPrice: resolved.unitPrice, lineTotal: Math.round(resolved.unitPrice * line.quantity * 100) / 100 };
  } catch (err: any) {
    return { resolved: null, unitPrice: line.menuItem.price, lineTotal: line.menuItem.price * line.quantity, error: err?.message || 'Please update your choices for this item.' };
  }
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  discountCode: string;
  serviceCharge: number;
  total: number;
  /** Lines whose choices must be updated before checkout (e.g. an add-on was disabled). */
  invalidLineIds: string[];
  addItem: (menuItem: MenuItem, quantity?: number, specialInstructions?: string, selection?: ItemSelection) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateInstructions: (lineId: string, specialInstructions: string) => void;
  /** Replace a line's portion/add-ons (merges into an identical existing line). */
  updateSelection: (lineId: string, selection: ItemSelection, quantity?: number) => void;
  applyDiscount: (code: string) => boolean;
  removeDiscount: () => void;
  clearCart: () => void;
  /** Refresh stored item details (prices, options, availability) from the live menu. */
  syncMenuItems: (fresh: MenuItem[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const lineIdFor = (menuItemId: string, selection: ItemSelection = {}) => selectionKey(menuItemId, selection);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('abc_cart');
      const parsed: CartItem[] = saved ? JSON.parse(saved) : [];
      // Carts saved before configurable items had no line ids.
      return parsed
        .filter((i) => i && i.menuItem && i.quantity > 0)
        .map((i) => ({ ...i, lineId: i.lineId || lineIdFor(i.menuItem.id, { portionId: i.portionId, addonIds: i.addonIds }) }));
    } catch {
      return [];
    }
  });

  const [discountCode, setDiscountCode] = useState<string>('WELCOME10');

  useEffect(() => {
    try {
      localStorage.setItem('abc_cart', JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addItem = (menuItem: MenuItem, quantity = 1, specialInstructions?: string, selection: ItemSelection = {}) => {
    if (!menuItem.available || quantity <= 0) {
      return;
    }
    const cleanSelection: ItemSelection = {
      ...(selection.portionId ? { portionId: selection.portionId } : {}),
      ...(selection.addonIds && selection.addonIds.length ? { addonIds: [...selection.addonIds] } : {})
    };
    const lineId = lineIdFor(menuItem.id, cleanSelection);
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.lineId === lineId);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          menuItem,
          quantity: updated[existingIdx].quantity + quantity,
          specialInstructions: specialInstructions !== undefined ? specialInstructions : updated[existingIdx].specialInstructions
        };
        return updated;
      }
      return [...prev, { lineId, menuItem, quantity, specialInstructions, ...cleanSelection }];
    });
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(lineId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i)));
  };

  const updateInstructions = (lineId: string, specialInstructions: string) => {
    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, specialInstructions } : i)));
  };

  const updateSelection = (lineId: string, selection: ItemSelection, quantity?: number) => {
    setItems((prev) => {
      const current = prev.find((i) => i.lineId === lineId);
      if (!current) return prev;
      const cleanSelection: ItemSelection = {
        ...(selection.portionId ? { portionId: selection.portionId } : {}),
        ...(selection.addonIds && selection.addonIds.length ? { addonIds: [...selection.addonIds] } : {})
      };
      const newId = lineIdFor(current.menuItem.id, cleanSelection);
      const newQty = quantity ?? current.quantity;
      const others = prev.filter((i) => i.lineId !== lineId);
      const duplicate = others.find((i) => i.lineId === newId);
      if (duplicate) {
        return others.map((i) => (i.lineId === newId ? { ...i, quantity: i.quantity + newQty } : i));
      }
      const replacement: CartItem = {
        lineId: newId,
        menuItem: current.menuItem,
        quantity: newQty,
        specialInstructions: current.specialInstructions,
        ...cleanSelection
      };
      return prev.map((i) => (i.lineId === lineId ? replacement : i));
    });
  };

  const applyDiscount = (code: string): boolean => {
    const clean = code.trim().toUpperCase();
    if (clean === 'WELCOME10') {
      setDiscountCode('WELCOME10');
      return true;
    }
    return false;
  };

  const removeDiscount = () => {
    setDiscountCode('');
  };

  const clearCart = () => {
    setItems([]);
  };

  const syncMenuItems = (fresh: MenuItem[]) => {
    const byId = new Map(fresh.map((m) => [m.id, m]));
    setItems((prev) => {
      let changed = false;
      const next = prev.map((line) => {
        const current = byId.get(line.menuItem.id);
        if (!current || JSON.stringify(current) === JSON.stringify(line.menuItem)) return line;
        changed = true;
        return { ...line, menuItem: current };
      });
      return changed ? next : prev;
    });
  };

  // Calculations (mirror the server: unit price = portion/base + add-ons)
  const pricedLines = items.map((line) => ({ line, pricing: priceCartLine(line) }));
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Math.round(pricedLines.reduce((sum, { pricing }) => sum + pricing.lineTotal, 0) * 100) / 100;
  const invalidLineIds = pricedLines.filter(({ pricing }) => pricing.error).map(({ line }) => line.lineId);
  const discount = discountCode === 'WELCOME10' && subtotal > 0 ? Math.round(subtotal * 0.10) : 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableAmount * 0.05);
  const serviceCharge = items.length > 0 ? 40 : 0;
  const total = taxableAmount + tax + serviceCharge;

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        tax,
        discount,
        discountCode,
        serviceCharge,
        total,
        invalidLineIds,
        addItem,
        removeItem,
        updateQuantity,
        updateInstructions,
        updateSelection,
        applyDiscount,
        removeDiscount,
        clearCart,
        syncMenuItems
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
