/**
 * Booking and Order Routes
 */
import { Router } from 'express';
import { BookingController, OrderController } from '../controllers/bookingController.ts';
import { BillingController } from '../controllers/billingController.ts';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware.ts';
import { validateBody } from '../middleware/errorHandler.ts';
import {
  createBookingSchema,
  createOrderSchema,
  updateOrderStatusSchema
} from '../validators/index.ts';

export const bookingRouter = Router();

// Authenticated booking routes
bookingRouter.get('/', authenticateToken, BookingController.getMyBookings);
bookingRouter.get('/my-bookings', authenticateToken, BookingController.getMyBookings);
bookingRouter.post('/', authenticateToken, validateBody(createBookingSchema), BookingController.createBooking);
bookingRouter.delete('/:id', authenticateToken, BookingController.cancelBooking);
bookingRouter.post('/:id/cancel', authenticateToken, BookingController.cancelBooking);

// Public / Optional Auth routes for bookings by ID/reference
bookingRouter.get('/:id', optionalAuth, BookingController.getBookingById);

export const orderRouter = Router();

// Order creation and history
orderRouter.get('/', authenticateToken, OrderController.getMyOrders);
orderRouter.get('/my-orders', authenticateToken, OrderController.getMyOrders);
orderRouter.post('/', optionalAuth, validateBody(createOrderSchema), OrderController.createOrder);
orderRouter.get('/:id', optionalAuth, OrderController.getOrderById);
orderRouter.post('/:id/items', optionalAuth, OrderController.addOrderItems);
orderRouter.put('/:id/status', authenticateToken, validateBody(updateOrderStatusSchema), OrderController.updateOrderStatus);
orderRouter.post('/:id/request-bill', optionalAuth, BillingController.requestBill);
