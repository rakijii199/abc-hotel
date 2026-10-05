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

  return (
    <aside className="w-64 bg-white text-stone-700 flex flex-col justify-between shrink-0 h-full border-r border-stone-200/80 shadow-2xs select-none">
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-stone-100 flex items-center gap-3 bg-[#fdfcfb]">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-white font-serif font-bold text-lg shadow-sm ring-2 ring-amber-500/20 shrink-0">
            ABC
          </div>
          <div className="min-w-0">
            <span className="font-serif font-bold text-stone-900 text-base block leading-tight tracking-tight">
              ABC HOTEL
            </span>
            <span className="inline-block mt-0.5 text-[9px] uppercase tracking-widest text-amber-900 font-bold bg-amber-50 border border-amber-200/80 px-2 py-0.2 rounded-full">
              Staff Portal
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5">
          {navSections.map((sec, secIdx) => (
            <div key={sec.title || secIdx} className="space-y-1">
              {secIdx > 0 && <div className="my-1.5 border-t border-stone-100" />}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as AdminTab)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer group ${
                      isActive
                        ? 'bg-amber-800 text-white font-bold shadow-xs shadow-amber-900/10'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-amber-200'
                            : 'text-stone-400 group-hover:text-stone-700'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : `border ${item.badgeColor || 'bg-amber-100 text-amber-900 border-amber-200'}`
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
    </aside>
  );
};
