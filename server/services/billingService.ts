import { OrderRepository } from '../repositories/orderRepository.ts';
import { InvoiceRepository } from '../repositories/invoiceRepository.ts';
import { NotificationRepository } from '../repositories/notificationRepository.ts';
import { AuditRepository } from '../repositories/auditRepository.ts';
import { Invoice, InvoiceItem, BillingSettings, PaymentMethod } from '../types/index.ts';

export class BillingService {
  /**
   * Customer action: Click "Done / Request Bill"
   */
  public static async requestBill(orderId: string, userId?: string, userName?: string) {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (order.status === 'CANCELLED') {
      throw new Error('Cannot request bill for a cancelled order.');
    }

    // Update Order Status to BILLING_PENDING and customerStatus to DONE
    order.customerStatus = 'DONE';
    order.billingRequestedAt = new Date().toISOString();

    // Only transition status if not already paid/completed
    if (order.status !== 'COMPLETED' && order.status !== 'PAID') {
      try {
        await OrderRepository.updateStatus(order.id, 'BILLING_PENDING');
      } catch {
        order.status = 'BILLING_PENDING';
        await OrderRepository.update(order);
      }
    } else {
      await OrderRepository.update(order);
    }

    // Create Staff & Admin Notification
    NotificationRepository.create({
      type: 'PAYMENT_REQUEST',
      title: `Billing Requested — ${order.tableNumber || 'Takeaway'}`,
      message: `${userName || order.customerName} at ${order.tableNumber || 'Counter'} requested bill for Order #${order.orderNumber} (₹${order.total}).`,
      entityId: order.id,
      entityType: 'order'
    });

    // Record Billing Audit
    InvoiceRepository.recordAudit({
      orderId: order.id,
      action: 'BILL_REQUESTED',
      userId: userId || 'GUEST_CUSTOMER',
      userName: userName || order.customerName,
      userRole: 'CUSTOMER',
      details: `Customer requested bill for Order #${order.orderNumber} (${order.tableNumber || 'Takeaway'})`
    });

    return {
      success: true,
      order,
      message: 'Billing request sent to hotel staff. Your bill is being prepared.'
    };
  }

  /**
   * Staff action: "Proceed to Billing" -> Generate Finalized Invoice with Price Snapshots
   */
  public static async generateInvoice(orderId: string, staffUser?: { id: string; name: string; role: string }) {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    // Check if invoice already generated for this order
    const existingInvoice = await InvoiceRepository.getByOrderId(orderId);
    if (existingInvoice) {
      return {
        success: true,
        invoice: existingInvoice,
        isReprint: true,
        message: 'Loaded existing invoice for order.'
      };
    }

    const settings = InvoiceRepository.getSettings();

    // Price Snapshots & Item Calculations
    let subtotal = 0;
    const invoiceItems: InvoiceItem[] = order.items.map((item) => {
      const unitPrice = item.unitPrice;
      const lineTotal = item.quantity * unitPrice;
      subtotal += lineTotal;

      return {
        id: `inv_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        invoiceId: '', // set below
        menuItemId: item.menuItemId,
        productNameSnapshot: item.name,
        quantity: item.quantity,
        unitPriceSnapshot: unitPrice,
        discountSnapshot: 0,
        taxSnapshot: 0,
        lineTotal,
        specialInstructions: item.specialInstructions
      };
    });

    const discountAmount = order.discount || 0;
    const taxableAmount = Math.max(0, subtotal - discountAmount);

    const gstPercent = settings.gstPercent || 5;
    const taxAmount = Math.round(taxableAmount * (gstPercent / 100));

    const serviceFeePercent = settings.serviceFeePercent || 5;
    const serviceCharge = Math.round(taxableAmount * (serviceFeePercent / 100));

    const grandTotal = Math.round(taxableAmount + taxAmount + serviceCharge);

    const invoiceNumber = InvoiceRepository.getNextInvoiceNumber(settings.invoicePrefix);
    const publicToken = `inv_pub_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Set invoice ID on items
    invoiceItems.forEach((it) => (it.invoiceId = invoiceId));

    const invoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.userId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      tableNumber: order.tableNumber,
      orderType: order.orderType,

      items: invoiceItems,
      subtotal,
      discount: discountAmount,
      discountCode: order.discountCode,
      taxableAmount,
      gstPercent,
      tax: taxAmount,
      serviceFeePercent,
      serviceCharge,
      otherCharges: 0,
      grandTotal,

      invoiceStatus: order.paymentStatus === 'PAID' ? 'PAID' : 'ISSUED',
      paymentStatus: order.paymentStatus || 'PENDING',
      paymentMethod: order.paymentMethod || 'UPI',
      amountPaid: order.paymentStatus === 'PAID' ? grandTotal : 0,
      balanceDue: order.paymentStatus === 'PAID' ? 0 : grandTotal,

      publicToken,

      hotelNameSnapshot: settings.hotelName,
      hotelLogoSnapshot: settings.hotelLogoUrl,
      hotelAddressSnapshot: settings.address,
      hotelPhoneSnapshot: settings.phone,
      hotelEmailSnapshot: settings.email,
      hotelGstinSnapshot: settings.gstin,
      hotelFssaiSnapshot: settings.fssaiNumber,
      invoiceFooterSnapshot: settings.invoiceFooter,
      termsSnapshot: settings.termsAndConditions,

      createdBy: staffUser?.id || 'STAFF_SYSTEM',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await InvoiceRepository.save(invoice);

    // Update order status to BILL_GENERATED
    if (order.status !== 'COMPLETED' && order.status !== 'PAID') {
      try {
        await OrderRepository.updateStatus(order.id, 'BILL_GENERATED');
      } catch {
        order.status = 'BILL_GENERATED';
        await OrderRepository.update(order);
      }
    }

    // Record Audit Trail
    InvoiceRepository.recordAudit({
      invoiceId: invoice.id,
      orderId: order.id,
      action: 'BILL_GENERATED',
      userId: staffUser?.id || 'STAFF',
      userName: staffUser?.name || 'Hotel Staff',
      userRole: staffUser?.role || 'ADMIN',
      details: `Invoice ${invoice.invoiceNumber} generated for Order #${order.orderNumber} (Grand Total ₹${grandTotal})`
    });

    return {
      success: true,
      invoice,
      isReprint: false,
      message: `Invoice ${invoiceNumber} generated successfully.`
    };
  }

  /**
   * Collect Payment & Mark Invoice Paid (Cash, UPI, Card)
   */
  public static async payInvoice(
    invoiceId: string,
    paymentMethod: PaymentMethod,
    staffUser?: { id: string; name: string; role: string },
    paymentDetails?: { reference?: string; notes?: string }
  ) {
    const invoice = await InvoiceRepository.getById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found.');
    }

    const order = await OrderRepository.getById(invoice.orderId);
    if (!order) {
      throw new Error('Associated order not found.');
    }

    if (invoice.invoiceStatus === 'VOID' || invoice.invoiceStatus === 'CANCELLED') {
      throw new Error('Cannot process payment for a voided or cancelled invoice.');
    }

    const ref = paymentDetails?.reference || `${paymentMethod}-${Date.now().toString().slice(-6)}`;

    // Mark Invoice Paid
    invoice.paymentStatus = 'PAID';
    invoice.invoiceStatus = 'PAID';
    invoice.paymentMethod = paymentMethod;
    invoice.paymentReference = ref;
    invoice.amountPaid = invoice.grandTotal;
    invoice.balanceDue = 0;
    invoice.receivedBy = staffUser?.name || 'Staff Collector';
    invoice.receivedAt = new Date().toISOString();
    invoice.updatedAt = new Date().toISOString();

    await InvoiceRepository.save(invoice);

    // Update Order to PAID and COMPLETED
    order.paymentStatus = 'PAID';
    order.paymentMethod = paymentMethod;
    try {
      await OrderRepository.updateStatus(order.id, 'COMPLETED');
    } catch {
      order.status = 'COMPLETED';
      await OrderRepository.update(order);
    }

    // Record Billing Audit Log
    InvoiceRepository.recordAudit({
      invoiceId: invoice.id,
      orderId: order.id,
      action: 'PAYMENT_RECEIVED',
      userId: staffUser?.id || 'STAFF',
      userName: staffUser?.name || 'Hotel Staff',
      userRole: staffUser?.role || 'ADMIN',
      details: `Payment of ₹${invoice.grandTotal} received via ${paymentMethod} (Ref: ${ref}) by ${staffUser?.name || 'Staff'}`
    });

    AuditRepository.record({
      adminId: staffUser?.id || 'usr-admin-001',
      adminEmail: staffUser?.name || 'admin@gmail.com',
      action: 'INVOICE_PAID_COMPLETED',
      entity: 'ORDER',
      entityId: order.id,
      newValue: { invoiceNumber: invoice.invoiceNumber, amount: invoice.grandTotal, paymentMethod },
      details: `Invoice ${invoice.invoiceNumber} marked PAID via ${paymentMethod}. Order #${order.orderNumber} COMPLETED.`
    });

    return {
      success: true,
      invoice,
      order,
      message: `Invoice ${invoice.invoiceNumber} marked as PAID. Order #${order.orderNumber} is COMPLETED.`
    };
  }

  /**
   * Void / Cancel Invoice
   */
  public static async voidInvoice(
    invoiceId: string,
    reason: string,
    staffUser?: { id: string; name: string; role: string }
  ) {
    const invoice = await InvoiceRepository.getById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found.');
    }

    invoice.invoiceStatus = 'VOID';
    invoice.paymentStatus = 'FAILED';
    invoice.voidedAt = new Date().toISOString();
    invoice.voidReason = reason || 'Cancelled by staff/admin';
    invoice.voidedBy = staffUser?.name || 'Admin';
    invoice.updatedAt = new Date().toISOString();

    await InvoiceRepository.save(invoice);

    InvoiceRepository.recordAudit({
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      action: 'BILL_CANCELLED',
      userId: staffUser?.id || 'ADMIN',
      userName: staffUser?.name || 'Hotel Admin',
      userRole: staffUser?.role || 'ADMIN',
      details: `Invoice ${invoice.invoiceNumber} voided/cancelled. Reason: ${reason}`
    });

    return {
      success: true,
      invoice,
      message: `Invoice ${invoice.invoiceNumber} has been voided.`
    };
  }

  /**
   * Secure Public Invoice Lookup by Token
   */
  public static async getPublicInvoice(publicToken: string) {
    const invoice = await InvoiceRepository.getByToken(publicToken);
    if (!invoice) {
      throw new Error('Invoice not found or invalid access token.');
    }
    return invoice;
  }

  /**
   * Admin Billing Reports & Sales Metrics
   */
  public static async getReports(startDate?: string, endDate?: string) {
    const invoices = await InvoiceRepository.getAll();

    let filtered = invoices.filter((i) => i.invoiceStatus !== 'VOID' && i.invoiceStatus !== 'CANCELLED');

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filtered = filtered.filter((i) => new Date(i.createdAt).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter((i) => new Date(i.createdAt).getTime() <= endMs);
    }

    const paidInvoices = filtered.filter((i) => i.paymentStatus === 'PAID');

    const totalSales = paidInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
    const totalSubtotal = paidInvoices.reduce((sum, i) => sum + i.subtotal, 0);
    const totalGst = paidInvoices.reduce((sum, i) => sum + i.tax, 0);
    const totalServiceCharge = paidInvoices.reduce((sum, i) => sum + i.serviceCharge, 0);
    const totalDiscount = paidInvoices.reduce((sum, i) => sum + i.discount, 0);

    const cashSales = paidInvoices
      .filter((i) => i.paymentMethod === 'Cash')
      .reduce((sum, i) => sum + i.grandTotal, 0);
    const upiSales = paidInvoices
      .filter((i) => i.paymentMethod === 'UPI')
      .reduce((sum, i) => sum + i.grandTotal, 0);
    const cardSales = paidInvoices
      .filter((i) => i.paymentMethod === 'Card')
      .reduce((sum, i) => sum + i.grandTotal, 0);

    return {
      totalBills: filtered.length,
      paidBillsCount: paidInvoices.length,
      pendingBillsCount: filtered.length - paidInvoices.length,

      totalSales,
      totalSubtotal,
      totalGst,
      totalServiceCharge,
      totalDiscount,

      cashSales,
      upiSales,
      cardSales
    };
  }
}
