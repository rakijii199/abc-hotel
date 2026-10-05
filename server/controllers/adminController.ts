/**
 * Admin Controller for Hotel Staff & Management
 * Role-Based Access Control and Complete Operations Suite
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { AdminService } from '../services/adminService.ts';

export class AdminController {
  // Dashboard Metrics
  public static async getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const stats = await AdminService.getDashboardStats(date);
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  // 12-Month Aggregated Analytics Dashboard
  public static async getDashboardAggregate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let filter = (req.query.filter as any) || 'THIS_MONTH';
      let customStart = req.query.startDate as string;
      let customEnd = req.query.endDate as string;
      const month = req.query.month as string;

      if (month && /^\d{4}-\d{2}$/.test(month)) {
        filter = 'CUSTOM';
        const [y, m] = month.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        customStart = `${month}-01`;
        customEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
      }

      const aggregate = AdminService.getDashboardAggregate(filter, customStart, customEnd);
      res.status(200).json({
        success: true,
        data: aggregate
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'AGGREGATE_FETCH_FAILED', message: err.message }
      });
    }
  }

  // Orders Management (with 30-day operational retention window and pagination)
  public static async getAllOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queryDate = req.query.date as string;
      const result = AdminService.getPaginatedOrders({
        page: req.query.page as string,
        pageSize: (req.query.pageSize || req.query.limit) as string,
        status: req.query.status as string,
        orderType: req.query.orderType as string,
        paymentStatus: req.query.paymentStatus as string,
        channel: req.query.channel as string,
        search: req.query.search as string,
        startDate: (req.query.startDate as string) || queryDate,
        endDate: (req.query.endDate as string) || queryDate,
        includeArchived: req.query.includeArchived as string,
        user: req.user
      });

      // Provide both data items array and pagination metadata
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          hasMore: result.hasMore
        },
        retentionWindow: result.retentionWindow
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async getArchivedOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = AdminService.getArchivedOrders({
        page: req.query.page as string,
        pageSize: (req.query.pageSize || req.query.limit) as string,
        search: req.query.search as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          hasMore: result.hasMore
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'ARCHIVE_FETCH_FAILED', message: err.message }
      });
    }
  }

  // Retention Config & Archival Execution
  public static async getRetentionConfig(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config = AdminService.getRetentionConfig();
      res.status(200).json({
        success: true,
        data: config
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_CONFIG_FAILED', message: err.message }
      });
    }
  }

  public static async updateRetentionConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = AdminService.updateRetentionConfig(req.body, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Data retention and archival configuration updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_CONFIG_FAILED', message: err.message }
      });
    }
  }

  public static async executeRetentionJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const force = req.body?.force === true;
      const log = AdminService.executeRetentionJob(force, req.user);
      res.status(200).json({
        success: true,
        data: log,
        message: log.status === 'COMPLETED'
          ? `Retention job completed successfully: Archived ${log.recordsArchived} historical transactions, updated ${log.summariesUpdated} analytics summaries.`
          : log.status === 'REQUIRES_REVIEW'
          ? `Retention job paused for review: ${log.errorMessage}`
          : `Retention job failed: ${log.errorMessage}`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'JOB_EXECUTION_FAILED', message: err.message }
      });
    }
  }

  public static async getRetentionLogs(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const logs = AdminService.getRetentionLogs();
      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_LOGS_FAILED', message: err.message }
      });
    }
  }

  // Load & Performance Simulation Runner
  public static async runLoadSimulation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const count = parseInt(String(req.body?.simulatedOrdersCount || 5000), 10);
      const concurrency = req.body?.concurrencyLevels || [100, 500, 1000];
      const report = AdminService.runLoadSimulation({
        simulatedOrdersCount: count,
        concurrencyLevels: concurrency
      });
      res.status(200).json({
        success: true,
        data: report,
        message: 'Load and stress simulation executed successfully with detailed latency metrics.'
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'SIMULATION_FAILED', message: err.message }
      });
    }
  }

  public static async getOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const order = await AdminService.getOrderById(req.params.id);
      res.status(200).json({
        success: true,
        data: order
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }

  public static async updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, deliveryRiderId, deliveryRiderName, deliveryRiderPhone } = req.body;
      const updated = await AdminService.updateOrderStatus(
        req.params.id,
        status,
        req.user,
        { deliveryRiderId, deliveryRiderName, deliveryRiderPhone }
      );
      res.status(200).json({
        success: true,
        data: updated,
        message: `Order status updated to ${status}.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async addItemsToOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { itemsToAdd } = req.body;
      const updated = await AdminService.addItemsToOrder(req.params.id, itemsToAdd, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: `Additional items added to Order #${updated.orderNumber} and notified to Kitchen!`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'ADD_ITEMS_FAILED', message: err.message }
      });
    }
  }

  public static async updatePaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { paymentStatus, paymentMethod } = req.body;
      const updated = await AdminService.updatePaymentStatus(req.params.id, paymentStatus, paymentMethod, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: `Payment status updated to ${paymentStatus}.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async createStaffOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const order = await AdminService.createStaffOrder(req.body, req.user);
      res.status(201).json({
        success: true,
        data: order,
        message: `Order #${order.orderNumber} successfully placed and dispatched to Kitchen Department!`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'ORDER_CREATION_FAILED', message: err.message }
      });
    }
  }

  // Bookings Management
  public static async getAllBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const bookings = await AdminService.getAllBookings({
        status: req.query.status as string,
        date: req.query.date as string,
        search: req.query.search as string
      });
      res.status(200).json({
        success: true,
        data: bookings
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const booking = await AdminService.getBookingById(req.params.id);
      res.status(200).json({
        success: true,
        data: booking
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }

  public static async updateBookingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = await AdminService.updateBookingStatus(req.params.id, req.body.status, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: `Booking status updated to ${req.body.status}.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  // Menu Items Management
  public static async getAllMenuItems(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const items = await AdminService.getAllMenuItems();
      res.status(200).json({
        success: true,
        data: items
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async createMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const newItem = await AdminService.createMenuItem(req.body, req.user);
      res.status(201).json({
        success: true,
        data: newItem,
        message: 'Menu item created successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'CREATE_FAILED', message: err.message }
      });
    }
  }

  public static async updateMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = await AdminService.updateMenuItem(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Menu item updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async deleteMenuItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await AdminService.deleteMenuItem(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Menu item deleted successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: err.message }
      });
    }
  }

  public static async toggleMenuItemAvailability(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = await AdminService.toggleItemAvailability(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: `Item is now ${updated.available ? 'Available' : 'Unavailable'}.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'TOGGLE_FAILED', message: err.message }
      });
    }
  }

  // Category Management
  public static async getAllCategories(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categories = await AdminService.getAllCategories();
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const category = await AdminService.createCategory(req.body, req.user);
      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'CREATE_FAILED', message: err.message }
      });
    }
  }

  public static async updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = await AdminService.updateCategory(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Category updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await AdminService.deleteCategory(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: err.message }
      });
    }
  }

  // Tables Management
  public static async getAllTables(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tables = await AdminService.getAllTables();
      res.status(200).json({
        success: true,
        data: tables
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async createTable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const table = await AdminService.createTable(req.body, req.user);
      res.status(201).json({
        success: true,
        data: table,
        message: 'Table added successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'CREATE_FAILED', message: err.message }
      });
    }
  }

  public static async updateTable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = await AdminService.updateTable(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Table updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async deleteTable(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await AdminService.deleteTable(req.params.id, req.user);
      res.status(200).json({
        success: true,
        message: 'Table deleted successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: err.message }
      });
    }
  }

  // Customers Directory
  public static async getAllCustomers(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const customers = await AdminService.getAllCustomers();
      res.status(200).json({
        success: true,
        data: customers
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async getCustomerById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const customer = await AdminService.getCustomerById(req.params.id);
      res.status(200).json({
        success: true,
        data: customer
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }

  // Audit Logs
  public static async getAuditLogs(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const logs = AdminService.getAuditLogs();
      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  // Notifications
  public static async getNotifications(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = AdminService.getNotifications();
      res.status(200).json({
        success: true,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async markNotificationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const updated = AdminService.markNotificationRead(req.params.id);
      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async markAllNotificationsRead(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      AdminService.markAllNotificationsRead();
      res.status(200).json({
        success: true,
        message: 'All notifications marked as read.'
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  // Reports
  public static async getReports(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const reports = await AdminService.getReports();
      res.status(200).json({
        success: true,
        data: reports
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async clearAllData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = AdminService.clearAllData(req.user);
      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'CLEAR_FAILED', message: err.message }
      });
    }
  }
}
