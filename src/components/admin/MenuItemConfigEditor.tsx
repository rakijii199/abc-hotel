/**
 * Admin editor for one menu item's configuration: Half/Full portions with
 * their own prices, add-on groups with selection rules, individual add-ons
 * with prices, enable/disable switches, and a live customer preview.
 *
 * Disabling (rather than deleting) keeps old orders readable; orders store
 * their own snapshot of names and prices, so edits here never change them.
 */
import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp, Eye, Layers, Plus, Trash2 } from 'lucide-react';
import { MenuItem } from '../../types/index.ts';
import {
  MenuItemAddon,
  MenuItemAddonGroup,
  MenuItemPortion,
  STANDARD_PORTIONS,
  validateMenuConfiguration
} from '../../../shared/menuConfig.ts';
import { ItemCustomizerPanel } from '../menu/ItemCustomizer.tsx';

export interface MenuItemConfig {
  portions: MenuItemPortion[];
  addonGroups: MenuItemAddonGroup[];
}

const newId = (prefix: string) =>
  `${prefix}-${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 10)}`;

export function configValidationProblems(config: MenuItemConfig): string[] {
  return validateMenuConfiguration(config);
}

const inputCls = 'w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-700';
const numCls = `${inputCls} font-mono`;

export const MenuItemConfigEditor: React.FC<{
  value: MenuItemConfig;
  onChange: (next: MenuItemConfig) => void;
  /** Used for the preview and as the price of items without portions. */
  previewItem: Pick<MenuItem, 'id' | 'name' | 'price' | 'available'> & Partial<MenuItem>;
}> = ({ value, onChange, previewItem }) => {
  const problems = useMemo(() => validateMenuConfiguration(value), [value]);

  // ---- Portions ----
  const portionFor = (id: string) => value.portions.find((p) => p.id === id);
  const setPortion = (id: string, label: string, patch: Partial<MenuItemPortion> | null) => {
    const existing = portionFor(id);
    let portions: MenuItemPortion[];
    if (patch === null) {
      portions = value.portions.filter((p) => p.id !== id);
    } else if (existing) {
      portions = value.portions.map((p) => (p.id === id ? { ...p, ...patch } : p));
    } else {
      portions = [...value.portions, { id, label, price: previewItem.price || 0, active: true, ...patch }];
      // Keep Half before Full.
      portions.sort((a, b) => STANDARD_PORTIONS.findIndex((s) => s.id === a.id) - STANDARD_PORTIONS.findIndex((s) => s.id === b.id));
    }
    onChange({ ...value, portions });
  };

  // ---- Groups ----
  const updateGroup = (groupId: string, patch: Partial<MenuItemAddonGroup>) =>
    onChange({ ...value, addonGroups: value.addonGroups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) });
  const addGroup = () =>
    onChange({
      ...value,
      addonGroups: [
        ...value.addonGroups,
        { id: newId('grp'), name: value.addonGroups.length === 0 ? 'Extras' : 'New group', required: false, minSelect: 0, maxSelect: 0, active: true, addons: [] }
      ]
    });
  const removeGroup = (groupId: string) => onChange({ ...value, addonGroups: value.addonGroups.filter((g) => g.id !== groupId) });
  const moveGroup = (groupId: string, dir: -1 | 1) => {
    const idx = value.addonGroups.findIndex((g) => g.id === groupId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= value.addonGroups.length) return;
    const next = [...value.addonGroups];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...value, addonGroups: next });
  };

  // ---- Add-ons ----
  const updateAddon = (groupId: string, addonId: string, patch: Partial<MenuItemAddon>) => {
    const group = value.addonGroups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, { addons: group.addons.map((a) => (a.id === addonId ? { ...a, ...patch } : a)) });
  };
  const addAddon = (groupId: string) => {
    const group = value.addonGroups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, { addons: [...group.addons, { id: newId('add'), name: '', price: 0, active: true }] });
  };
  const removeAddon = (groupId: string, addonId: string) => {
    const group = value.addonGroups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, { addons: group.addons.filter((a) => a.id !== addonId) });
  };

  const previewConfigItem = { ...previewItem, portions: value.portions, addonGroups: value.addonGroups } as MenuItem;

  return (
    <section className="space-y-4 pt-3 border-t border-stone-200" aria-labelledby="config-heading">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-amber-700" />
        <h4 id="config-heading" className="section-title text-base">Portions & Add-ons</h4>
        <span className="text-[11px] text-stone-500">Optional — leave empty for a simple dish.</span>
      </div>

      {/* Portions */}
      <div className="space-y-2 p-3 rounded-xl border border-stone-200 bg-[var(--surface-muted)]">
        <p className="text-xs font-bold text-stone-700">Portion sizes</p>
        <p className="text-[11px] text-stone-500">When at least one portion is enabled, customers must pick one and its price replaces the base price.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STANDARD_PORTIONS.map(({ id, label }) => {
            const portion = portionFor(id);
            return (
              <div key={id} className={`p-2.5 rounded-xl border ${portion ? 'bg-white border-amber-300' : 'bg-white/60 border-stone-200'} space-y-2`}>
                <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!portion}
                    onChange={(e) => setPortion(id, label, e.target.checked ? {} : null)}
                    className="w-4 h-4 accent-amber-700"
                    aria-label={`Offer ${label} portion`}
                  />
                  {label} portion
                </label>
                {portion && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="sr-only">{label} price</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={portion.price}
                        onChange={(e) => setPortion(id, label, { price: Number(e.target.value) })}
                        className={numCls}
                        aria-label={`${label} price in rupees`}
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={portion.active}
                        onChange={(e) => setPortion(id, label, { active: e.target.checked })}
                        className="w-4 h-4 accent-emerald-700"
                      />
                      Enabled
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add-on groups */}
      <div className="space-y-3">
        {value.addonGroups.map((group, gi) => (
          <div key={group.id} className={`p-3 rounded-xl border space-y-3 ${group.active ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-80'}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-[160px] space-y-1">
                <label className="text-[11px] font-bold text-stone-600" htmlFor={`grp-name-${group.id}`}>Group name</label>
                <input
                  id={`grp-name-${group.id}`}
                  value={group.name}
                  onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                  placeholder="e.g. Toppings, Sides, Sauces"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-1 pt-5">
                <button type="button" onClick={() => moveGroup(group.id, -1)} disabled={gi === 0} aria-label="Move group up" className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-200 disabled:opacity-30 cursor-pointer">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => moveGroup(group.id, 1)} disabled={gi === value.addonGroups.length - 1} aria-label="Move group down" className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-200 disabled:opacity-30 cursor-pointer">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => removeGroup(group.id)} aria-label={`Delete group ${group.name}`} className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-rose-600 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer min-h-10">
                <input type="checkbox" checked={group.required} onChange={(e) => updateGroup(group.id, { required: e.target.checked, minSelect: e.target.checked ? Math.max(1, group.minSelect) : group.minSelect })} className="w-4 h-4 accent-rose-700" />
                Required
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer min-h-10">
                <input type="checkbox" checked={group.active} onChange={(e) => updateGroup(group.id, { active: e.target.checked })} className="w-4 h-4 accent-emerald-700" />
                Enabled
              </label>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-600" htmlFor={`grp-min-${group.id}`}>Min picks</label>
                <input id={`grp-min-${group.id}`} type="number" min="0" max="30" value={group.minSelect} onChange={(e) => updateGroup(group.id, { minSelect: Math.max(0, Number(e.target.value)) })} className={numCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-600" htmlFor={`grp-max-${group.id}`}>Max picks (0 = any)</label>
                <input id={`grp-max-${group.id}`} type="number" min="0" max="30" value={group.maxSelect} onChange={(e) => updateGroup(group.id, { maxSelect: Math.max(0, Number(e.target.value)) })} className={numCls} />
              </div>
            </div>

            <div className="space-y-2">
              {group.addons.length === 0 && <p className="text-[11px] text-stone-400">No add-ons yet.</p>}
              {group.addons.map((addon) => (
                <div key={addon.id} className="grid grid-cols-[1fr_96px_auto_auto] gap-2 items-center">
                  <input
                    value={addon.name}
                    onChange={(e) => updateAddon(group.id, addon.id, { name: e.target.value })}
                    placeholder="Add-on name (e.g. Extra Cheese)"
                    aria-label="Add-on name"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={addon.price}
                    onChange={(e) => updateAddon(group.id, addon.id, { price: Number(e.target.value) })}
                    aria-label={`Price of ${addon.name || 'add-on'}`}
                    className={numCls}
                  />
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 cursor-pointer" title="Enabled">
                    <input type="checkbox" checked={addon.active} onChange={(e) => updateAddon(group.id, addon.id, { active: e.target.checked })} className="w-4 h-4 accent-emerald-700" aria-label={`${addon.name || 'Add-on'} enabled`} />
                    <span className="hidden sm:inline">On</span>
                  </label>
                  <button type="button" onClick={() => removeAddon(group.id, addon.id)} aria-label={`Delete ${addon.name || 'add-on'}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-400 hover:text-rose-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addAddon(group.id)} className="text-xs font-bold text-amber-800 hover:underline cursor-pointer inline-flex items-center gap-1 min-h-9">
                <Plus className="w-3.5 h-3.5" /> Add add-on
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addGroup}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-600 text-xs font-bold text-stone-700 hover:text-amber-900 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add add-on group
        </button>
      </div>

      {problems.length > 0 && (
        <ul className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold space-y-0.5" role="alert">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}

      {/* Live customer preview */}
      {(value.portions.length > 0 || value.addonGroups.length > 0) && (
        <details className="rounded-xl border border-stone-200 bg-[var(--surface-muted)] p-3" open>
          <summary className="text-xs font-bold text-stone-800 cursor-pointer flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-amber-700" /> Customer preview
          </summary>
          <div className="pt-3">
            {problems.length === 0 ? (
              <ItemCustomizerPanel item={previewConfigItem} preview />
            ) : (
              <p className="text-[11px] text-stone-500">Fix the issues above to see the preview.</p>
            )}
          </div>
        </details>
      )}
    </section>
  );
};
