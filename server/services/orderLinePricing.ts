/**
 * Server-side construction of priced order lines. Every ordering path
 * (customer order, staff POS, adding items to an open order) goes through
 * here, so prices always come from the menu configuration in the database
 * and never from the browser.
 */
import { MenuItem, OrderItem } from '../types/index.ts';
import { resolveItemConfiguration } from '../../shared/menuConfig.ts';

export interface RequestedOrderLine {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string;
  portionId?: string;
  addonIds?: string[];
}

export function buildOrderLine(
  dbItem: MenuItem,
  raw: RequestedOrderLine,
  orderId: string,
  extra: Partial<OrderItem> = {}
): OrderItem {
  if (!Number.isInteger(raw.quantity) || raw.quantity <= 0) {
    throw new Error(`Quantity for "${dbItem.name}" must be greater than zero.`);
  }
  // Throws a customer-readable error for missing/invalid portions or add-ons.
  const resolved = resolveItemConfiguration(dbItem, { portionId: raw.portionId, addonIds: raw.addonIds });
  const totalPrice = Math.round(resolved.unitPrice * raw.quantity * 100) / 100;

  return {
    id: `ord-item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    orderId,
    menuItemId: dbItem.id,
    name: dbItem.name,
    imageUrl: dbItem.imageUrl,
    quantity: raw.quantity,
    unitPrice: resolved.unitPrice,
    totalPrice,
    specialInstructions: raw.specialInstructions?.trim() || undefined,
    ...(resolved.portionId ? { portionId: resolved.portionId, portionLabel: resolved.portionLabel } : {}),
    ...(resolved.portionId || resolved.addons.length ? { basePrice: resolved.basePrice } : {}),
    ...(resolved.addons.length ? { addons: resolved.addons } : {}),
    ...extra
  };
}
