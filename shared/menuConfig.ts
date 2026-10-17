/**
 * Menu item configuration (portions + add-on groups) and the single pricing
 * rule used everywhere: the customer UI previews prices with it and the
 * server re-computes and enforces them when an order is placed.
 *
 *   unit price = selected portion price (or the item's base price) + selected add-on prices
 *   line total = unit price × quantity
 *
 * Pure TypeScript with no runtime dependencies so both the Vite frontend and
 * the Node server can import it.
 */

export interface MenuItemPortion {
  /** Stable id, e.g. "HALF" or "FULL". */
  id: string;
  label: string;
  price: number;
  active: boolean;
}

export interface MenuItemAddon {
  id: string;
  name: string;
  price: number;
  active: boolean;
}

export interface MenuItemAddonGroup {
  id: string;
  name: string;
  /** Customer must pick at least max(1, minSelect) add-ons from this group. */
  required: boolean;
  minSelect: number;
  /** 0 means no upper limit (bounded by the number of add-ons). */
  maxSelect: number;
  active: boolean;
  addons: MenuItemAddon[];
}

export interface ConfigurableMenuItem {
  id: string;
  name: string;
  price: number;
  portions?: MenuItemPortion[];
  addonGroups?: MenuItemAddonGroup[];
}

/** What the customer chose for one cart / order line. */
export interface ItemSelection {
  portionId?: string;
  addonIds?: string[];
}

/** Price snapshot of one chosen add-on, stored on the order line. */
export interface SelectedAddonSnapshot {
  groupId: string;
  groupName: string;
  addonId: string;
  name: string;
  price: number;
}

export interface ResolvedItemConfiguration {
  portionId?: string;
  portionLabel?: string;
  /** Portion price, or the item's base price when it has no portions. */
  basePrice: number;
  addons: SelectedAddonSnapshot[];
  addonsTotal: number;
  unitPrice: number;
}

export const STANDARD_PORTIONS: Array<{ id: string; label: string }> = [
  { id: 'HALF', label: 'Half' },
  { id: 'FULL', label: 'Full' }
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function activePortions(item: ConfigurableMenuItem): MenuItemPortion[] {
  return (item.portions || []).filter((p) => p.active);
}

/** Active groups that still have at least one active add-on. */
export function activeAddonGroups(item: ConfigurableMenuItem): MenuItemAddonGroup[] {
  return (item.addonGroups || [])
    .filter((g) => g.active)
    .map((g) => ({ ...g, addons: g.addons.filter((a) => a.active) }))
    .filter((g) => g.addons.length > 0);
}

/** True when the customer has something to choose before adding the item. */
export function hasCustomization(item: ConfigurableMenuItem): boolean {
  return activePortions(item).length > 0 || activeAddonGroups(item).length > 0;
}

/** Lowest price a customer can pay for the item (for "from ₹X" labels). */
export function startingPrice(item: ConfigurableMenuItem): number {
  const portions = activePortions(item);
  const base = portions.length ? Math.min(...portions.map((p) => p.price)) : item.price;
  const requiredExtra = activeAddonGroups(item)
    .filter((g) => g.required)
    .reduce((sum, g) => {
      const need = Math.max(1, g.minSelect || 0);
      const cheapest = g.addons.map((a) => a.price).sort((a, b) => a - b).slice(0, need);
      return sum + cheapest.reduce((s, p) => s + p, 0);
    }, 0);
  return round2(base + requiredExtra);
}

export function groupLimits(group: MenuItemAddonGroup): { min: number; max: number } {
  const available = group.addons.filter((a) => a.active).length;
  const min = group.required ? Math.max(1, group.minSelect || 0) : Math.max(0, group.minSelect || 0);
  const max = group.maxSelect && group.maxSelect > 0 ? Math.min(group.maxSelect, available) : available;
  return { min: Math.min(min, max), max };
}

export class MenuSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MenuSelectionError';
  }
}

/**
 * Validate a selection against the item's CURRENT configuration and compute
 * its price. Throws MenuSelectionError with a customer-readable message.
 */
export function resolveItemConfiguration(item: ConfigurableMenuItem, selection: ItemSelection = {}): ResolvedItemConfiguration {
  const portions = activePortions(item);
  let basePrice = item.price;
  let portionId: string | undefined;
  let portionLabel: string | undefined;

  if (portions.length > 0) {
    if (!selection.portionId) {
      throw new MenuSelectionError(`Please choose a portion size for "${item.name}".`);
    }
    const portion = portions.find((p) => p.id === selection.portionId);
    if (!portion) {
      throw new MenuSelectionError(`The selected portion for "${item.name}" is no longer available.`);
    }
    basePrice = portion.price;
    portionId = portion.id;
    portionLabel = portion.label;
  } else if (selection.portionId) {
    throw new MenuSelectionError(`"${item.name}" is not offered in portion sizes.`);
  }

  const requested = selection.addonIds || [];
  if (new Set(requested).size !== requested.length) {
    throw new MenuSelectionError(`An add-on was selected more than once for "${item.name}".`);
  }

  const groups = activeAddonGroups(item);
  const addons: SelectedAddonSnapshot[] = [];
  const matched = new Set<string>();

  for (const group of groups) {
    const chosen = group.addons.filter((a) => requested.includes(a.id));
    const { min, max } = groupLimits(group);
    if (chosen.length < min) {
      throw new MenuSelectionError(
        min === 1
          ? `Please choose an option for "${group.name}" (${item.name}).`
          : `Please choose at least ${min} options for "${group.name}" (${item.name}).`
      );
    }
    if (chosen.length > max) {
      throw new MenuSelectionError(`You can choose up to ${max} option${max === 1 ? '' : 's'} for "${group.name}" (${item.name}).`);
    }
    for (const addon of chosen) {
      matched.add(addon.id);
      addons.push({ groupId: group.id, groupName: group.name, addonId: addon.id, name: addon.name, price: addon.price });
    }
  }

  if (matched.size !== requested.length) {
    throw new MenuSelectionError(`One or more selected add-ons for "${item.name}" are no longer available.`);
  }

  const addonsTotal = round2(addons.reduce((sum, a) => sum + a.price, 0));
  return { portionId, portionLabel, basePrice, addons, addonsTotal, unitPrice: round2(basePrice + addonsTotal) };
}

/**
 * Structural validation of a configuration an admin is saving. Returns a list
 * of problems (empty when valid). Ids must be unique within the item.
 */
export function validateMenuConfiguration(config: { portions?: MenuItemPortion[]; addonGroups?: MenuItemAddonGroup[] }): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const unique = (id: string, what: string) => {
    if (ids.has(id)) problems.push(`Duplicate id "${id}" (${what}).`);
    ids.add(id);
  };

  for (const p of config.portions || []) {
    unique(`portion:${p.id}`, 'portion');
    if (!(p.price > 0)) problems.push(`Portion "${p.label}" needs a price greater than zero.`);
  }
  for (const g of config.addonGroups || []) {
    unique(`group:${g.id}`, 'add-on group');
    if (!g.name?.trim()) problems.push('Every add-on group needs a name.');
    if (g.maxSelect > 0 && g.minSelect > g.maxSelect) problems.push(`"${g.name}": minimum selections cannot exceed the maximum.`);
    if (g.active && g.required && g.addons.filter((a) => a.active).length === 0) {
      problems.push(`"${g.name}" is required but has no active add-ons.`);
    }
    if (g.active && g.required && g.addons.filter((a) => a.active).length < Math.max(1, g.minSelect || 0)) {
      problems.push(`"${g.name}" requires ${g.minSelect} selections but has fewer active add-ons.`);
    }
    for (const a of g.addons) {
      unique(`addon:${a.id}`, 'add-on');
      if (!a.name?.trim()) problems.push(`An add-on in "${g.name}" needs a name.`);
      if (!(a.price >= 0)) problems.push(`Add-on "${a.name}" needs a price of zero or more.`);
    }
  }
  return problems;
}

/** Short human description of a configured line, e.g. "Half · Extra Egg, Extra Gravy". */
export function describeSelection(line: { portionLabel?: string; addons?: Array<{ name: string }> }): string {
  const parts: string[] = [];
  if (line.portionLabel) parts.push(line.portionLabel);
  if (line.addons && line.addons.length) parts.push(line.addons.map((a) => a.name).join(', '));
  return parts.join(' · ');
}

/** Stable key for "the same item with the same choices" (cart line merging). */
export function selectionKey(menuItemId: string, selection: ItemSelection = {}): string {
  const addons = [...(selection.addonIds || [])].sort().join(',');
  return `${menuItemId}|${selection.portionId || ''}|${addons}`;
}
