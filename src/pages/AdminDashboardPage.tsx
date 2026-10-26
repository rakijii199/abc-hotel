/**
 * Master Admin Operations Dashboard for ABC Hotel
 * Connects all management views, realtime polling, and RBAC
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Layers,
  SquareDashedBottom,
  Users,
  History,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { AdminApi, MenuApi } from '../api/index.ts';
import {
  TableBooking,
  Order,
  MenuItem,
  MenuCategory,
  DiningTable,
  SafeUser,
  AuditLog,
  AdminNotification,
  BookingStatus,
  OrderStatus
} from '../types/index.ts';
import { formatCurrency, formatDate, formatTime, getBookingStatusBadge, getOrderStatusBadge } from '../utils/formatters.ts';
import { Spinner } from '../components/common/Footer.tsx';

// Subcomponents
import { AdminSidebar, AdminTab, TAB_SECTIONS, canViewTab } from '../components/admin/AdminSidebar.tsx';
import { UserManagementView } from '../components/admin/UserManagementView.tsx';
import type { SectionId } from '../../shared/accessControl.ts';
import { AdminHeader } from '../components/admin/AdminHeader.tsx';
import { AdminPosOrderView } from '../components/admin/AdminPosOrderView.tsx';
import { KitchenKdsView } from '../components/kitchen/KitchenKdsView.tsx';
import { AdminBookingsView } from '../components/admin/AdminBookingsView.tsx';
import { AdminOrdersView } from '../components/admin/AdminOrdersView.tsx';
import { AdminMenuView } from '../components/admin/AdminMenuView.tsx';
import { AdminCategoriesView } from '../components/admin/AdminCategoriesView.tsx';
import { AdminPaymentsView } from '../components/admin/AdminPaymentsView.tsx';
import { AdminPaymentSettingsView } from '../components/admin/AdminPaymentSettingsView.tsx';
import { AdminDailyStaffSummary } from '../components/admin/AdminDailyStaffSummary.tsx';
import { StaffBillingDashboard } from '../components/billing/StaffBillingDashboard.tsx';
import { AdminBillingSettings } from '../components/admin/AdminBillingSettings.tsx';
import { AdminBillingReports } from '../components/admin/AdminBillingReports.tsx';
import { AdminEmployeesView } from '../components/admin/AdminEmployeesView.tsx';
import { AdminInventoryView } from '../components/admin/AdminInventoryView.tsx';
import { AdminTablesView } from '../components/admin/AdminTablesView.tsx';
import { DeliveryPortalPage } from './DeliveryPortalPage.tsx';

export const AdminDashboardPage: React.FC<{ 
  navigate: (route: string, state?: any, replace?: boolean) => void;
  initialTab?: AdminTab;
}> = ({ navigate, initialTab }) => {
  const { user, isAuthenticated, isLoading, logout, can } = useAuth();

  // Tabs this user may open (resolved section access, same as the API enforces).
  const TAB_ORDER: AdminTab[] = ['DASHBOARD', 'POS_ORDER', 'ORDERS', 'BOOKINGS', 'TABLES', 'MENU', 'CATEGORIES', 'INVENTORY', 'BILLING', 'PAYMENTS', 'BILLING_REPORTS', 'EMPLOYEES', 'PAYMENT_SETTINGS', 'BILLING_SETTINGS', 'KITCHEN_KDS', 'DELIVERY_PORTAL'];
  const allowedTabs = TAB_ORDER.filter((tab) => canViewTab(user?.access, tab));
  const firstAllowedTab: AdminTab = allowedTabs[0] || 'POS_ORDER';
  const { error, success, info } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (initialTab && canViewTab(user?.access, initialTab)) return initialTab;
    return firstAllowedTab;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Sync activeTab when URL route state changes (e.g. browser back/forward or direct link)
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const tabAllowed = canViewTab(user?.access, activeTab);
  const viewOnly = tabAllowed && !TAB_SECTIONS[activeTab].some((sec) => can(sec, 'FULL'));

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    navigate('admin', { tab });
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Core Data
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [reports, setReports] = useState<any>(null);

  // Never show a tab the user has no access to (direct links included).
  useEffect(() => {
    if (!isLoading && isAuthenticated && allowedTabs.length > 0 && !canViewTab(user?.access, activeTab)) {
      setActiveTab(firstAllowedTab);
    }
  }, [activeTab, isLoading, isAuthenticated, user?.access]);

  const loadAllData = async (isBackground = false) => {
    const token = localStorage.getItem('abc_auth_token');
    if (!token || !isAuthenticated || allowedTabs.length === 0) return;
    // Only request what this user may read; skipped calls are simply not loaded.
    const skip = () => Promise.reject(new Error('No access'));
    const canRead = (...sections: SectionId[]) => sections.some((sec) => can(sec, 'VIEW'));

    if (!isBackground) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        canRead('DASHBOARD') ? AdminApi.getDashboardStats(selectedDailyDate) : skip(),
        canRead('ORDERS', 'DELIVERY', 'KITCHEN', 'POS', 'BILLING') ? AdminApi.getAllOrders({ pageSize: 500, includeArchived: true }) : skip(),
        canRead('BOOKINGS') ? AdminApi.getAllBookings() : skip(),
        MenuApi.getItems(),
        canRead('MENU', 'POS', 'ORDERS', 'INVENTORY') ? AdminApi.getCategories() : skip(),
        canRead('TABLES', 'POS', 'BOOKINGS') ? AdminApi.getTables() : skip(),
        canRead('CUSTOMERS') ? AdminApi.getCustomers() : skip(),
        canRead('REPORTS') ? AdminApi.getAuditLogs() : skip(),
        canRead('DASHBOARD', 'ORDERS', 'BOOKINGS', 'KITCHEN', 'DELIVERY', 'POS', 'BILLING') ? AdminApi.getNotifications() : skip(),
        canRead('REPORTS') ? AdminApi.getReports() : skip()
      ]);

      if (results[0].status === 'fulfilled') setStats(results[0].value);
      if (results[1].status === 'fulfilled') setOrders(results[1].value);
      if (results[2].status === 'fulfilled') setBookings(results[2].value);
      if (results[3].status === 'fulfilled') setMenuItems(results[3].value);
      if (results[4].status === 'fulfilled') setCategories(results[4].value);
      if (results[5].status === 'fulfilled') setTables(results[5].value);
      if (results[6].status === 'fulfilled') setCustomers(results[6].value);
      if (results[7].status === 'fulfilled') setAuditLogs(results[7].value);
      if (results[8].status === 'fulfilled') {
        setNotifications(results[8].value.notifications || []);
        setUnreadCount(results[8].value.unreadCount || 0);
      }
      if (results[9].status === 'fulfilled') setReports(results[9].value);

      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (rejected.length > 0 && !isBackground) {
        console.warn('[ADMIN LOAD WARNING]: Some modules returned error:', rejected);
        // Only show toast if core critical modules (menu or tables) failed
        if (results[3].status === 'rejected' && results[5].status === 'rejected') {
          const firstErr = rejected[0].reason;
          error(firstErr?.message || 'Failed to refresh admin data.');
        }
      }
    } catch (err: any) {
      if (!isBackground) {
        error(err.message || 'Failed to refresh admin data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDailyDate(newDate);
    try {
      const dashboardStats = await AdminApi.getDashboardStats(newDate);
      setStats(dashboardStats);
    } catch (err: any) {
      error(err.message || 'Failed to load daily stats.');
    }
  };

  // Auth gate
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('staff-login');
      return;
    }

    if (allowedTabs.length === 0) {
      error('Access Denied: your account has no access to the operations suite.');
      navigate('dashboard');
      return;
    }

    let isSubscribed = true;
    loadAllData();

    // Auto-polling interval for real-time order and booking updates (every 8 seconds)
    const interval = setInterval(() => {
      if (isSubscribed && localStorage.getItem('abc_auth_token')) {
        loadAllData(true);
      }
    }, 8000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, isLoading, user?.id]);

  if (isLoading || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Spinner text="Loading Staff Operations Management Suite..." />
      </div>
    );
  }

  // Action handlers
  const handleUpdateOrderStatus = async (
    orderId: string, 
    status: OrderStatus, 
    riderInfo?: { deliveryRiderId?: string; deliveryRiderName?: string; deliveryRiderPhone?: string }
  ) => {
    try {
      await AdminApi.updateOrderStatus(orderId, status, riderInfo);
      success(`Order updated to ${status}`);
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to update order status');
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    try {
      await AdminApi.updateBookingStatus(bookingId, status);
      success(`Booking updated to ${status}`);
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to update booking status');
    }
  };

  const handleCreateMenuItem = async (data: any) => {
    try {
      await AdminApi.createMenuItem(data);
      success('New dish added to restaurant menu!');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to create menu item');
    }
  };

  const handleUpdateMenuItem = async (id: string, data: any) => {
    try {
      await AdminApi.updateMenuItem(id, data);
      success('Menu item updated.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to update menu item');
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    try {
      await AdminApi.deleteMenuItem(id);
      success('Dish removed from menu.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to delete dish');
    }
  };

  const handleToggleMenuAvailability = async (id: string) => {
    try {
      const updated = await AdminApi.toggleMenuItemAvailability(id);
      info(`"${updated.name}" is now ${updated.available ? 'AVAILABLE' : 'UNAVAILABLE'}.`);
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to toggle availability');
    }
  };

  const handleCreateCategory = async (data: any) => {
    try {
      await AdminApi.createCategory(data);
      success('Category created successfully.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: string, data: any) => {
    try {
      await AdminApi.updateCategory(id, data);
      success('Category updated.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await AdminApi.deleteCategory(id);
      success('Category deleted.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to delete category');
    }
  };

  const handleCreateTable = async (data: any) => {
    try {
      await AdminApi.createTable(data);
      success('Dining table added to floor plan.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to add table');
    }
  };

  const handleUpdateTable = async (id: string, data: any) => {
    try {
      await AdminApi.updateTable(id, data);
      success('Table updated.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to update table');
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      await AdminApi.deleteTable(id);
      success('Table removed.');
      loadAllData(true);
    } catch (err: any) {
      error(err.message || 'Failed to delete table');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await AdminApi.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      error(err.message);
    }
  };

  const handleSelectNotification = async (n: AdminNotification) => {
    if (!n.read) {
      await AdminApi.markNotificationRead(n.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    }
    if (n.entityType === 'order') {
      handleTabChange('ORDERS');
    } else if (n.entityType === 'booking') {
      handleTabChange('BOOKINGS');
    } else {
      handleTabChange('MENU');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent">
      {/* Navigation drawer for tablet / mobile (desktop uses the top navigation) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-[85vw] h-full glass-strong !rounded-none animate-[lux-rise_0.3s_var(--ease-lux)]">
            <AdminSidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                handleTabChange(tab);
                setMobileSidebarOpen(false);
              }}
              onLogout={() => {
                logout();
                navigate('home');
              }}
              unreadCount={unreadCount}
              pendingOrdersCount={stats?.pendingOrdersCount || 0}
              pendingBookingsCount={stats?.pendingBookingsCount || 0}
            />
          </div>
        </div>
      )}

      {/* Main Content Area (Scrolls independently) */}
      <div ref={contentScrollRef} className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        <AdminHeader
          notifications={notifications}
          unreadCount={unreadCount}
          onRefresh={() => loadAllData(false)}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onSelectNotification={handleSelectNotification}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          refreshing={refreshing}
          activeTab={activeTab}
          onSelectTab={(tab) => handleTabChange(tab)}
          pendingOrdersCount={stats?.pendingOrdersCount || 0}
          pendingBookingsCount={stats?.pendingBookingsCount || 0}
        />

        <div className="px-3 sm:px-6 py-3 sm:py-4 flex-1 max-w-[1440px] w-full mx-auto space-y-3 pb-8">
          {allowedTabs.length === 0 && (
            <div className="surface p-6 text-center text-sm text-stone-600" role="alert">
              Your account has no access to the operations suite yet. Please ask a Super Admin to grant section access.
            </div>
          )}
          {tabAllowed && viewOnly && (
            <div className="px-4 py-2.5 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand-border)] text-[var(--brand-text)] text-xs font-semibold flex items-center gap-2" role="status">
              <Eye className="w-4 h-4 shrink-0" />
              View access — you can see this section but changes are disabled for your account.
            </div>
          )}
          {/* TAB: EMPLOYEE MANAGEMENT (EXCLUSIVELY FOR HOTEL MANAGER) */}
          {tabAllowed && activeTab === 'EMPLOYEES' && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <UserManagementView onRefreshStats={() => loadAllData(true)} />
            </div>
          )}

          {/* TAB 1: UNIFIED MINIMAL DASHBOARD (MANAGER ONLY) */}
          {tabAllowed && activeTab === 'DASHBOARD' && stats && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <AdminDailyStaffSummary
                stats={stats}
                allOrders={orders}
                selectedDate={selectedDailyDate}
                onDateChange={handleDateChange}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onNavigateToTab={(tab) => handleTabChange(tab as AdminTab)}
                onRefresh={() => loadAllData(false)}
              />
            </div>
          )}

          {/* TAB: POS ORDER ENTRY & KITCHEN DISPATCH */}
          {tabAllowed && activeTab === 'POS_ORDER' && (
            <AdminPosOrderView
              menuItems={menuItems}
              categories={categories}
              tables={tables}
              onOrderCreated={(newOrder) => {
                setOrders((prev) => [newOrder, ...prev]);
                loadAllData(true);
              }}
              onNavigateToOrders={() => handleTabChange('ORDERS')}
              onNavigateToKds={() => handleTabChange('ORDERS')}
            />
          )}

          {/* TAB: KITCHEN DISPLAY SYSTEM */}
          {tabAllowed && activeTab === 'KITCHEN_KDS' && (
            <KitchenKdsView
              onBackToAdmin={() => handleTabChange('DASHBOARD')}
              onNavigateToPos={() => handleTabChange('POS_ORDER')}
            />
          )}

          {/* TAB 2: BOOKINGS MANAGEMENT */}
          {tabAllowed && activeTab === 'BOOKINGS' && (
            <AdminBookingsView
              bookings={bookings}
              onUpdateStatus={handleUpdateBookingStatus}
              onRefresh={() => loadAllData(false)}
            />
          )}

          {/* TAB 3: ORDERS MANAGEMENT */}
          {tabAllowed && activeTab === 'ORDERS' && (
            <AdminOrdersView
              orders={orders}
              menuItems={menuItems}
              onUpdateStatus={handleUpdateOrderStatus}
              onRefresh={() => loadAllData(false)}
            />
          )}

          {/* TAB: DELIVERY STAFF PORTAL */}
          {tabAllowed && activeTab === 'DELIVERY_PORTAL' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <DeliveryPortalPage navigate={(r) => navigate(r)} />
            </div>
          )}

          {/* TAB 4: MENU ITEMS */}
          {tabAllowed && activeTab === 'MENU' && (
            <AdminMenuView
              menuItems={menuItems}
              categories={categories}
              onCreateItem={handleCreateMenuItem}
              onUpdateItem={handleUpdateMenuItem}
              onDeleteItem={handleDeleteMenuItem}
              onToggleAvailability={handleToggleMenuAvailability}
            />
          )}

          {/* TAB 5: CATEGORIES */}
          {tabAllowed && activeTab === 'CATEGORIES' && (
            <AdminCategoriesView
              categories={categories}
              menuItems={menuItems}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {/* TAB: DINING TABLES & QR CONFIGURATION */}
          {tabAllowed && activeTab === 'TABLES' && (
            <AdminTablesView
              tables={tables}
              onCreateTable={handleCreateTable}
              onUpdateTable={handleUpdateTable}
              onDeleteTable={handleDeleteTable}
            />
          )}

          {/* TAB: INVENTORY & STOCK MANAGEMENT */}
          {tabAllowed && activeTab === 'INVENTORY' && (
            <div className="animate-in fade-in duration-200">
              <AdminInventoryView />
            </div>
          )}

          {/* TAB 7: PAYMENTS AUDIT & RECONCILIATION */}
          {tabAllowed && activeTab === 'PAYMENTS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminPaymentsView onRefreshOrders={() => loadAllData(false)} />
            </div>
          )}

          {/* TAB: STAFF BILLING & INVOICING DASHBOARD */}
          {tabAllowed && activeTab === 'BILLING' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <StaffBillingDashboard isStaffOrAdmin={true} />
            </div>
          )}

          {/* TAB: FINANCIAL REPORTS */}
          {tabAllowed && activeTab === 'BILLING_REPORTS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminBillingReports />
            </div>
          )}

          {/* TAB: HOTEL BILLING & TAX SETTINGS */}
          {tabAllowed && activeTab === 'BILLING_SETTINGS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminBillingSettings />
            </div>
          )}

          {/* TAB 8: HOTEL PAYMENT & QR SETTINGS */}
          {tabAllowed && activeTab === 'PAYMENT_SETTINGS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminPaymentSettingsView />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
