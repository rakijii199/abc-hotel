/**
 * Renders full-screen overlays (dialogs, sheets) at the themed root instead of
 * in place. A card with a transform, filter or backdrop-filter (hover lift,
 * glass, enter animation) would otherwise become the containing block of a
 * `position: fixed` overlay and trap it inside that card. The themed root
 * (.lux-ops / .lux / .theme-staff) keeps the design tokens applied.
 */
import React from 'react';
import { createPortal } from 'react-dom';

export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') return <>{children}</>;
  const target = (document.querySelector('.lux-ops, .theme-staff, .lux') as HTMLElement | null) || document.body;
  return createPortal(children, target);
};
