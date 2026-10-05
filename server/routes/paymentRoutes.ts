/**
 * Payment API Routes
 * Hardened for Production: Strict RBAC on admin endpoints,
 * Webhook signature & amount verification, and elimination of simulated payments in production.
 */
import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.ts';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/authMiddleware.ts';

export const paymentRouter = Router();

// Public payment configuration for checkout
paymentRouter.get('/config', PaymentController.getPaymentConfig);

// Customer online payment & attempt endpoints (Authentication required)
paymentRouter.post('/create', authenticateToken, PaymentController.createPaymentOrder);
paymentRouter.post('/create-order', authenticateToken, PaymentController.createPaymentOrder);
paymentRouter.post('/verify', authenticateToken, PaymentController.verifyPayment);
paymentRouter.get('/orders/:orderId/status', optionalAuth, PaymentController.getPaymentStatus);

// Unique Payment Attempt Status (for Live QR Polling)
paymentRouter.get('/attempt/:attemptId/status', optionalAuth, PaymentController.getPaymentAttemptStatus);
paymentRouter.post('/attempt/:attemptId/confirm-upi', optionalAuth, PaymentController.confirmUpiPayment);

// Simulation endpoint is strictly EXCLUDED in production runtime
if (process.env.NODE_ENV !== 'production') {
  paymentRouter.post('/attempt/:attemptId/simulate-success', optionalAuth, PaymentController.simulateUpiPaymentSuccess);
}

paymentRouter.post('/attempt/:attemptId/cancel', optionalAuth, PaymentController.cancelPaymentAttempt);

// Webhook endpoints (Gateway signature verified cryptographically)
paymentRouter.post('/webhook', PaymentController.handleWebhook);
paymentRouter.post('/webhook/razorpay', PaymentController.handleWebhook);

// Admin payment management endpoints (Strictly ADMIN and MANAGER)
paymentRouter.get(
  '/admin/all',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  PaymentController.getAllPaymentsAdmin
);
paymentRouter.get(
  '/admin/payment-settings',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  PaymentController.getAdminPaymentSettings
);
paymentRouter.put(
  '/admin/payment-settings',
  authenticateToken,
  requireRole('ADMIN'),
  PaymentController.updateAdminPaymentSettings
);
paymentRouter.post(
  '/admin/payment-settings/qr',
  authenticateToken,
  requireRole('ADMIN'),
  PaymentController.uploadQrCode
);
paymentRouter.post(
  '/admin/send-request',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  PaymentController.sendPaymentRequestAdmin
);
paymentRouter.post(
  '/admin/:id/refund',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  PaymentController.refundPaymentAdmin
);
paymentRouter.post(
  '/admin/:id/reconcile',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  PaymentController.reconcilePaymentAdmin
);
