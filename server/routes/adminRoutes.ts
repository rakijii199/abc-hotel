/**
 * Admin Routes with Strict RBAC (Role = ADMIN or MANAGER) Protection
 * High-privilege administrative router. DELIVERY and STAFF roles are strictly forbidden.
 */
import { Router } from 'express';
import { AdminController } from '../controllers/adminController.ts';
import { authenticateToken, requireAccess, requireAnyAccess, requireRole, requireSuperAdmin } from '../middleware/authMiddleware.ts';
import { validateBody } from '../middleware/errorHandler.ts';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  createCategorySchema,
  updateCategorySchema,
  createTableSchema,
  updateTableSchema,
  updateBookingStatusSchema,
  updateOrderStatusSchema,
  createStaffOrderSchema,
  staffAddOrderItemsSchema
} from '../validators/index.ts';

import { PaymentController } from '../controllers/paymentController.ts';

export const adminRouter = Router();

// Every /api/admin route requires a signed-in staff account and the section
// access listed on the route (VIEW to read, FULL to change; Super Admins pass).
adminRouter.use(authenticateToken);

const ORDERS_READ = requireAnyAccess([['ORDERS', 'VIEW'], ['DELIVERY', 'VIEW'], ['KITCHEN', 'VIEW'], ['POS', 'VIEW'], ['BILLING', 'VIEW']]);
const MENU_READ = requireAnyAccess([['MENU', 'VIEW'], ['POS', 'VIEW'], ['ORDERS', 'VIEW'], ['INVENTORY', 'VIEW']]);
const TABLES_READ = requireAnyAccess([['TABLES', 'VIEW'], ['POS', 'VIEW'], ['BOOKINGS', 'VIEW']]);
const STAFF_AREA = requireAnyAccess([['DASHBOARD', 'VIEW'], ['ORDERS', 'VIEW'], ['BOOKINGS', 'VIEW'], ['KITCHEN', 'VIEW'], ['DELIVERY', 'VIEW'], ['POS', 'VIEW'], ['BILLING', 'VIEW']]);

// Dashboard Stats & Analytics
adminRouter.get('/dashboard', requireAccess('DASHBOARD', 'VIEW'), AdminController.getDashboardStats);
adminRouter.get('/dashboard/aggregated', requireAccess('DASHBOARD', 'VIEW'), AdminController.getDashboardAggregate);
adminRouter.get('/analytics/aggregate', requireAnyAccess([['DASHBOARD', 'VIEW'], ['REPORTS', 'VIEW']]), AdminController.getDashboardAggregate);
adminRouter.get('/stats', requireAccess('DASHBOARD', 'VIEW'), AdminController.getDashboardStats);
adminRouter.get('/reports', requireAccess('REPORTS', 'VIEW'), AdminController.getReports);

// Database Clear & Load Simulation (Strictly forbidden in production environments)
if (process.env.NODE_ENV !== 'production') {
  adminRouter.post('/clear-all-data', requireRole('ADMIN'), AdminController.clearAllData);
  adminRouter.post('/tests/load-simulation', requireRole('ADMIN'), AdminController.runLoadSimulation);
}

// Data Retention Governance & Archival
adminRouter.get('/retention/config', requireAccess('SETTINGS', 'VIEW'), AdminController.getRetentionConfig);
adminRouter.put('/retention/config', requireAccess('SETTINGS', 'FULL'), requireSuperAdmin, AdminController.updateRetentionConfig);
adminRouter.post('/retention/run', requireAccess('SETTINGS', 'FULL'), requireSuperAdmin, AdminController.executeRetentionJob);
adminRouter.get('/retention/logs', requireAccess('SETTINGS', 'VIEW'), AdminController.getRetentionLogs);
adminRouter.get('/archive/orders', requireAnyAccess([['ORDERS', 'VIEW'], ['REPORTS', 'VIEW']]), AdminController.getArchivedOrders);

// Orders Operations (Staff POS & Kitchen Dispatch)
adminRouter.get('/orders', ORDERS_READ, AdminController.getAllOrders);
adminRouter.get('/orders/paginated', ORDERS_READ, AdminController.getAllOrders);
adminRouter.post('/orders', requireAccess('POS', 'FULL'), validateBody(createStaffOrderSchema), AdminController.createStaffOrder);
adminRouter.get('/orders/:id', ORDERS_READ, AdminController.getOrderById);
adminRouter.put('/orders/:id/status', requireAnyAccess([['ORDERS', 'FULL'], ['DELIVERY', 'FULL'], ['KITCHEN', 'FULL']]), validateBody(updateOrderStatusSchema), AdminController.updateOrderStatus);
adminRouter.post('/orders/:id/items', requireAnyAccess([['ORDERS', 'FULL'], ['POS', 'FULL']]), validateBody(staffAddOrderItemsSchema), AdminController.addItemsToOrder);
adminRouter.put('/orders/:id/payment', requireAnyAccess([['ORDERS', 'FULL'], ['BILLING', 'FULL'], ['DELIVERY', 'FULL']]), AdminController.updatePaymentStatus);

// Bookings Operations
adminRouter.get('/bookings', requireAccess('BOOKINGS', 'VIEW'), AdminController.getAllBookings);
adminRouter.get('/bookings/:id', requireAccess('BOOKINGS', 'VIEW'), AdminController.getBookingById);
adminRouter.put('/bookings/:id/status', requireAccess('BOOKINGS', 'FULL'), validateBody(updateBookingStatusSchema), AdminController.updateBookingStatus);

// Menu Items Management
adminRouter.get('/menu', MENU_READ, AdminController.getAllMenuItems);
adminRouter.get('/menu/items', MENU_READ, AdminController.getAllMenuItems);
adminRouter.post('/menu', requireAccess('MENU', 'FULL'), validateBody(createMenuItemSchema), AdminController.createMenuItem);
adminRouter.put('/menu/:id', requireAccess('MENU', 'FULL'), validateBody(updateMenuItemSchema), AdminController.updateMenuItem);
adminRouter.delete('/menu/:id', requireAccess('MENU', 'FULL'), requireSuperAdmin, AdminController.deleteMenuItem);
adminRouter.patch('/menu/:id/toggle-availability', requireAccess('MENU', 'FULL'), AdminController.toggleMenuItemAvailability);

// Category Management
adminRouter.get('/menu/categories', MENU_READ, AdminController.getAllCategories);
adminRouter.get('/categories', MENU_READ, AdminController.getAllCategories);
adminRouter.post('/menu/categories', requireAccess('MENU', 'FULL'), validateBody(createCategorySchema), AdminController.createCategory);
adminRouter.put('/menu/categories/:id', requireAccess('MENU', 'FULL'), validateBody(updateCategorySchema), AdminController.updateCategory);
adminRouter.delete('/menu/categories/:id', requireAccess('MENU', 'FULL'), requireSuperAdmin, AdminController.deleteCategory);

// Table Management
adminRouter.get('/tables', TABLES_READ, AdminController.getAllTables);
adminRouter.post('/tables', requireAccess('TABLES', 'FULL'), validateBody(createTableSchema), AdminController.createTable);
adminRouter.put('/tables/:id', requireAccess('TABLES', 'FULL'), validateBody(updateTableSchema), AdminController.updateTable);
adminRouter.delete('/tables/:id', requireAccess('TABLES', 'FULL'), requireSuperAdmin, AdminController.deleteTable);

// Customer Directory
adminRouter.get('/customers', requireAccess('CUSTOMERS', 'VIEW'), AdminController.getAllCustomers);
adminRouter.get('/customers/:id', requireAccess('CUSTOMERS', 'VIEW'), AdminController.getCustomerById);

// Audit Logs & Notifications
adminRouter.get('/audit-logs', requireAccess('REPORTS', 'VIEW'), AdminController.getAuditLogs);
adminRouter.get('/notifications', STAFF_AREA, AdminController.getNotifications);
adminRouter.patch('/notifications/:id/read', STAFF_AREA, AdminController.markNotificationRead);
adminRouter.post('/notifications/mark-all-read', STAFF_AREA, AdminController.markAllNotificationsRead);

// Payment Configuration & Operations
adminRouter.get('/payment-settings', requireAccess('SETTINGS', 'VIEW'), PaymentController.getAdminPaymentSettings);
adminRouter.put('/payment-settings', requireAccess('SETTINGS', 'FULL'), requireSuperAdmin, PaymentController.updateAdminPaymentSettings);
adminRouter.post('/payment-settings/qr', requireAccess('SETTINGS', 'FULL'), requireSuperAdmin, PaymentController.uploadQrCode);
adminRouter.get('/payments', requireAccess('PAYMENTS', 'VIEW'), PaymentController.getAllPaymentsAdmin);
adminRouter.post('/payments/:id/reconcile', requireAccess('PAYMENTS', 'FULL'), PaymentController.reconcilePaymentAdmin);
adminRouter.post('/payments/:id/refund', requireAccess('PAYMENTS', 'FULL'), requireSuperAdmin, PaymentController.refundPaymentAdmin);
