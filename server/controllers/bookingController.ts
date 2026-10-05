/**
 * Booking and Order Controllers
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { BookingService } from '../services/bookingService.ts';
import { OrderService } from '../services/orderService.ts';
import { AdminService } from '../services/adminService.ts';

export class BookingController {
  public static async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Please log in to book a table.' }
        });
        return;
      }

      const booking = await BookingService.createBooking({
        userId: req.user.id,
        tableId: req.body.tableId,
        bookingDate: req.body.bookingDate,
        startTime: req.body.startTime,
        guestCount: req.body.guestCount,
        specialRequest: req.body.specialRequest
      });

      res.status(201).json({
        success: true,
        data: booking,
        message: 'Your table has been reserved successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BOOKING_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async getMyBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const bookings = await BookingService.getUserBookings(req.user.id);
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
      const isAdmin = req.user?.role === 'ADMIN';
      const booking = await BookingService.getBooking(req.params.id, req.user?.id, isAdmin);
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

  public static async cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const isAdmin = req.user.role === 'ADMIN';
      const updated = await BookingService.cancelBooking(req.params.id, req.user.id, isAdmin);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Booking cancelled successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'CANCELLATION_FAILED', message: err.message }
      });
    }
  }
}

export class OrderController {
  public static async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Please log in to place an order.' }
        });
        return;
      }

      const rawIdempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        (req.headers['x-idempotency-key'] as string) ||
        req.body?.idempotencyKey;

      if (!rawIdempotencyKey || typeof rawIdempotencyKey !== 'string' || !rawIdempotencyKey.trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            message: 'Idempotency-Key HTTP header is required for order creation to prevent duplicate orders.'
          }
        });
        return;
      }

      const idempotencyKey = rawIdempotencyKey.trim();
      if (idempotencyKey.length > 128 || !/^[A-Za-z0-9_\-\.:]{1,128}$/.test(idempotencyKey)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_IDEMPOTENCY_KEY',
            message: 'Idempotency-Key must be 1 to 128 alphanumeric, hyphen, underscore, colon, or dot characters.'
          }
        });
        return;
      }

      const order = await OrderService.createOrder({
        userId: req.user.id,
        orderType: req.body.orderType,
        tableNumber: req.body.tableNumber,
        bookingReference: req.body.bookingReference,
        roomNumber: req.body.roomNumber,
        deliveryAddress: req.body.deliveryAddress,
        customerName: req.body.customerName || `${req.user.firstName} ${req.user.lastName}`,
        customerPhone: req.body.customerPhone || req.user.phone,
        customerEmail: req.body.customerEmail || req.user.email,
        paymentMethod: req.body.paymentMethod,
        discountCode: req.body.discountCode,
        notes: req.body.notes,
        idempotencyKey,
        items: req.body.items
      });

      res.status(201).json({
        success: true,
        data: order,
        message: 'Order placed successfully.'
      });
    } catch (err: any) {
      if (err.code === 'IDEMPOTENCY_CONFLICT' || err.status === 409 || err.message?.includes('409 Conflict') || err.message?.includes('Idempotency key reused with different')) {
        res.status(409).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: err.message || 'Idempotency key reused with different request payload.'
          }
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: {
          code: 'ORDER_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async getMyOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const orders = await OrderService.getUserOrders(req.user.id);
      res.status(200).json({
        success: true,
        data: orders
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  public static async getOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.user?.role === 'ADMIN';
      const order = await OrderService.getOrder(req.params.id, req.user?.id, isAdmin);
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
      const isAdmin = req.user?.role === 'ADMIN';
      const updated = await OrderService.updateOrderStatus(
        req.params.id,
        req.body.status,
        req.user?.id,
        isAdmin
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: `Order status updated to ${req.body.status}.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  public static async addOrderItems(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const itemsToAdd = req.body.items || req.body.itemsToAdd;
      if (!itemsToAdd || !Array.isArray(itemsToAdd) || itemsToAdd.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ITEMS', message: 'No items provided to add.' }
        });
        return;
      }

      const updated = await AdminService.addItemsToOrder(req.params.id, itemsToAdd, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: `Additional items added to Order #${updated.orderNumber} successfully.`
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'ADD_ITEMS_FAILED', message: err.message }
      });
    }
  }
}
