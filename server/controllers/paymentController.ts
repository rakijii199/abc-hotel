/**
 * Payment Controller
 * REST API handlers for Online Payment Gateway Operations
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { PaymentService } from '../services/paymentService.ts';

export class PaymentController {
  /**
   * GET /api/payments/config (Public config for checkout)
   */
  public static async getPaymentConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = PaymentService.getPublicPaymentConfig();
      res.status(200).json({
        success: true,
        data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'CONFIG_FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/create-order or /api/payments/create
   */
  public static async createPaymentOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const { orderId, paymentMethod } = req.body;
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_ORDER_ID', message: 'orderId is required.' }
        });
        return;
      }

      const result = await PaymentService.createPaymentOrder(
        req.user.id,
        orderId,
        paymentMethod || 'UPI'
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Payment gateway order created successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_ORDER_CREATE_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/verify
   */
  public static async verifyPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const { orderId, providerOrderId, providerPaymentId, providerSignature } = req.body;

      if (!orderId || !providerOrderId || !providerPaymentId || !providerSignature) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_VERIFICATION_PAYLOAD', message: 'Missing orderId, providerOrderId, providerPaymentId, or providerSignature.' }
        });
        return;
      }

      const result = await PaymentService.verifyPayment(req.user.id, {
        orderId,
        providerOrderId,
        providerPaymentId,
        providerSignature
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          error: { code: 'PAYMENT_VERIFICATION_FAILED', message: result.message }
        });
      }
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_VERIFY_ERROR', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/webhook
   */
  public static async handleWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const signatureHeader = (req.headers['x-razorpay-signature'] as string) || '';
      const bodyRaw = (req as any).rawBody || JSON.stringify(req.body);

      const result = await PaymentService.handleWebhook(bodyRaw, signatureHeader, req.body);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      console.error('[PAYMENT_WEBHOOK] Webhook processing failed:', err);
      res.status(400).json({
        success: false,
        error: { code: 'WEBHOOK_FAILED', message: err.message }
      });
    }
  }

  /**
   * GET /api/payments/orders/:orderId/status
   */
  public static async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.user?.role === 'ADMIN';
      const result = await PaymentService.getPaymentStatusByOrderId(
        req.params.orderId,
        req.user?.id,
        isAdmin
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }

  /**
   * GET /api/payments/admin/all
   */
  public static async getAllPaymentsAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin privileges required.' }
        });
        return;
      }

      const payments = await PaymentService.getAllPaymentsAdmin();
      res.status(200).json({
        success: true,
        data: payments
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/admin/:id/refund
   */
  public static async refundPaymentAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin privileges required.' }
        });
        return;
      }

      const { amount, reason } = req.body;
      const result = await PaymentService.refundPaymentAdmin(
        req.params.id,
        amount,
        reason,
        req.user
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Refund processed successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'REFUND_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/admin/send-request
   */
  public static async sendPaymentRequestAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin privileges required.' }
        });
        return;
      }

      const { orderId, messageNote } = req.body;
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_ORDER_ID', message: 'orderId is required.' }
        });
        return;
      }

      const result = await PaymentService.sendPaymentRequestAdmin(
        orderId,
        messageNote,
        req.user
      );

      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_REQUEST_FAILED', message: err.message }
      });
    }
  }

  /**
   * GET /api/payments/attempt/:attemptId/status
   */
  public static async getPaymentAttemptStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = PaymentService.getPaymentAttemptStatus(req.params.attemptId, req.user?.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'ATTEMPT_NOT_FOUND', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/attempt/:attemptId/simulate-success
   */
  public static async simulateUpiPaymentSuccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'The requested API endpoint was not found on this server.' }
      });
      return;
    }

    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const result = await PaymentService.simulateUpiPaymentSuccess(req.params.attemptId, req.user.id);
      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'SIMULATION_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/attempt/:attemptId/confirm-upi
   */
  public static async confirmUpiPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { utrNumber } = req.body || {};
      const result = await PaymentService.confirmUpiPayment(
        req.params.attemptId,
        req.user?.id,
        utrNumber
      );
      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPI_CONFIRM_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/payments/attempt/:attemptId/cancel
   */
  public static async cancelPaymentAttempt(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        });
        return;
      }

      const result = PaymentService.cancelPaymentAttempt(req.params.attemptId, req.user.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'CANCEL_FAILED', message: err.message }
      });
    }
  }

  /**
   * GET /api/admin/payment-settings
   */
  public static async getAdminPaymentSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin or Manager privileges required.' }
        });
        return;
      }

      const settings = PaymentService.getAdminPaymentSettings();
      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'SETTINGS_FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * PUT /api/admin/payment-settings
   */
  public static async updateAdminPaymentSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin or Manager privileges required.' }
        });
        return;
      }

      const updated = PaymentService.updateAdminPaymentSettings(req.body, req.user);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Hotel payment configuration updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'SETTINGS_UPDATE_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/admin/payment-settings/qr
   */
  public static async uploadQrCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin or Manager privileges required.' }
        });
        return;
      }

      const { qrCodeUrl, qrCodeBase64 } = req.body;
      const targetUrl = qrCodeUrl || qrCodeBase64;
      if (!targetUrl) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_QR_IMAGE', message: 'QR Code image URL or base64 data required.' }
        });
        return;
      }

      // Basic validation on image data/url
      if (!targetUrl.startsWith('data:image/') && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_IMAGE_FORMAT', message: 'QR Code must be a valid HTTPS image URL or base64 data (PNG, JPG, WEBP).' }
        });
        return;
      }

      const updated = PaymentService.updateAdminPaymentSettings(
        { hotelQrCodeUrl: targetUrl },
        req.user
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Hotel QR code updated and validated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'QR_UPLOAD_FAILED', message: err.message }
      });
    }
  }

  /**
   * POST /api/admin/payments/:id/reconcile
   */
  public static async reconcilePaymentAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin privileges required.' }
        });
        return;
      }

      const result = await PaymentService.reconcilePaymentAdmin(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'RECONCILE_FAILED', message: err.message }
      });
    }
  }
}
