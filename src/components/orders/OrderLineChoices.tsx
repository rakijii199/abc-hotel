/**
 * Shows the portion and add-ons chosen for an order line (e.g. "Half · Extra Egg, Extra Gravy").
 * Renders nothing for simple items and for orders placed before configurable items existed.
 */
import React from 'react';
import { describeSelection } from '../../../shared/menuConfig.ts';

interface LineLike {
  portionLabel?: string;
  addons?: Array<{ name: string }>;
  portionLabelSnapshot?: string;
  addonsSnapshot?: Array<{ name: string }>;
}

export const OrderLineChoices: React.FC<{ item: LineLike; className?: string }> = ({ item, className }) => {
  const text = describeSelection({
    portionLabel: item.portionLabel ?? item.portionLabelSnapshot,
    addons: item.addons ?? item.addonsSnapshot
  });
  if (!text) return null;
  return <span className={className ?? 'block text-[11px] font-normal text-stone-500 leading-snug'}>{text}</span>;
};
