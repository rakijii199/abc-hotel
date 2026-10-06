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
import { AdminSidebar, AdminTab } from '../components/admin/AdminSidebar.tsx';
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
  const { user, isAdmin, isManager, isAuthenticated, isLoading, logout } = useAuth();
  const { error, success, info } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (initialTab) return initialTab;
    return user?.role === 'MANAGER' ? 'DASHBOARD' : 'POS_ORDER';
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

  // Set initial active tab based on role & prevent non-manager from accessing manager-only tabs
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (!isManager) {
        const staffAllowedTabs: AdminTab[] = ['POS_ORDER', 'ORDERS', 'BOOKINGS', 'TABLES', 'MENU', 'CATEGORIES'];
        if (!staffAllowedTabs.includes(activeTab)) {
          setActiveTab('POS_ORDER');
        }
      }
    }
  }, [isManager, isAdmin, activeTab, isLoading, isAuthenticated]);

  const loadAllData = async (isBackground = false) => {
    const token = localStorage.getItem('abc_auth_token');
    if (!token || !isAuthenticated || (!isAdmin && !isManager)) return;

    if (!isBackground) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        AdminApi.getDashboardStats(selectedDailyDate),
        AdminApi.getAllOrders({ pageSize: 500, includeArchived: true }),
        AdminApi.getAllBookings(),
        MenuApi.getItems(),
        AdminApi.getCategories(),
        AdminApi.getTables(),
        AdminApi.getCustomers(),
        AdminApi.getAuditLogs(),
        AdminApi.getNotifications(),
        AdminApi.getReports()
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

    if (!isAdmin && !isManager) {
      error('Access Denied: You must have the ADMIN or MANAGER role to access operations.');
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
  }, [isAuthenticated, isAdmin, isManager, isLoading]);

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
    <div className="flex h-screen w-full overflow-hidden bg-stone-100/70">
      {/* Desktop Sidebar (Static on Left) */}
      <div className="hidden md:flex h-full w-64 shrink-0 flex-col z-40 bg-white">
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={(tab) => handleTabChange(tab)}
          onLogout={() => {
            logout();
            navigate('home');
          }}
          unreadCount={unreadCount}
          pendingOrdersCount={stats?.pendingOrdersCount || 0}
          pendingBookingsCount={stats?.pendingBookingsCount || 0}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-full h-full bg-white">
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
        />

        <div className="p-2 sm:p-3 flex-1 max-w-7xl w-full mx-auto space-y-2 pb-6">
          {/* TAB: EMPLOYEE MANAGEMENT (EXCLUSIVELY FOR HOTEL MANAGER) */}
          {activeTab === 'EMPLOYEES' && isManager && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <AdminEmployeesView onRefreshStats={() => loadAllData(true)} />
            </div>
          )}

          {/* TAB 1: UNIFIED MINIMAL DASHBOARD (MANAGER ONLY) */}
          {activeTab === 'DASHBOARD' && isManager && stats && (
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
          {activeTab === 'POS_ORDER' && (
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
          {activeTab === 'KITCHEN_KDS' && (
            <KitchenKdsView
              onBackToAdmin={() => handleTabChange('DASHBOARD')}
              onNavigateToPos={() => handleTabChange('POS_ORDER')}
            />
          )}

          {/* TAB 2: BOOKINGS MANAGEMENT */}
          {activeTab === 'BOOKINGS' && (
            <AdminBookingsView
              bookings={bookings}
              onUpdateStatus={handleUpdateBookingStatus}
              onRefresh={() => loadAllData(false)}
            />
          )}

          {/* TAB 3: ORDERS MANAGEMENT */}
          {activeTab === 'ORDERS' && (
            <AdminOrdersView
              orders={orders}
              menuItems={menuItems}
              onUpdateStatus={handleUpdateOrderStatus}
              onRefresh={() => loadAllData(false)}
            />
          )}

          {/* TAB: DELIVERY STAFF PORTAL */}
          {activeTab === 'DELIVERY_PORTAL' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <DeliveryPortalPage navigate={(r) => navigate(r)} />
            </div>
          )}

          {/* TAB 4: MENU ITEMS */}
          {activeTab === 'MENU' && (
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
          {activeTab === 'CATEGORIES' && (
            <AdminCategoriesView
              categories={categories}
              menuItems={menuItems}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {/* TAB: DINING TABLES & QR CONFIGURATION */}
          {activeTab === 'TABLES' && (
            <AdminTablesView
              tables={tables}
              onCreateTable={handleCreateTable}
              onUpdateTable={handleUpdateTable}
              onDeleteTable={handleDeleteTable}
            />
          )}

          {/* TAB: INVENTORY & STOCK MANAGEMENT */}
          {activeTab === 'INVENTORY' && isManager && (
            <div className="animate-in fade-in duration-200">
              <AdminInventoryView />
            </div>
          )}

          {/* TAB 7: PAYMENTS AUDIT & RECONCILIATION */}
          {activeTab === 'PAYMENTS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminPaymentsView onRefreshOrders={() => loadAllData(false)} />
            </div>
          )}

          {/* TAB: STAFF BILLING & INVOICING DASHBOARD */}
          {activeTab === 'BILLING' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <StaffBillingDashboard isStaffOrAdmin={true} />
            </div>
          )}

          {/* TAB: FINANCIAL REPORTS */}
          {activeTab === 'BILLING_REPORTS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminBillingReports />
            </div>
          )}

          {/* TAB: HOTEL BILLING & TAX SETTINGS */}
          {activeTab === 'BILLING_SETTINGS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminBillingSettings />
            </div>
          )}

          {/* TAB 8: HOTEL PAYMENT & QR SETTINGS */}
          {activeTab === 'PAYMENT_SETTINGS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AdminPaymentSettingsView />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
