/**
 * Item customization: portion size, add-on groups, quantity and a live price
 * breakdown, driven entirely by the item's configuration. Used by the customer
 * menu/cart, the staff POS and the admin preview.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { MenuItem } from '../../types/index.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { Modal } from '../common/Footer.tsx';
import {
  ItemSelection,
  activeAddonGroups,
  activePortions,
  groupLimits,
  resolveItemConfiguration
} from '../../../shared/menuConfig.ts';

interface ItemCustomizerPanelProps {
  item: MenuItem;
  initialSelection?: ItemSelection;
  initialQuantity?: number;
  maxQuantity?: number;
  confirmLabel?: string;
  /** Preview mode (admin): interactive but without a confirm button. */
  preview?: boolean;
  onConfirm?: (selection: ItemSelection, quantity: number) => void;
}

export const ItemCustomizerPanel: React.FC<ItemCustomizerPanelProps> = ({
  item,
  initialSelection,
  initialQuantity = 1,
  maxQuantity = 20,
  confirmLabel = 'Add to Cart',
  preview = false,
  onConfirm
}) => {
  const portions = activePortions(item);
  const groups = activeAddonGroups(item);

  const defaultPortion = () => {
    if (initialSelection?.portionId && portions.some((p) => p.id === initialSelection.portionId)) return initialSelection.portionId;
    return portions.length === 1 ? portions[0].id : undefined;
  };
  const [portionId, setPortionId] = useState<string | undefined>(defaultPortion);
  const [addonIds, setAddonIds] = useState<string[]>(() =>
    (initialSelection?.addonIds || []).filter((id) => groups.some((g) => g.addons.some((a) => a.id === id)))
  );
  const [quantity, setQuantity] = useState(initialQuantity);
  const [touched, setTouched] = useState(false);

  // Keep the preview in sync while the admin edits the configuration.
  useEffect(() => {
    if (portionId && !portions.some((p) => p.id === portionId)) setPortionId(portions.length === 1 ? portions[0].id : undefined);
    setAddonIds((prev) => prev.filter((id) => groups.some((g) => g.addons.some((a) => a.id === id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(item.portions), JSON.stringify(item.addonGroups)]);

  const selection: ItemSelection = { portionId, addonIds };
  const pricing = useMemo(() => {
    try {
      return { resolved: resolveItemConfiguration(item, selection), error: '' };
    } catch (err: any) {
      return { resolved: null, error: err?.message || 'Please complete your selection.' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, portionId, addonIds.join(',')]);

  const basePrice = portions.find((p) => p.id === portionId)?.price ?? (portions.length ? 0 : item.price);
  const addonsTotal = groups.flatMap((g) => g.addons).filter((a) => addonIds.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const unitPrice = basePrice + addonsTotal;

  const toggleAddon = (groupId: string, addonId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const { max } = groupLimits(group);
    setAddonIds((prev) => {
      if (prev.includes(addonId)) return prev.filter((id) => id !== addonId);
      const inGroup = prev.filter((id) => group.addons.some((a) => a.id === id));
      // Single-choice groups behave like radio buttons.
      if (max === 1) return [...prev.filter((id) => !inGroup.includes(id)), addonId];
      if (inGroup.length >= max) return prev;
      return [...prev, addonId];
    });
  };

  const confirm = () => {
    setTouched(true);
    if (!pricing.resolved) return;
    onConfirm?.({ ...(portionId ? { portionId } : {}), ...(addonIds.length ? { addonIds } : {}) }, quantity);
  };

  return (
    <div className="space-y-5" data-testid="item-customizer">
      {portions.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
            Portion size <span className="text-[10px] text-rose-700 normal-case tracking-normal font-semibold">Required</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {portions.map((p) => {
              const selected = portionId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPortionId(p.id)}
                  className={`min-h-12 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    selected ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-600/25' : 'border-stone-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <span className="font-semibold text-sm text-stone-900">{p.label}</span>
                  <span className="font-mono text-sm text-stone-700">{formatCurrency(p.price)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {groups.map((group) => {
        const { min, max } = groupLimits(group);
        const chosen = group.addons.filter((a) => addonIds.includes(a.id)).length;
        const rule = group.required
          ? min === max ? `Choose ${min}` : `Choose ${min}–${max}`
          : max < group.addons.length ? `Optional · up to ${max}` : 'Optional';
        const short = touched && chosen < min;
        return (
          <fieldset key={group.id} className="space-y-2">
            <legend className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              {group.name}
              <span className={`text-[10px] normal-case tracking-normal font-semibold ${group.required ? 'text-rose-700' : 'text-stone-400'}`}>{rule}</span>
            </legend>
            <div className="space-y-1.5">
              {group.addons.map((a) => {
                const selected = addonIds.includes(a.id);
                const atLimit = !selected && max > 1 && chosen >= max;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role={max === 1 ? 'radio' : 'checkbox'}
                    aria-checked={selected}
                    disabled={atLimit}
                    onClick={() => toggleAddon(group.id, a.id)}
                    className={`w-full min-h-11 px-3 py-2 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      selected ? 'border-amber-600 bg-amber-50' : 'border-stone-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 shrink-0 flex items-center justify-center border ${max === 1 ? 'rounded-full' : 'rounded-md'} ${selected ? 'bg-amber-600 border-amber-600 text-white' : 'border-stone-300 bg-white'}`}>
                        {selected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="text-sm text-stone-800">{a.name}</span>
                    </span>
                    <span className="font-mono text-sm text-stone-600">{a.price > 0 ? `+${formatCurrency(a.price)}` : 'Free'}</span>
                  </button>
                );
              })}
            </div>
            {short && <p className="text-xs font-medium text-rose-700">Please make a selection for {group.name}.</p>}
          </fieldset>
        );
      })}

      {/* Quantity + price breakdown */}
      <div className="rounded-2xl border border-stone-200 bg-[#faf8f5] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Quantity</span>
          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-1">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-100 cursor-pointer">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-mono font-bold" aria-live="polite">{quantity}</span>
            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-100 cursor-pointer">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <dl className="text-sm space-y-1" data-testid="price-breakdown">
          <div className="flex justify-between text-stone-600">
            <dt>{portions.length ? portions.find((p) => p.id === portionId)?.label || 'Portion' : 'Base price'}</dt>
            <dd className="font-mono">{portions.length && !portionId ? '—' : formatCurrency(basePrice)}</dd>
          </div>
          {groups.flatMap((g) => g.addons).filter((a) => addonIds.includes(a.id)).map((a) => (
            <div key={a.id} className="flex justify-between text-stone-600">
              <dt>+ {a.name}</dt>
              <dd className="font-mono">{formatCurrency(a.price)}</dd>
            </div>
          ))}
          <div className="flex justify-between text-stone-800 font-semibold border-t border-stone-200 pt-1.5">
            <dt>Per item</dt>
            <dd className="font-mono">{formatCurrency(unitPrice)}</dd>
          </div>
          <div className="flex justify-between text-stone-900 font-bold text-base">
            <dt>Total ({quantity} × {formatCurrency(unitPrice)})</dt>
            <dd className="font-mono" data-testid="customizer-total">{formatCurrency(unitPrice * quantity)}</dd>
          </div>
        </dl>
      </div>

      {touched && pricing.error && <p className="text-sm font-medium text-rose-700" role="alert">{pricing.error}</p>}

      {!preview && (
        <button
          type="button"
          onClick={confirm}
          disabled={!item.available}
          className="lux-btn lux-btn-wine w-full min-h-12 justify-center disabled:opacity-50"
        >
          {confirmLabel} · {formatCurrency(unitPrice * quantity)}
        </button>
      )}
    </div>
  );
};

interface ItemCustomizerModalProps extends ItemCustomizerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ItemCustomizerModal: React.FC<ItemCustomizerModalProps> = ({ isOpen, onClose, item, ...panel }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Customize ${item.name}`} maxWidth="max-w-lg">
    {/* key resets choices each time the dialog opens for a different line */}
    <ItemCustomizerPanel key={`${item.id}-${isOpen}`} item={item} {...panel} />
  </Modal>
);
