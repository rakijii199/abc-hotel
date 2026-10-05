import { Router } from 'express';
import { BillingController } from '../controllers/billingController.ts';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.ts';

export const billingRouter = Router();

// Public route for secure unguessable token access (customer bill viewing / sharing link)
billingRouter.get('/public/:token', BillingController.getPublicInvoice);

// Customer Bill Request (Must be authenticated; customer must own order or be staff/manager/admin)
billingRouter.post('/request/:orderId', authenticateToken, BillingController.requestBill);

// Staff / Manager / Admin Operational Billing Operations
billingRouter.post(
  '/generate/:orderId',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'STAFF'),
  BillingController.generateInvoice
);

// View Invoice by ID (Authenticated; customers can only view their own invoice; staff/manager/admin can view)
billingRouter.get('/invoice/:id', authenticateToken, BillingController.getInvoice);

// Pay Invoice (Settlement by Staff, Manager, or Admin)
billingRouter.post(
  '/invoice/:id/pay',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'STAFF'),
  BillingController.payInvoice
);

// Void Invoice (Restricted strictly to Manager and Admin)
billingRouter.post(
  '/invoice/:id/void',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  BillingController.voidInvoice
);

// Operational Billing Requests (Staff, Manager, Admin)
billingRouter.get(
  '/requests',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER', 'STAFF'),
  BillingController.getBillingRequests
);

// Financial Billing History (Manager and Admin only)
billingRouter.get(
  '/history',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  BillingController.getBillingHistory
);

// Billing Configuration Settings
billingRouter.get(
  '/settings',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  BillingController.getSettings
);
billingRouter.put(
  '/settings',
  authenticateToken,
  requireRole('ADMIN'),
  BillingController.updateSettings
);

// Financial Billing Reports & Audit Trail (Manager and Admin only)
billingRouter.get(
  '/reports',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  BillingController.getReports
);
billingRouter.get(
  '/audits',
  authenticateToken,
  requireRole('ADMIN', 'MANAGER'),
  BillingController.getAuditLogs
);
