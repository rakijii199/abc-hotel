/**
 * Payment API Routes
 * Hardened for Production: Strict RBAC on admin endpoints,
 * Webhook signature & amount verification, and elimination of simulated payments in production.
 */
import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.ts';
import { authenticateToken, optionalAuth, requireAccess, requireAnyAccess, requireSuperAdmin } from '../middleware/authMiddleware.ts';
import { paymentRateLimiter } from '../middleware/errorHandler.ts';

export const paymentRouter = Router();

// Public payment configuration for checkout
paymentRouter.get('/config', PaymentController.getPaymentConfig);

// Customer online payment & attempt endpoints (Authentication required)
paymentRouter.post('/create', authenticateToken, paymentRateLimiter, PaymentController.createPaymentOrder);
paymentRouter.post('/create-order', authenticateToken, paymentRateLimiter, PaymentController.createPaymentOrder);
paymentRouter.post('/verify', authenticateToken, paymentRateLimiter, PaymentController.verifyPayment);
paymentRouter.get('/orders/:orderId/status', authenticateToken, PaymentController.getPaymentStatus);

// Unique Payment Attempt Status (for Live QR Polling)
paymentRouter.get('/attempt/:attemptId/status', authenticateToken, PaymentController.getPaymentAttemptStatus);
paymentRouter.post('/attempt/:attemptId/confirm-upi', authenticateToken, paymentRateLimiter, PaymentController.confirmUpiPayment);

// Simulation endpoint is strictly EXCLUDED in production runtime
if (process.env.NODE_ENV !== 'production') {
  paymentRouter.post('/attempt/:attemptId/simulate-success', optionalAuth, PaymentController.simulateUpiPaymentSuccess);
}

paymentRouter.post('/attempt/:attemptId/cancel', authenticateToken, PaymentController.cancelPaymentAttempt);

// Webhook endpoints (Gateway signature verified cryptographically)
paymentRouter.post('/webhook', PaymentController.handleWebhook);
paymentRouter.post('/webhook/razorpay', PaymentController.handleWebhook);

// Admin payment management endpoints (Strictly ADMIN and MANAGER)
paymentRouter.get(
  '/admin/all',
  authenticateToken,
  requireAccess('PAYMENTS', 'VIEW'),
  PaymentController.getAllPaymentsAdmin
);
paymentRouter.get(
  '/admin/payment-settings',
  authenticateToken,
  requireAccess('SETTINGS', 'VIEW'),
  PaymentController.getAdminPaymentSettings
);
paymentRouter.put(
  '/admin/payment-settings',
  authenticateToken,
  requireAccess('SETTINGS', 'FULL'),
  requireSuperAdmin,
  PaymentController.updateAdminPaymentSettings
);
paymentRouter.post(
  '/admin/payment-settings/qr',
  authenticateToken,
  requireAccess('SETTINGS', 'FULL'),
  requireSuperAdmin,
  PaymentController.uploadQrCode
);
paymentRouter.post(
  '/admin/send-request',
  authenticateToken,
  requireAnyAccess([['PAYMENTS', 'FULL'], ['BILLING', 'FULL']]),
  PaymentController.sendPaymentRequestAdmin
);
paymentRouter.post(
  '/admin/:id/refund',
  authenticateToken,
  requireAccess('PAYMENTS', 'FULL'),
  requireSuperAdmin,
  PaymentController.refundPaymentAdmin
);
paymentRouter.post(
  '/admin/:id/reconcile',
  authenticateToken,
  requireAccess('PAYMENTS', 'FULL'),
  PaymentController.reconcilePaymentAdmin
);
