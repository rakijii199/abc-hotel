/**
 * Frontend API Service Modules
 * Single Source of Truth for Customer & Admin APIs
 */
import { request } from './client.ts';
import {
  SafeUser,
  EmployeeStats,
  MenuItem,
  MenuCategory,
  TableBooking,
  Order,
  DiningTable,
  OrderStatus,
  BookingStatus,
  AuditLog,
  AdminNotification,
  DashboardAggregateResponse,
  PaginatedResult,
  DataRetentionConfig,
  RetentionJobLog
} from '../types/index.ts';

// Authentication API
export const AuthApi = {
  register: (payload: any) =>
    request<{ user: SafeUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  registerCustomerPhone: (payload: {
    idToken: string;
    fullName: string;
    phone?: string;
    email?: string;
    firebaseUid?: string;
    countryCode?: string;
  }) =>
    request<{ user: SafeUser; token: string }>('/auth/customer/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  loginCustomerPhone: (payload: {
    idToken: string;
    phone?: string;
    firebaseUid?: string;
  }) =>
    request<{ user: SafeUser; token: string }>('/auth/customer/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  login: (payload: any) =>
    request<{ user: SafeUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  me: () => request<SafeUser>('/auth/me'),

  logout: () => request('/auth/logout', { method: 'POST' }),

  updateProfile: (payload: { firstName?: string; lastName?: string; phone?: string }) =>
    request<SafeUser>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  changePassword: (payload: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
    request('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
};

// Menu & Categories API
export const MenuApi = {
  getCategories: () => request<MenuCategory[]>('/menu/categories'),

  getItems: (params: {
    category?: string;
    search?: string;
    vegetarian?: boolean;
    spicy?: boolean;
    maxPrice?: number;
    sortBy?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.vegetarian !== undefined) query.append('vegetarian', String(params.vegetarian));
    if (params.spicy !== undefined) query.append('spicy', String(params.spicy));
    if (params.maxPrice) query.append('maxPrice', String(params.maxPrice));
    if (params.sortBy) query.append('sortBy', params.sortBy);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<MenuItem[]>(`/menu${queryString}`);
  },

  getItemById: (id: string) => request<MenuItem>(`/menu/${id}`)
};

// Tables & Bookings API
export const BookingApi = {
  getTables: () =>
    request<{ tables: DiningTable[]; restaurant: any; hotel: any }>('/tables'),

  checkAvailability: (params: { bookingDate: string; startTime: string; guestCount: number }) => {
    const query = new URLSearchParams({
      bookingDate: params.bookingDate,
      startTime: params.startTime,
      guestCount: String(params.guestCount)
    });
    return request<{
      tables: Array<DiningTable & { isAvailable: boolean; reason?: string }>;
      operatingHours: { open: string; close: string };
    }>(`/tables/availability?${query.toString()}`);
  },

  createBooking: (payload: {
    tableId: string;
    bookingDate: string;
    startTime: string;
    guestCount: number;
    specialRequest?: string;
  }) =>
    request<TableBooking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getMyBookings: () => request<TableBooking[]>('/bookings'),

  getBookingById: (id: string) => request<TableBooking>(`/bookings/${id}`),

  cancelBooking: (id: string) =>
    request<TableBooking>(`/bookings/${id}/cancel`, {
      method: 'POST'
    })
};

// Orders API
export const OrderApi = {
  createOrder: (payload: any) => {
    const idempotencyKey =
      payload.idempotencyKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    return request<Order>('/orders', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });
  },

  getMyOrders: () => request<Order[]>('/orders'),

  getOrderById: (id: string) => request<Order>(`/orders/${id}`),

  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'CANCELLED' })
    }),

  addOrderItems: (
    orderId: string,
    items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>
  ) =>
    request<Order>(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items })
    })
};

// Payment Gateway API
export const PaymentApi = {
  getPaymentConfig: () =>
    request<{
      hotelName: string;
      hotelUpiId: string;
      hotelMobileNumber: string;
      hotelQrCodeUrl: string;
      paymentProvider: string;
      paymentEnvironment: string;
      paymentInstructions: string;
      supportContactNumber: string;
    }>('/payments/config'),

  createPaymentOrder: (orderId: string, paymentMethod: string = 'UPI') =>
    request<{
      orderId: string;
      orderNumber: string;
      attemptId?: string;
      paymentReference?: string;
      paymentId: string;
      providerOrderId: string;
      amount: number;
      amountInRupees: number;
      currency: string;
      keyId: string;
      environment: 'test' | 'production';
      hotelName?: string;
      hotelUpiId?: string;
      hotelMobileNumber?: string;
      hotelQrCodeUrl?: string;
      upiIntentUrl?: string;
      paymentInstructions?: string;
      expiresAt?: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    }>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ orderId, paymentMethod })
    }),

  getPaymentAttemptStatus: (attemptId: string) =>
    request<{
      attemptId: string;
      orderId: string;
      orderNumber: string;
      paymentReference: string;
      amount: number;
      currency: string;
      method: string;
      status: string;
      orderStatus: string;
      paymentStatus: string;
      expiresAt?: string;
      createdAt: string;
    }>(`/payments/attempt/${attemptId}/status`),

  confirmUpiPayment: (attemptId: string, utrNumber?: string) =>
    request<{
      success: boolean;
      alreadyProcessed: boolean;
      order: Order;
      payment: any;
      message: string;
    }>(`/payments/attempt/${attemptId}/confirm-upi`, {
      method: 'POST',
      body: JSON.stringify({ utrNumber })
    }),

  simulateUpiPaymentSuccess: (attemptId: string) =>
    request<{
      success: boolean;
      alreadyProcessed: boolean;
      order: Order;
      payment: any;
      message: string;
    }>(`/payments/attempt/${attemptId}/simulate-success`, {
      method: 'POST'
    }),

  cancelPaymentAttempt: (attemptId: string) =>
    request<{ success: boolean; message: string }>(`/payments/attempt/${attemptId}/cancel`, {
      method: 'POST'
    }),

  verifyPayment: (payload: {
    orderId: string;
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  }) =>
    request<{
      success: boolean;
      alreadyProcessed: boolean;
      order: Order;
      payment: any;
      message: string;
    }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getPaymentStatus: (orderId: string) =>
    request<{
      orderId: string;
      orderNumber: string;
      orderStatus: string;
      paymentStatus: string;
      paymentMethod: string;
      total: number;
      payment: any;
      attempts: any[];
    }>(`/payments/orders/${orderId}/status`),

  getAllPaymentsAdmin: () => request<any[]>('/payments/admin/all'),

  getAdminPaymentSettings: () => request<any>('/admin/payment-settings'),

  updateAdminPaymentSettings: (payload: any) =>
    request<any>('/admin/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  uploadQrCode: (payload: { qrCodeUrl?: string; qrCodeBase64?: string }) =>
    request<any>('/admin/payment-settings/qr', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  reconcilePaymentAdmin: (paymentId: string) =>
    request<{ success: boolean; order: Order; payment: any; message: string }>(
      `/admin/payments/${paymentId}/reconcile`,
      {
        method: 'POST'
      }
    ),

  sendPaymentRequestAdmin: (orderId: string, messageNote?: string) =>
    request<{ success: boolean; orderId: string; message: string }>(
      '/payments/admin/send-request',
      {
        method: 'POST',
        body: JSON.stringify({ orderId, messageNote })
      }
    ),

  refundPaymentAdmin: (paymentId: string, amount?: number, reason?: string) =>
    request<{ success: boolean; refundId: string; payment: any; order: Order }>(
      `/payments/admin/${paymentId}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({ amount, reason })
      }
    )
};

// Admin Operations API
export const AdminApi = {
  getDashboardStats: (date?: string) =>
    request<{
      selectedDate?: string;
      isToday?: boolean;
      dailyOrdersCount?: number;
      dailyCompletedOrdersCount?: number;
      dailyMoneyReceived?: number;
      dailyMoneyReceivedOnline?: number;
      dailyMoneyReceivedOffline?: number;
      dailyOnlineOrdersCount?: number;
      dailyOfflineOrdersCount?: number;
      dailyOnlinePaymentsCount?: number;
      dailyOfflinePaymentsCount?: number;
      dailyPendingOrdersCount?: number;
      dailyPreparingOrdersCount?: number;
      dailyReadyOrdersCount?: number;
      dailyServedOrdersCount?: number;
      dailyCancelledOrdersCount?: number;
      dailyOrdersList?: Array<Order & {
        orderChannel: 'ONLINE' | 'OFFLINE';
        paymentChannel: 'ONLINE' | 'OFFLINE';
        isMoneyReceived: boolean;
      }>;

      todayBookingsCount: number;
      pendingBookingsCount: number;
      confirmedBookingsCount: number;
      totalBookingsCount: number;

      todayOrdersCount: number;
      pendingOrdersCount: number;
      preparingOrdersCount: number;
      completedOrdersCount: number;
      totalOrdersCount: number;

      totalMenuItemsCount: number;
      totalCustomersCount: number;
      totalTablesCount: number;
      totalRevenue: number;

      recentBookings: TableBooking[];
      recentOrders: Order[];
    }>(`/admin/dashboard${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getStats: (date?: string) => AdminApi.getDashboardStats(date),

  // 12-Month Aggregated Analytics Dashboard
  getDashboardAggregate: (filter: string = 'THIS_MONTH', startDate?: string, endDate?: string, month?: string) => {
    const query = new URLSearchParams();
    query.append('filter', filter);
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    if (month) query.append('month', month);
    return request<DashboardAggregateResponse>(`/admin/dashboard/aggregated?${query.toString()}`);
  },

  // Orders
  getAllOrders: (params: {
    status?: string;
    orderType?: string;
    paymentStatus?: string;
    channel?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
    includeArchived?: boolean;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.orderType) query.append('orderType', params.orderType);
    if (params.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params.channel) query.append('channel', params.channel);
    if (params.search) query.append('search', params.search);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.page) query.append('page', String(params.page));
    if (params.pageSize) query.append('pageSize', String(params.pageSize));
    if (params.includeArchived !== undefined) query.append('includeArchived', String(params.includeArchived));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<Order[]>(`/admin/orders${qs}`);
  },

  getPaginatedOrders: (params: {
    page?: number;
    pageSize?: number;
    status?: string;
    orderType?: string;
    paymentStatus?: string;
    channel?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    includeArchived?: boolean;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.pageSize) query.append('pageSize', String(params.pageSize));
    if (params.status) query.append('status', params.status);
    if (params.orderType) query.append('orderType', params.orderType);
    if (params.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params.channel) query.append('channel', params.channel);
    if (params.search) query.append('search', params.search);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.includeArchived !== undefined) query.append('includeArchived', String(params.includeArchived));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<PaginatedResult<Order> & { retentionWindow: { days: number; startDate: string; endDate: string; isEnforced: boolean } }>(
      `/admin/orders${qs}`
    );
  },

  getArchivedOrders: (params: { page?: number; pageSize?: number; search?: string; startDate?: string; endDate?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.pageSize) query.append('pageSize', String(params.pageSize));
    if (params.search) query.append('search', params.search);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<PaginatedResult<Order>>(`/admin/archive/orders${qs}`);
  },

  // Data Retention Governance & Archival
  getRetentionConfig: () => request<DataRetentionConfig>('/admin/retention/config'),

  updateRetentionConfig: (payload: Partial<DataRetentionConfig>) =>
    request<DataRetentionConfig>('/admin/retention/config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  executeRetentionJob: (force: boolean = false) =>
    request<RetentionJobLog>('/admin/retention/run', {
      method: 'POST',
      body: JSON.stringify({ force })
    }),

  getRetentionLogs: () => request<RetentionJobLog[]>('/admin/retention/logs'),

  // Load Simulation & Performance Benchmark
  runLoadSimulation: (payload: { simulatedOrdersCount?: number; concurrencyLevels?: number[] } = {}) =>
    request<any>('/admin/tests/load-simulation', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createStaffOrder: (payload: any) =>
    request<Order>('/admin/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getOrderById: (id: string) => request<Order>(`/admin/orders/${id}`),

  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    riderInfo?: { deliveryRiderId?: string; deliveryRiderName?: string; deliveryRiderPhone?: string }
  ) =>
    request<Order>(`/admin/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, ...(riderInfo || {}) })
    }),

  addItemsToOrder: (orderId: string, itemsToAdd: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>) =>
    request<Order>(`/admin/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemsToAdd })
    }),

  updatePaymentStatus: (orderId: string, paymentStatus: 'PAID' | 'PENDING', paymentMethod?: string) =>
    request<Order>(`/admin/orders/${orderId}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ paymentStatus, paymentMethod })
    }),

  // Bookings
  getAllBookings: (params: { status?: string; date?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<TableBooking[]>(`/admin/bookings${qs}`);
  },

  getBookingById: (id: string) => request<TableBooking>(`/admin/bookings/${id}`),

  updateBookingStatus: (bookingId: string, status: BookingStatus) =>
    request<TableBooking>(`/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }),

  // Menu Items
  getMenuItems: () => request<MenuItem[]>('/admin/menu'),

  createMenuItem: (payload: any) =>
    request<MenuItem>('/admin/menu', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateMenuItem: (id: string, payload: any) =>
    request<MenuItem>(`/admin/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  deleteMenuItem: (id: string) =>
    request(`/admin/menu/${id}`, {
      method: 'DELETE'
    }),

  toggleMenuItemAvailability: (id: string) =>
    request<MenuItem>(`/admin/menu/${id}/toggle-availability`, {
      method: 'PATCH'
    }),

  // Categories
  getCategories: () => request<MenuCategory[]>('/admin/menu/categories'),

  createCategory: (payload: any) =>
    request<MenuCategory>('/admin/menu/categories', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateCategory: (id: string, payload: any) =>
    request<MenuCategory>(`/admin/menu/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  deleteCategory: (id: string) =>
    request(`/admin/menu/categories/${id}`, {
      method: 'DELETE'
    }),

  // Tables
  getTables: () => request<DiningTable[]>('/admin/tables'),

  createTable: (payload: any) =>
    request<DiningTable>('/admin/tables', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateTable: (id: string, payload: any) =>
    request<DiningTable>(`/admin/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  deleteTable: (id: string) =>
    request(`/admin/tables/${id}`, {
      method: 'DELETE'
    }),

  // Customers
  getCustomers: () =>
    request<
      Array<
        SafeUser & {
          totalOrders: number;
          totalBookings: number;
          totalSpend: number;
        }
      >
    >('/admin/customers'),

  getCustomerById: (id: string) =>
    request<{
      user: SafeUser;
      orders: Order[];
      bookings: TableBooking[];
      metrics: {
        totalOrders: number;
        totalBookings: number;
        totalSpend: number;
      };
    }>(`/admin/customers/${id}`),

  // Audit Logs & Notifications
  getAuditLogs: () => request<AuditLog[]>('/admin/audit-logs'),

  getNotifications: () =>
    request<{
      notifications: AdminNotification[];
      unreadCount: number;
    }>('/admin/notifications'),

  markNotificationRead: (id: string) =>
    request<AdminNotification>(`/admin/notifications/${id}/read`, {
      method: 'PATCH'
    }),

  markAllNotificationsRead: () =>
    request('/admin/notifications/mark-all-read', {
      method: 'POST'
    }),

  // Reports
  getReports: () =>
    request<{
      ordersByType: Record<string, { count: number; revenue: number }>;
      topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
      totalOrdersCount: number;
      totalBookingsCount: number;
      totalRevenue: number;
    }>('/admin/reports'),

  clearAllData: () =>
    request<{ success: boolean; message: string }>('/admin/clear-all-data', {
      method: 'POST'
    })
};

// Kitchen Department API
export const KitchenApi = {
  getOrders: (params?: string | { date?: string; startDate?: string; endDate?: string }) => {
    if (typeof params === 'string') {
      return request<Order[]>(`/kitchen/orders${params ? `?date=${encodeURIComponent(params)}` : ''}`);
    }
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<Order[]>(`/kitchen/orders${qs}`);
  },
  updateStatus: (orderId: string, status: OrderStatus) =>
    request<Order>(`/kitchen/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }),
  getStats: (params?: string | { date?: string; startDate?: string; endDate?: string }) => {
    if (typeof params === 'string') {
      return request<{
        pending: number;
        preparing: number;
        ready: number;
        completedToday: number;
      }>(`/kitchen/stats${params ? `?date=${encodeURIComponent(params)}` : ''}`);
    }
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<{
      pending: number;
      preparing: number;
      ready: number;
      completedToday: number;
    }>(`/kitchen/stats${qs}`);
  }
};

// Manager Executive & Employee Management API
export const ManagerApi = {
  getEmployees: (params?: { role?: string; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return request<SafeUser[]>(`/manager/employees${qs ? `?${qs}` : ''}`);
  },

  getEmployeeById: (id: string) => request<SafeUser>(`/manager/employees/${id}`),

  createEmployee: (payload: any) =>
    request<SafeUser>('/manager/employees', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  updateEmployee: (id: string, payload: any) =>
    request<SafeUser>(`/manager/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  updateStatus: (id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') =>
    request<SafeUser>(`/manager/employees/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  resetPassword: (id: string, payload: { newPassword: string; confirmNewPassword: string }) =>
    request<{ success: boolean; message: string }>(`/manager/employees/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  deleteEmployee: (id: string, reason?: string) =>
    request<{ success: boolean; message: string }>(`/manager/employees/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    }),

  getStats: () =>
    request<{
      employeeStats: EmployeeStats;
      todayOrdersCount: number;
      todayRevenue: number;
      activeTables: number;
      pendingDeliveries: number;
    }>('/manager/stats')
};

export { BillingApi } from './billingApi.ts';
export { InventoryApi } from './inventoryApi.ts';
