/**
 * Kitchen Department Controller
 * Real-Time Kitchen Display System (KDS), Ticket Dispatch, and Station Management
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { NotificationRepository } from '../repositories/notificationRepository.ts';
import { AuditRepository } from '../repositories/auditRepository.ts';
import { Order, OrderStatus } from '../types/index.ts';

export class KitchenController {
  /**
   * Get Active Kitchen Tickets
   * Returns active kitchen orders sorted by urgency/arrival time
   */
  public static async getKitchenOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const targetDate = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : undefined;
      const startDate = typeof req.query.startDate === 'string' && req.query.startDate.trim() ? req.query.startDate.trim() : undefined;
      const endDate = typeof req.query.endDate === 'string' && req.query.endDate.trim() ? req.query.endDate.trim() : undefined;
      const todayStr = new Date().toISOString().split('T')[0];

      let kitchenOrders: Order[] = [];

      if (startDate && endDate) {
        // Date range query (e.g., Today, Last 7 Days, Last 30 Days / 1 Month, Custom Range)
        const allOrders = await OrderRepository.getAll();
        kitchenOrders = allOrders.filter((order) => {
          if (!order.createdAt) return false;
          const orderDate = order.createdAt.split('T')[0];
          return orderDate >= startDate && orderDate <= endDate;
        });
      } else if (targetDate && targetDate !== todayStr) {
        // Specific past date query (supports up to 1 month / 30 days)
        kitchenOrders = await OrderRepository.getByDate(targetDate);
      } else {
        // Today / Live view: active kitchen orders + today's orders
        const allOrders = await OrderRepository.getAll();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        kitchenOrders = allOrders.filter((order) => {
          const isTodayOrder = order.createdAt && order.createdAt.startsWith(todayStr);
          if (isTodayOrder) return true;

          if (
            order.status === 'PLACED' ||
            order.status === 'CONFIRMED' ||
            order.status === 'PREPARING' ||
            order.status === 'READY' ||
            order.status === 'DELIVERY_ASSIGNED' ||
            order.status === 'DELIVERY_ACCEPTED' ||
            order.status === 'PICKED_UP' ||
            order.status === 'OUT_FOR_DELIVERY' ||
            order.status === 'DELIVERED' ||
            order.status === 'SERVED'
          ) {
            return true;
          }
          if (order.status === 'COMPLETED') {
            return new Date(order.updatedAt || order.createdAt).getTime() > oneDayAgo;
          }
          return false;
        });
      }

      // Retain stable chronological position (by createdAt) so food cards do not move below when status changes
      kitchenOrders.sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      res.status(200).json({
        success: true,
        data: kitchenOrders,
        selectedDate: targetDate || todayStr,
        isToday: !targetDate || targetDate === todayStr
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'KITCHEN_FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Update Kitchen Order Status (e.g., Start Cooking, Mark Ready, Dispatch)
   */
  public static async updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: OrderStatus };

      const order = await OrderRepository.getById(id);
      if (!order) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order ticket not found.' }
        });
        return;
      }

      const prevStatus = order.status;
      const updated = await OrderRepository.updateStatus(id, status);
      if (!updated) {
        res.status(400).json({
          success: false,
          error: { code: 'UPDATE_FAILED', message: 'Failed to update order status.' }
        });
        return;
      }

      // Record Kitchen Audit Log
      AuditRepository.record({
        adminId: req.user?.id || 'usr-kitchen',
        adminEmail: req.user?.email || 'kitchen@gmail.com',
        action: 'KITCHEN_UPDATED_STATUS',
        entity: 'ORDER',
        entityId: order.id,
        oldValue: prevStatus,
        newValue: status,
        details: `Kitchen Department marked #${order.orderNumber} as ${status}.`
      });

      // Notify Front-of-House Staff when food is READY
      if (status === 'READY') {
        NotificationRepository.create({
          type: 'ORDER_READY',
          title: `🍽️ Order #${order.orderNumber} is READY!`,
          message: `Kitchen finished preparing Order #${order.orderNumber} for ${order.tableNumber || order.orderType}. Ready for immediate service.`,
          entityId: order.id,
          entityType: 'order'
        });
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: `Order #${order.orderNumber} status changed to ${status}.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'KITCHEN_STATUS_UPDATE_FAILED', message: err.message }
      });
    }
  }

  /**
   * Get Kitchen Department Live Stats
   */
  public static async getKitchenStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const targetDate = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : undefined;
      const startDate = typeof req.query.startDate === 'string' && req.query.startDate.trim() ? req.query.startDate.trim() : undefined;
      const endDate = typeof req.query.endDate === 'string' && req.query.endDate.trim() ? req.query.endDate.trim() : undefined;
      const today = new Date().toISOString().split('T')[0];

      let orders: Order[] = [];
      if (startDate && endDate) {
        const allOrders = await OrderRepository.getAll();
        orders = allOrders.filter((order) => {
          if (!order.createdAt) return false;
          const orderDate = order.createdAt.split('T')[0];
          return orderDate >= startDate && orderDate <= endDate;
        });
      } else if (targetDate && targetDate !== today) {
        orders = await OrderRepository.getByDate(targetDate);
      } else {
        orders = await OrderRepository.getAll();
      }

      const pending = orders.filter((o) => o.status === 'PLACED' || o.status === 'CONFIRMED').length;
      const preparing = orders.filter((o) => o.status === 'PREPARING').length;
      const ready = orders.filter((o) => o.status === 'READY' || o.status === 'DELIVERY_ASSIGNED' || o.status === 'DELIVERY_ACCEPTED' || o.status === 'PICKED_UP').length;
      const completedToday = orders.filter((o) => (o.status === 'COMPLETED' || o.status === 'SERVED' || o.status === 'DELIVERED')).length;

      res.status(200).json({
        success: true,
        data: {
          pending,
          preparing,
          ready,
          completedToday
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'STATS_FETCH_FAILED', message: err.message }
      });
    }
  }
}
