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

interface NavItem {
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
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

  const rawNavSections: NavSection[] = [
    {
      title: 'Main',
      items: [
        { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'POS & Orders',
      items: [
        {
          id: 'POS_ORDER',
          label: 'Take Order',
          icon: Send
        },
        {
          id: 'ORDERS',
          label: 'View Orders',
          icon: ShoppingBag,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
          badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200'
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
          badge: pendingBookingsCount > 0 ? pendingBookingsCount : undefined,
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-200'
        },
        {
          id: 'TABLES',
          label: 'Table QR Config',
          icon: SquareDashedBottom
        }
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
      title: 'Staff',
      items: [
        { id: 'EMPLOYEES', label: 'Employees', icon: Users }
      ]
    },
    {
      title: 'Settings',
      items: [
        { id: 'PAYMENT_SETTINGS', label: 'Payment Settings', icon: QrCode }
      ]
    }
  ];

  const managerTabIds: AdminTab[] = [
    'DASHBOARD',
    'POS_ORDER',
    'EMPLOYEES',
    'ORDERS',
    'BOOKINGS',
    'TABLES',
    'MENU',
    'CATEGORIES',
    'INVENTORY',
    'PAYMENT_SETTINGS'
  ];
  const adminTabIds: AdminTab[] = ['POS_ORDER', 'ORDERS', 'BOOKINGS', 'TABLES', 'MENU', 'CATEGORIES'];

  const navSections = rawNavSections
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        if (user?.role === 'MANAGER') {
          return managerTabIds.includes(item.id);
        }
        if (user?.role === 'ADMIN' || user?.role === 'STAFF') {
          return adminTabIds.includes(item.id);
        }
        return false;
      });
      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  const roleLabel =
    user?.role === 'MANAGER' ? 'Hotel Manager' : user?.role === 'ADMIN' ? 'Administrator' : 'Floor Staff';

  return (
    <aside className="w-full h-full bg-ink text-ivory/70 flex flex-col justify-between shrink-0 border-r border-white/[0.06] select-none relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-wine/25 blur-[90px] pointer-events-none" />

      <div className="relative flex-1 overflow-y-auto min-h-0 scrollbar-none">
        {/* Brand Header */}
        <div className="px-5 pt-6 pb-5 flex items-center gap-3">
          <span className="relative w-10 h-10 shrink-0 flex items-center justify-center border border-gold/60 text-champagne">
            <span className="absolute inset-[3px] border border-gold/25" />
            <span className="font-display text-[13px] font-semibold tracking-[0.06em]">ABC</span>
          </span>
          <div className="min-w-0 leading-none">
            <span className="font-display font-semibold text-ivory text-lg tracking-[0.16em] block">ABC HOTEL</span>
            <span className="text-[9px] uppercase tracking-[0.3em] text-gold font-semibold block mt-1.5">
              Staff Portal
            </span>
          </div>
        </div>
        <div className="mx-5 lux-hairline opacity-60" />

        {/* Navigation Items */}
        <nav className="px-3 py-4 space-y-5" aria-label="Operations">
          {navSections.map((sec, secIdx) => (
            <div key={sec.title || secIdx} className="space-y-0.5">
              <p className="px-3 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.24em] text-ivory/30">{sec.title}</p>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as AdminTab)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all duration-300 flex items-center justify-between cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-r from-wine to-wine/60 text-ivory font-semibold shadow-[0_10px_24px_-14px_rgba(91,26,38,0.9)]'
                        : 'text-ivory/60 hover:text-ivory hover:bg-white/[0.05]'
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gold" />}
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-champagne' : 'text-ivory/35 group-hover:text-gold'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full shrink-0 flex items-center justify-center ${
                          isActive ? 'bg-ivory/15 text-ivory' : 'bg-gold/15 text-champagne'
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
        <div className="relative p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04]">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-champagne to-gold text-ink flex items-center justify-center text-sm font-bold shrink-0">
              {user.firstName?.[0] || 'S'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ivory truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-gold/80 truncate">{roleLabel}</p>
            </div>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ivory/40 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
