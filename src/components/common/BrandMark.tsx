/**
 * ABC Hotel logo: concierge-bell icon on a plum tile + "ABC HOTEL" wordmark.
 * One mark for the website, staff suite, kitchen, delivery and login pages.
 */
import React from 'react';
import { ConciergeBell } from 'lucide-react';

const TILE = {
  sm: { box: 'w-9 h-9 rounded-xl', icon: 'w-[18px] h-[18px]', text: 'text-lg' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5', text: 'text-lg sm:text-xl' },
  lg: { box: 'w-12 h-12 rounded-2xl', icon: 'w-6 h-6', text: 'text-2xl sm:text-3xl' }
} as const;

type Size = keyof typeof TILE;

export const BrandIcon: React.FC<{ size?: Size; className?: string }> = ({ size = 'md', className = '' }) => (
  <span
    className={`${TILE[size].box} shrink-0 flex items-center justify-center text-white bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--brand-hover)] shadow-[0_8px_18px_-8px_var(--brand-ring)] ${className}`}
    aria-hidden="true"
  >
    <ConciergeBell className={TILE[size].icon} strokeWidth={2} />
  </span>
);

export const BrandName: React.FC<{ size?: Size; className?: string }> = ({ size = 'md', className = '' }) => (
  <span className={`font-display font-semibold text-[var(--brand)] ${TILE[size].text} tracking-[0.14em] leading-none whitespace-nowrap ${className}`}>
    ABC HOTEL
  </span>
);
