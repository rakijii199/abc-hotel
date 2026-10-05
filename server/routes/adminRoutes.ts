/**
 * Admin Routes with Strict RBAC (Role = ADMIN or MANAGER) Protection
 * High-privilege administrative router. DELIVERY and STAFF roles are strictly forbidden.
 */
import { Router } from 'express';
import { AdminController } from '../controllers/adminController.ts';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.ts';
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
  createStaffOrderSchema
} from '../validators/index.ts';

import { PaymentController } from '../controllers/paymentController.ts';

export const adminRouter = Router();

// Baseline RBAC for /api/admin: strictly privileged administrators only
adminRouter.use(authenticateToken);
adminRouter.use(requireRole('ADMIN', 'MANAGER'));

// Dashboard Stats & Analytics
adminRouter.get('/dashboard', AdminController.getDashboardStats);
adminRouter.get('/dashboard/aggregated', AdminController.getDashboardAggregate);
adminRouter.get('/analytics/aggregate', AdminController.getDashboardAggregate);
adminRouter.get('/stats', AdminController.getDashboardStats);
adminRouter.get('/reports', AdminController.getReports);

// Database Clear & Load Simulation (Strictly forbidden in production environments)
if (process.env.NODE_ENV !== 'production') {
  adminRouter.post('/clear-all-data', requireRole('ADMIN'), AdminController.clearAllData);
  adminRouter.post('/tests/load-simulation', requireRole('ADMIN'), AdminController.runLoadSimulation);
}

// Data Retention Governance & Archival
adminRouter.get('/retention/config', AdminController.getRetentionConfig);
adminRouter.put('/retention/config', requireRole('ADMIN'), AdminController.updateRetentionConfig);
adminRouter.post('/retention/run', requireRole('ADMIN'), AdminController.executeRetentionJob);
adminRouter.get('/retention/logs', AdminController.getRetentionLogs);
adminRouter.get('/archive/orders', AdminController.getArchivedOrders);

// Orders Operations (Staff POS & Kitchen Dispatch)
adminRouter.get('/orders', AdminController.getAllOrders);
adminRouter.get('/orders/paginated', AdminController.getAllOrders);
adminRouter.post('/orders', validateBody(createStaffOrderSchema), AdminController.createStaffOrder);
adminRouter.get('/orders/:id', AdminController.getOrderById);
adminRouter.put('/orders/:id/status', validateBody(updateOrderStatusSchema), AdminController.updateOrderStatus);
adminRouter.post('/orders/:id/items', AdminController.addItemsToOrder);
adminRouter.put('/orders/:id/payment', AdminController.updatePaymentStatus);

// Bookings Operations
adminRouter.get('/bookings', AdminController.getAllBookings);
adminRouter.get('/bookings/:id', AdminController.getBookingById);
adminRouter.put('/bookings/:id/status', validateBody(updateBookingStatusSchema), AdminController.updateBookingStatus);

// Menu Items Management
adminRouter.get('/menu', AdminController.getAllMenuItems);
adminRouter.get('/menu/items', AdminController.getAllMenuItems);
adminRouter.post('/menu', validateBody(createMenuItemSchema), AdminController.createMenuItem);
adminRouter.put('/menu/:id', validateBody(updateMenuItemSchema), AdminController.updateMenuItem);
adminRouter.delete('/menu/:id', requireRole('ADMIN'), AdminController.deleteMenuItem);
adminRouter.patch('/menu/:id/toggle-availability', AdminController.toggleMenuItemAvailability);

// Category Management
adminRouter.get('/menu/categories', AdminController.getAllCategories);
adminRouter.get('/categories', AdminController.getAllCategories);
adminRouter.post('/menu/categories', validateBody(createCategorySchema), AdminController.createCategory);
adminRouter.put('/menu/categories/:id', validateBody(updateCategorySchema), AdminController.updateCategory);
adminRouter.delete('/menu/categories/:id', requireRole('ADMIN'), AdminController.deleteCategory);

// Table Management
adminRouter.get('/tables', AdminController.getAllTables);
adminRouter.post('/tables', validateBody(createTableSchema), AdminController.createTable);
adminRouter.put('/tables/:id', validateBody(updateTableSchema), AdminController.updateTable);
adminRouter.delete('/tables/:id', requireRole('ADMIN'), AdminController.deleteTable);

// Customer Directory
adminRouter.get('/customers', AdminController.getAllCustomers);
adminRouter.get('/customers/:id', AdminController.getCustomerById);

// Audit Logs & Notifications
adminRouter.get('/audit-logs', AdminController.getAuditLogs);
adminRouter.get('/notifications', AdminController.getNotifications);
adminRouter.patch('/notifications/:id/read', AdminController.markNotificationRead);
adminRouter.post('/notifications/mark-all-read', AdminController.markAllNotificationsRead);

// Payment Configuration & Operations
adminRouter.get('/payment-settings', PaymentController.getAdminPaymentSettings);
adminRouter.put('/payment-settings', requireRole('ADMIN'), PaymentController.updateAdminPaymentSettings);
adminRouter.post('/payment-settings/qr', requireRole('ADMIN'), PaymentController.uploadQrCode);
adminRouter.get('/payments', PaymentController.getAllPaymentsAdmin);
adminRouter.post('/payments/:id/reconcile', PaymentController.reconcilePaymentAdmin);
adminRouter.post('/payments/:id/refund', requireRole('ADMIN', 'MANAGER'), PaymentController.refundPaymentAdmin);
