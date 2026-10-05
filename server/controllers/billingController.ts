import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { BillingService } from '../services/billingService.ts';
import { InvoiceRepository } from '../repositories/invoiceRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';

export class BillingController {
  /**
   * Customer Action: POST /api/billing/request/:orderId
   */
  public static async requestBill(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required to request bill.' }
        });
        return;
      }

      if (user.role === 'CUSTOMER') {
        const order = await OrderRepository.getById(orderId);
        if (order && order.userId && order.userId !== user.id) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied: You do not own this order.' }
          });
          return;
        }
      }

      const userId = user.id;
      const userName = `${user.firstName} ${user.lastName}`;

      const result = await BillingService.requestBill(orderId, userId, userName);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'BILL_REQUEST_FAILED', message: err.message }
      });
    }
  }

  /**
   * Staff Action: POST /api/billing/generate/:orderId
   */
  public static async generateInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const staffUser = req.user
        ? { id: req.user.id, name: `${req.user.firstName} ${req.user.lastName}`, role: req.user.role }
        : undefined;

      const result = await BillingService.generateInvoice(orderId, staffUser);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'INVOICE_GENERATE_FAILED', message: err.message }
      });
    }
  }

  /**
   * GET /api/billing/invoice/:id
   */
  public static async getInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      let invoice = await InvoiceRepository.getById(id);
      if (!invoice) {
        invoice = await InvoiceRepository.getByOrderId(id);
      }
      if (!invoice) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Invoice not found.' }
        });
        return;
      }

      // Object-Level Authorization (IDOR Prevention)
      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required to view invoices.' }
        });
        return;
      }

      if (user.role === 'CUSTOMER') {
        const order = await OrderRepository.getById(invoice.orderId);
        if (order && order.userId && order.userId !== user.id) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied: You do not own this invoice.' }
          });
          return;
        }
      } else if (user.role === 'DELIVERY') {
        const order = await OrderRepository.getById(invoice.orderId);
        if (order && order.deliveryRiderId !== user.id) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied: You are not the assigned delivery rider for this invoice.' }
          });
          return;
        }
      }

      res.status(200).json({ success: true, data: invoice });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Public Customer Action: GET /api/billing/public/:token
   */
  public static async getPublicInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const invoice = await BillingService.getPublicInvoice(token);
      res.status(200).json({ success: true, data: invoice });
    } catch (err: any) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }

  /**
   * Staff Action: POST /api/billing/invoice/:id/pay
   */
  public static async payInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { paymentMethod, reference, notes } = req.body || {};
      const staffUser = req.user
        ? { id: req.user.id, name: `${req.user.firstName} ${req.user.lastName}`, role: req.user.role }
        : undefined;

      const result = await BillingService.payInvoice(id, paymentMethod || 'Cash', staffUser, { reference, notes });
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_FAILED', message: err.message }
      });
    }
  }

  /**
   * Admin/Staff Action: POST /api/billing/invoice/:id/void
   */
  public static async voidInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const staffUser = req.user
        ? { id: req.user.id, name: `${req.user.firstName} ${req.user.lastName}`, role: req.user.role }
        : undefined;

      const result = await BillingService.voidInvoice(id, reason, staffUser);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'VOID_FAILED', message: err.message }
      });
    }
  }

  /**
   * Staff Dashboard: GET /api/billing/requests
   */
  public static async getBillingRequests(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const allOrders = await OrderRepository.getAll();
      const billingPendingOrders = allOrders.filter(
        (o) =>
          o.status === 'BILLING_PENDING' ||
          o.customerStatus === 'DONE' ||
          o.status === 'BILL_GENERATED' ||
          o.status === 'SERVED'
      );
      res.status(200).json({ success: true, data: billingPendingOrders });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Staff/Admin Billing History: GET /api/billing/history
   */
  public static async getBillingHistory(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const invoices = await InvoiceRepository.getAll();
      res.status(200).json({ success: true, data: invoices });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Admin Settings: GET /api/billing/settings
   */
  public static async getSettings(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const settings = InvoiceRepository.getSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Admin Settings Update: PUT /api/billing/settings
   */
  public static async updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const settings = InvoiceRepository.updateSettings(req.body || {});
      res.status(200).json({ success: true, data: settings, message: 'Billing settings updated successfully.' });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: err.message }
      });
    }
  }

  /**
   * Admin Reports: GET /api/billing/reports
   */
  public static async getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const reports = await BillingService.getReports(startDate, endDate);
      res.status(200).json({ success: true, data: reports });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Audit Logs: GET /api/billing/audits
   */
  public static async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orderId = req.query.orderId as string;
      const invoiceId = req.query.invoiceId as string;
      const audits = InvoiceRepository.getAuditLogs(orderId, invoiceId);
      res.status(200).json({ success: true, data: audits });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }
}
