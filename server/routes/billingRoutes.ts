import { Router } from 'express';
import { BillingController } from '../controllers/billingController.ts';
import { authenticateToken, requireAccess, requireAnyAccess, requireSuperAdmin } from '../middleware/authMiddleware.ts';

export const billingRouter = Router();

// Public route for secure unguessable token access (customer bill viewing / sharing link)
billingRouter.get('/public/:token', BillingController.getPublicInvoice);

// Customer Bill Request (Must be authenticated; customer must own order or be staff/manager/admin)
billingRouter.post('/request/:orderId', authenticateToken, BillingController.requestBill);

// Staff / Manager / Admin Operational Billing Operations
billingRouter.post(
  '/generate/:orderId',
  authenticateToken,
  requireAccess('BILLING', 'FULL'),
  BillingController.generateInvoice
);

// View Invoice by ID (Authenticated; customers can only view their own invoice; staff/manager/admin can view)
billingRouter.get('/invoice/:id', authenticateToken, BillingController.getInvoice);

// Pay Invoice (Settlement by Staff, Manager, or Admin)
billingRouter.post(
  '/invoice/:id/pay',
  authenticateToken,
  requireAccess('BILLING', 'FULL'),
  BillingController.payInvoice
);

// Void Invoice (Restricted strictly to Manager and Admin)
billingRouter.post(
  '/invoice/:id/void',
  authenticateToken,
  requireAccess('BILLING', 'FULL'),
  requireSuperAdmin,
  BillingController.voidInvoice
);

// Operational Billing Requests (Staff, Manager, Admin)
billingRouter.get(
  '/requests',
  authenticateToken,
  requireAccess('BILLING', 'VIEW'),
  BillingController.getBillingRequests
);

// Financial Billing History (Manager and Admin only)
billingRouter.get(
  '/history',
  authenticateToken,
  requireAnyAccess([['BILLING', 'VIEW'], ['REPORTS', 'VIEW']]),
  BillingController.getBillingHistory
);

// Billing Configuration Settings
billingRouter.get(
  '/settings',
  authenticateToken,
  requireAccess('SETTINGS', 'VIEW'),
  BillingController.getSettings
);
billingRouter.put(
  '/settings',
  authenticateToken,
  requireAccess('SETTINGS', 'FULL'),
  requireSuperAdmin,
  BillingController.updateSettings
);

// Financial Billing Reports & Audit Trail (Manager and Admin only)
billingRouter.get(
  '/reports',
  authenticateToken,
  requireAccess('REPORTS', 'VIEW'),
  BillingController.getReports
);
billingRouter.get(
  '/audits',
  authenticateToken,
  requireAccess('REPORTS', 'VIEW'),
  BillingController.getAuditLogs
);
