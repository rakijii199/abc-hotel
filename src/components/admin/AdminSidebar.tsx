/**
 * Admin Sidebar Navigation Component
 * Modern, High-End Light Theme for Staff Operations
 */
import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  ShoppingBag,
  UtensilsCrossed,
  Layers,
  SquareDashedBottom,
  LogOut,
  ChefHat,
  Send,
  CreditCard,
  QrCode,
  Receipt,
  Building2,
  PieChart,
  Users,
  Truck,
  Warehouse
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AccessLevel, SectionId, hasAccess, roleDisplayName } from '../../../shared/accessControl.ts';
import { BrandIcon, BrandName } from '../common/BrandMark.tsx';

export type AdminTab =
  | 'DASHBOARD'
  | 'EMPLOYEES'
  | 'BILLING'
  | 'INVENTORY'
  | 'POS_ORDER'
  | 'KITCHEN_KDS'
  | 'DELIVERY_PORTAL'
  | 'BOOKINGS'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'MENU'
  | 'CATEGORIES'
  | 'TABLES'
  | 'PAYMENT_SETTINGS'
  | 'BILLING_SETTINGS'
  | 'BILLING_REPORTS';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  onLogout: () => void;
  unreadCount?: number;
  pendingOrdersCount?: number;
  pendingBookingsCount?: number;
}

export interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
  badgeColor?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Which access-control section each staff tab belongs to. */
export const TAB_SECTIONS: Record<AdminTab, SectionId[]> = {
  DASHBOARD: ['DASHBOARD'],
  EMPLOYEES: ['USERS', 'ROLES', 'PRIVILEGES', 'ACCESS_CONTROL'],
  BILLING: ['BILLING'],
  INVENTORY: ['INVENTORY'],
  POS_ORDER: ['POS'],
  KITCHEN_KDS: ['KITCHEN'],
  DELIVERY_PORTAL: ['DELIVERY'],
  BOOKINGS: ['BOOKINGS'],
  ORDERS: ['ORDERS'],
  PAYMENTS: ['PAYMENTS'],
  MENU: ['MENU'],
  CATEGORIES: ['MENU'],
  TABLES: ['TABLES'],
  PAYMENT_SETTINGS: ['SETTINGS'],
  BILLING_SETTINGS: ['SETTINGS'],
  BILLING_REPORTS: ['REPORTS']
};

/** True when the resolved access allows viewing the tab (any of its sections). */
export function canViewTab(access: Partial<Record<SectionId, AccessLevel>> | undefined, tab: AdminTab): boolean {
  return TAB_SECTIONS[tab].some((section) => hasAccess(access?.[section], 'VIEW'));
}

/**
 * Navigation items the signed-in user may open, filtered by their resolved
 * section access (the same access the API enforces). Shared by the desktop
 * top navigation and the mobile drawer.
 */
export function getAdminNavSections(
  access: Partial<Record<SectionId, AccessLevel>> | undefined,
  counts: { pendingOrdersCount?: number; pendingBookingsCount?: number } = {}
): NavSection[] {
  const pendingOrdersCount = counts.pendingOrdersCount || 0;
  const pendingBookingsCount = counts.pendingBookingsCount || 0;

  const rawNavSections: NavSection[] = [
    {
      title: 'Main',
      items: [{ id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard }]
    },
    {
      title: 'POS & Orders',
      items: [
        { id: 'POS_ORDER', label: 'Take Order', icon: Send },
        {
          id: 'ORDERS',
          label: 'View Orders',
          icon: ShoppingBag,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined
        }
      ]
    },
    {
      title: 'Operations',
      items: [
        {
          id: 'BOOKINGS',
          label: 'Reservations',
          icon: Calendar,
          badge: pendingBookingsCount > 0 ? pendingBookingsCount : undefined
        },
        { id: 'TABLES', label: 'Table QR Config', icon: SquareDashedBottom }
      ]
    },
    {
      title: 'Menu',
      items: [
        { id: 'MENU', label: 'Menu Items', icon: UtensilsCrossed },
        { id: 'CATEGORIES', label: 'Categories', icon: Layers },
        { id: 'INVENTORY', label: 'Inventory', icon: Warehouse }
      ]
    },
    {
      title: 'Finance',
      items: [
        { id: 'BILLING', label: 'Billing & Invoices', icon: Receipt },
        { id: 'PAYMENTS', label: 'Payments', icon: CreditCard },
        { id: 'BILLING_REPORTS', label: 'Reports', icon: PieChart }
      ]
    },
    {
      title: 'Staff',
      items: [{ id: 'EMPLOYEES', label: 'User Management', icon: Users }]
    },
    {
      title: 'Settings',
      items: [
        { id: 'PAYMENT_SETTINGS', label: 'Payment Settings', icon: QrCode },
        { id: 'BILLING_SETTINGS', label: 'Billing Settings', icon: Building2 }
      ]
    }
  ];

  return rawNavSections
    .map((section) => ({ ...section, items: section.items.filter((item) => canViewTab(access, item.id)) }))
    .filter((section) => section.items.length > 0);
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  unreadCount = 0,
  pendingOrdersCount = 0,
  pendingBookingsCount = 0
}) => {
  const { user } = useAuth();
  const navSections = getAdminNavSections(user?.access, { pendingOrdersCount, pendingBookingsCount });

  const roleLabel =
    `${roleDisplayName(user?.role)} · ${user?.effectivePrivilege === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}`;

  return (
    <aside className="w-full h-full bg-gradient-to-b from-[var(--surface)] to-[var(--surface-muted)] text-stone-600 flex flex-col justify-between shrink-0 border-r border-stone-200/80 select-none relative overflow-hidden">
      {/* Soft warm glow behind the brand */}
      <div className="absolute -top-28 -left-20 w-72 h-72 rounded-full bg-amber-200/30 blur-[90px] pointer-events-none" aria-hidden="true" />

      <div className="relative flex-1 overflow-y-auto min-h-0 scrollbar-none">
        {/* Brand Header */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-3">
          <BrandIcon size="md" />
          <BrandName size="md" className="min-w-0" />
        </div>
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-stone-300/80 to-transparent" />

        {/* Navigation Items */}
        <nav className="px-3 py-4 space-y-4" aria-label="Operations">
          {navSections.map((sec, secIdx) => (
            <div key={sec.title || secIdx} className="space-y-0.5">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">{sec.title}</p>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as AdminTab)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative w-full text-left pl-3 pr-3 py-1.5 rounded-xl text-[13px] transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
                      isActive
                        ? 'bg-amber-50 text-amber-950 font-semibold ring-1 ring-amber-200/90 shadow-[0_8px_20px_-16px_var(--brand-ring)]'
                        : 'text-stone-600 font-medium hover:text-stone-900 hover:bg-stone-900/[0.04]'
                    }`}
                  >
                    {/* Active indicator */}
                    <span
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-amber-500 to-amber-700 transition-opacity duration-200 ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center transition-colors duration-200 ${
                          isActive
                            ? 'bg-white text-amber-700 shadow-[0_2px_8px_-4px_var(--brand-ring)]'
                            : 'text-stone-400 group-hover:text-amber-700 group-hover:bg-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>

                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full shrink-0 flex items-center justify-center border ${
                          isActive ? 'bg-white text-amber-900 border-amber-200' : 'bg-amber-100/70 text-amber-900 border-amber-200/70'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Signed-in staff card */}
      {user && (
        <div className="relative p-3 border-t border-stone-200/80 bg-white/40">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-stone-200/80 shadow-[0_8px_20px_-18px_rgba(26,23,21,0.5)]">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-white flex items-center justify-center text-sm font-bold shrink-0 ring-2 ring-white shadow-sm">
              {user.firstName?.[0] || 'S'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-stone-900 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-700 font-semibold truncate">{roleLabel}</p>
            </div>
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
