/**
 * Shopping Cart Context & State Provider
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem } from '../types/index.ts';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  discountCode: string;
  serviceCharge: number;
  total: number;
  addItem: (menuItem: MenuItem, quantity?: number, specialInstructions?: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateInstructions: (menuItemId: string, specialInstructions: string) => void;
  applyDiscount: (code: string) => boolean;
  removeDiscount: () => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('abc_cart');
      return saved ? JSON.parse(saved) : [];
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

  const addItem = (menuItem: MenuItem, quantity = 1, specialInstructions?: string) => {
    if (!menuItem.available || quantity <= 0) {
      return;
    }
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.menuItem.id === menuItem.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + quantity,
          specialInstructions: specialInstructions !== undefined ? specialInstructions : updated[existingIdx].specialInstructions
        };
        return updated;
      }
      return [...prev, { menuItem, quantity, specialInstructions }];
    });
  };

  const removeItem = (menuItemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItem.id !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.menuItem.id === menuItemId ? { ...i, quantity } : i))
    );
  };

  const updateInstructions = (menuItemId: string, specialInstructions: string) => {
    setItems((prev) =>
      prev.map((i) => (i.menuItem.id === menuItemId ? { ...i, specialInstructions } : i))
    );
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

  // Calculations
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
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
        addItem,
        removeItem,
        updateQuantity,
        updateInstructions,
        applyDiscount,
        removeDiscount,
        clearCart
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
