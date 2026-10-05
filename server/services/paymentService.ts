/**
 * Payment Service
 * Orchestrates Payment Gateways, Verification, Signature Checks, Idempotency,
 * Amount Security, Payment Attempt History, and Webhook Processing.
 */
import { config } from '../config/index.ts';
import { db } from '../database/db.ts';
import { MenuRepository } from '../repositories/menuRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { PaymentRepository } from '../repositories/paymentRepository.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { InvoiceRepository } from '../repositories/invoiceRepository.ts';
import { NotificationRepository } from '../repositories/notificationRepository.ts';
import { AuditRepository } from '../repositories/auditRepository.ts';
import { RazorpayPaymentProvider } from './payments/razorpayProvider.ts';
import { PaymentProvider } from './payments/paymentProvider.ts';
import { Order, Payment, PaymentAttempt, PaymentConfiguration, PaymentGatewayStatus, PaymentMethod, SafeUser } from '../types/index.ts';

export class PaymentService {
  private static provider: PaymentProvider = new RazorpayPaymentProvider();

  /**
   * Set dynamic payment provider (for testing or switching providers)
   */
  public static setProvider(provider: PaymentProvider): void {
    PaymentService.provider = provider;
  }

  public static getProvider(): PaymentProvider {
    return PaymentService.provider;
  }

  /**
   * Public Payment Config for Customer Checkout
   */
  public static getPublicPaymentConfig() {
    const cfg = PaymentRepository.getConfig();
    return {
      hotelName: cfg.hotelName,
      hotelUpiId: cfg.hotelUpiId,
      hotelMobileNumber: cfg.hotelMobileNumber,
      hotelQrCodeUrl: cfg.hotelQrCodeUrl,
      paymentProvider: cfg.paymentProvider,
      paymentEnvironment: cfg.paymentEnvironment,
      paymentInstructions: cfg.paymentInstructions,
      supportContactNumber: cfg.supportContactNumber
    };
  }

  /**
   * Admin Payment Settings
   */
  public static getAdminPaymentSettings(): PaymentConfiguration {
    return PaymentRepository.getConfig();
  }

  public static async updateAdminPaymentSettings(
    settings: Partial<PaymentConfiguration>,
    adminUser?: SafeUser
  ): Promise<PaymentConfiguration> {
    if (settings.hotelMobileNumber && !/^[+0-9\s-]{7,25}$/.test(settings.hotelMobileNumber)) {
      throw new Error('Invalid mobile number format.');
    }
    if (settings.hotelUpiId && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(settings.hotelUpiId)) {
      throw new Error('Invalid UPI ID format (expected format like abchotel@upi).');
    }

    const updated = await PaymentRepository.updateConfig(settings);

    AuditRepository.record({
      adminId: adminUser?.id || 'admin',
      adminEmail: adminUser?.email || 'admin@gmail.com',
      action: 'PAYMENT_SETTINGS_UPDATED',
      entity: 'SETTINGS',
      entityId: updated.id,
      newValue: updated,
      details: `Payment settings updated by ${adminUser?.firstName || 'Admin'} (UPI: ${updated.hotelUpiId}, Name: ${updated.hotelName}).`
    });

    return updated;
  }

  /**
   * 1. CREATE PAYMENT GATEWAY ORDER / ATTEMPT
   * Server-Side Price Verification and Gateway Order Creation
   */
  public static async createPaymentOrder(
    userId: string,
    orderId: string,
    method: PaymentMethod = 'UPI'
  ) {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    // Security Check: Verify order belongs to user
    if (order.userId !== userId) {
      throw new Error('Unauthorized: You do not own this order.');
    }

    if (order.paymentStatus === 'PAID') {
      throw new Error('This order has already been paid and confirmed.');
    }

    // CRITICAL: Calculate TRUSTED Server-Side Amount strictly from DB items
    let trustedSubtotal = 0;
    for (const item of order.items) {
      const dbItem = await MenuRepository.getItemById(item.menuItemId);
      if (!dbItem) {
        throw new Error(`Menu item ${item.name} is no longer available.`);
      }
      trustedSubtotal += dbItem.price * item.quantity;
    }

    let discount = 0;
    if (order.discountCode === config.hotel.discountCode) {
      discount = Math.round(trustedSubtotal * config.hotel.discountPercent);
    }

    const taxableAmount = Math.max(0, trustedSubtotal - discount);
    const tax = Math.round(taxableAmount * config.hotel.taxRate);
    const serviceCharge = order.orderType === 'Takeaway' ? 0 : config.hotel.serviceCharge;
    const trustedTotal = taxableAmount + tax + serviceCharge;

    // Update order total if there was any discrepancy
    if (order.total !== trustedTotal) {
      order.subtotal = trustedSubtotal;
      order.tax = tax;
      order.discount = discount;
      order.serviceCharge = serviceCharge;
      order.total = trustedTotal;
      await OrderRepository.update(order);
    }

    // Call Provider to Create Gateway Order
    const gatewayResult = await PaymentService.provider.createPaymentOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountInRupees: trustedTotal,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone
    });

    // Create unique payment reference
    const paymentRef = `ABC-ORD-${order.orderNumber}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Get current payment config
    const paymentConfig = PaymentRepository.getConfig();

    // Standard UPI Intent URL
    const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(paymentConfig.hotelUpiId)}&pn=${encodeURIComponent(paymentConfig.hotelName)}&am=${trustedTotal}&cu=INR&tn=${encodeURIComponent(`Order ${order.orderNumber} ${paymentRef}`)}&tr=${encodeURIComponent(paymentRef)}`;

    // Create or update Payment record
    let payment = await PaymentRepository.getByOrderId(order.id);
    const paymentId = payment?.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    payment = {
      id: paymentId,
      orderId: order.id,
      provider: PaymentService.provider.name,
      providerOrderId: gatewayResult.providerOrderId,
      amount: trustedTotal,
      currency: gatewayResult.currency,
      paymentMethod: method,
      transactionId: gatewayResult.providerOrderId,
      status: 'CREATED',
      createdAt: payment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await PaymentRepository.save(payment);

    // High-resolution dynamic QR code directly encoded with NPCI standard UPI intent
    const dynamicQrUrl = paymentConfig.hotelQrCodeUrl && !paymentConfig.hotelQrCodeUrl.includes('unsplash')
      ? paymentConfig.hotelQrCodeUrl
      : `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiIntentUrl)}&margin=12`;

    // Save Payment Attempt History (Unique for every checkout / retry attempt)
    const attempt: PaymentAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orderId: order.id,
      orderDraftId: order.id,
      customerId: userId,
      paymentId: payment.id,
      providerOrderId: gatewayResult.providerOrderId,
      paymentReference: paymentRef,
      amount: trustedTotal,
      currency: gatewayResult.currency,
      method,
      provider: PaymentService.provider.name,
      status: 'PENDING',
      qrCodeUrl: dynamicQrUrl,
      upiIntentUrl,
      upiId: paymentConfig.hotelUpiId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiration
      createdAt: new Date().toISOString()
    };
    PaymentRepository.saveAttempt(attempt);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      attemptId: attempt.id,
      paymentReference: paymentRef,
      paymentId: payment.id,
      providerOrderId: gatewayResult.providerOrderId,
      amount: gatewayResult.amount, // in paise
      amountInRupees: trustedTotal,
      currency: gatewayResult.currency,
      keyId: gatewayResult.keyId,
      environment: gatewayResult.environment,
      hotelName: paymentConfig.hotelName,
      hotelUpiId: paymentConfig.hotelUpiId,
      hotelMobileNumber: paymentConfig.hotelMobileNumber,
      hotelQrCodeUrl: dynamicQrUrl,
      upiIntentUrl,
      paymentInstructions: paymentConfig.paymentInstructions,
      expiresAt: attempt.expiresAt,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone
    };
  }

  /**
   * Check Status of a specific Payment Attempt (for Polling)
   */
  public static async getPaymentAttemptStatus(attemptId: string, _userId?: string) {
    const attempt = await PaymentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error('Payment attempt not found.');
    }

    const order = await OrderRepository.getById(attempt.orderId);
    if (!order) {
      throw new Error('Associated order not found.');
    }

    // Auto-sync if order was already marked PAID
    if (order.paymentStatus === 'PAID' && attempt.status !== 'SUCCESS') {
      attempt.status = 'SUCCESS';
      attempt.updatedAt = new Date().toISOString();
      PaymentRepository.saveAttempt(attempt);
    }

    // Auto-expire attempt if expired
    if ((attempt.status === 'PENDING' || attempt.status === 'CREATED') && attempt.expiresAt) {
      if (new Date(attempt.expiresAt).getTime() < Date.now()) {
        attempt.status = 'EXPIRED';
        attempt.updatedAt = new Date().toISOString();
        PaymentRepository.saveAttempt(attempt);
      }
    }

    return {
      attemptId: attempt.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentReference: attempt.paymentReference,
      amount: attempt.amount,
      currency: attempt.currency,
      method: attempt.method,
      status: attempt.status,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      expiresAt: attempt.expiresAt,
      createdAt: attempt.createdAt
    };
  }

  /**
   * Simulate UPI Payment Success (In Sandbox / Test Mode for Seamless Verification)
   * FORBIDDEN IN PRODUCTION
   */
  public static async simulateUpiPaymentSuccess(attemptId: string, userId?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Payment simulation endpoint is strictly forbidden in production environments.');
    }

    const attempt = await PaymentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error('Payment attempt not found.');
    }

    const order = await OrderRepository.getById(attempt.orderId);
    if (!order) {
      throw new Error('Associated order not found.');
    }

    if (order.paymentStatus === 'PAID') {
      const existingPayment = await PaymentRepository.getByOrderId(order.id);
      return {
        success: true,
        alreadyProcessed: true,
        order,
        payment: existingPayment,
        attempt,
        message: 'Order has already been verified and paid.'
      };
    }

    const mockProviderPaymentId = `pay_upi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Update Attempt
    attempt.status = 'SUCCESS';
    attempt.providerPaymentId = mockProviderPaymentId;
    attempt.updatedAt = new Date().toISOString();
    PaymentRepository.saveAttempt(attempt);

    // Update Payment
    let payment = await PaymentRepository.getByOrderId(order.id);
    if (!payment) {
      payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        provider: PaymentService.provider.name,
        providerOrderId: attempt.providerOrderId,
        providerPaymentId: mockProviderPaymentId,
        amount: order.total,
        currency: 'INR',
        paymentMethod: 'UPI',
        transactionId: mockProviderPaymentId,
        status: 'CAPTURED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } else {
      payment.status = 'CAPTURED';
      payment.providerPaymentId = mockProviderPaymentId;
      payment.transactionId = mockProviderPaymentId;
      payment.paymentMethod = 'UPI';
      payment.updatedAt = new Date().toISOString();
    }
    await PaymentRepository.save(payment);

    // Update Order Authoritatively
    order.paymentStatus = 'PAID';
    order.paymentMethod = 'UPI';
    if (order.status === 'PLACED') {
      order.status = 'CONFIRMED';
    } else if (order.status !== 'CANCELLED') {
      order.status = 'COMPLETED';
    }
    order.updatedAt = new Date().toISOString();
    await OrderRepository.update(order);

    const invSim = await InvoiceRepository.getByOrderId(order.id);
    if (invSim) {
      invSim.paymentStatus = 'PAID';
      invSim.invoiceStatus = 'PAID';
      invSim.paymentMethod = 'UPI';
      invSim.paymentReference = mockProviderPaymentId;
      invSim.amountPaid = invSim.grandTotal;
      invSim.balanceDue = 0;
      invSim.updatedAt = new Date().toISOString();
      await InvoiceRepository.save(invSim);
    }

    AuditRepository.record({
      adminId: userId || 'SYSTEM_GUEST',
      adminEmail: order.customerEmail,
      action: 'UPI_PAYMENT_VERIFIED_CAPTURED',
      entity: 'ORDER',
      entityId: order.id,
      newValue: { paymentId: payment.id, providerPaymentId: mockProviderPaymentId, amount: order.total },
      details: `UPI Payment of ₹${order.total} for Order #${order.orderNumber} successfully verified with Hotel VPA (${mockProviderPaymentId}).`
    });

    NotificationRepository.create({
      type: 'NEW_ORDER',
      title: `Payment Confirmed — Order #${order.orderNumber}`,
      message: `${order.customerName} paid ₹${order.total} via Hotel UPI QR. Order is now CONFIRMED.`,
      entityId: order.id,
      entityType: 'order'
    });

    return {
      success: true,
      alreadyProcessed: false,
      order,
      payment,
      attempt,
      message: 'Payment verified successfully! Order confirmed.'
    };
  }

  /**
   * Confirm and Verify Live UPI Payment (Automated Verification via UTR or Direct Confirmation)
   */
  public static async confirmUpiPayment(
    attemptId: string,
    userId?: string,
    utrNumber?: string
  ) {
    const attempt = await PaymentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error('Payment attempt not found.');
    }

    const order = await OrderRepository.getById(attempt.orderId);
    if (!order) {
      throw new Error('Associated order not found.');
    }

    const paymentConfig = PaymentRepository.getConfig();

    if (order.paymentStatus === 'PAID') {
      const existingPayment = await PaymentRepository.getByOrderId(order.id);
      return {
        success: true,
        alreadyProcessed: true,
        order,
        payment: existingPayment,
        attempt,
        message: 'Order has already been confirmed and marked as PAID.'
      };
    }

    const cleanUtr = utrNumber?.trim() || `SUBMITTED-${Date.now().toString().slice(-8)}`;
    const txnId = `pay_upi_${cleanUtr}`;

    // Update Attempt with PENDING_VERIFICATION (Customer submitted reference, requires staff reconciliation or gateway webhook)
    attempt.status = 'PENDING';
    attempt.providerPaymentId = cleanUtr;
    attempt.updatedAt = new Date().toISOString();
    await PaymentRepository.saveAttempt(attempt);

    // Update Payment Record with PENDING status (NEVER CAPTURED merely from customer input)
    let payment = await PaymentRepository.getByOrderId(order.id);
    if (!payment) {
      payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        provider: 'custom_upi',
        providerOrderId: attempt.providerOrderId,
        providerPaymentId: cleanUtr,
        amount: order.total,
        currency: 'INR',
        paymentMethod: 'UPI',
        transactionId: txnId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } else {
      payment.status = 'PENDING';
      payment.providerPaymentId = cleanUtr;
      payment.transactionId = txnId;
      payment.paymentMethod = 'UPI';
      payment.updatedAt = new Date().toISOString();
    }
    await PaymentRepository.save(payment);

    // Update Order payment status to PENDING with reference recorded (Order remains awaiting payment verification)
    order.paymentStatus = 'PENDING';
    order.paymentMethod = 'UPI';
    order.updatedAt = new Date().toISOString();
    await OrderRepository.update(order);

    const invUpi = await InvoiceRepository.getByOrderId(order.id);
    if (invUpi && invUpi.paymentStatus !== 'PAID') {
      invUpi.paymentMethod = 'UPI';
      invUpi.paymentReference = cleanUtr;
      invUpi.updatedAt = new Date().toISOString();
      await InvoiceRepository.save(invUpi);
    }

    AuditRepository.record({
      adminId: userId || 'SYSTEM',
      adminEmail: order.customerEmail,
      action: 'UPI_PAYMENT_SUBMITTED' as any,
      entity: 'ORDER',
      entityId: order.id,
      newValue: { paymentId: payment.id, providerPaymentId: cleanUtr, amount: order.total, upiId: paymentConfig.hotelUpiId },
      details: `Customer submitted UPI UTR/Ref ${cleanUtr} for ₹${order.total}. Pending cashier verification.`
    });

    NotificationRepository.create({
      type: 'PAYMENT_PENDING_VERIFICATION' as any,
      title: `UPI Payment Verification Required — Order #${order.orderNumber}`,
      message: `${order.customerName} submitted UPI UTR ${cleanUtr} for ₹${order.total}. Please verify in bank/UPI app and reconcile.`,
      entityId: order.id,
      entityType: 'order'
    });

    return {
      success: true,
      alreadyProcessed: false,
      order,
      payment,
      attempt,
      message: `UPI payment reference ${cleanUtr} received. Awaiting cashier verification.`
    };
  }

  /**
   * Cancel Payment Attempt
   */
  public static async cancelPaymentAttempt(attemptId: string, userId: string) {
    const attempt = await PaymentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error('Payment attempt not found.');
    }
    const order = await OrderRepository.getById(attempt.orderId);
    if (order && order.userId !== userId) {
      throw new Error('Unauthorized access.');
    }
    if (attempt.status === 'SUCCESS' || attempt.status === 'CAPTURED') {
      throw new Error('Cannot cancel a completed payment.');
    }
    attempt.status = 'CANCELLED';
    attempt.updatedAt = new Date().toISOString();
    await PaymentRepository.saveAttempt(attempt);
    return { success: true, message: 'Payment attempt cancelled.' };
  }

  /**
   * 2. VERIFY PAYMENT (HMAC Signature Verification & Authoritative Order Update)
   */
  public static async verifyPayment(
    userId: string,
    params: {
      orderId: string;
      providerOrderId: string;
      providerPaymentId: string;
      providerSignature: string;
    }
  ) {
    const order = await OrderRepository.getById(params.orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (order.userId !== userId) {
      throw new Error('Unauthorized access to verify this payment.');
    }

    // IDEMPOTENCY CHECK: If already paid, return existing success state
    if (order.paymentStatus === 'PAID') {
      const existingPayment = await PaymentRepository.getByOrderId(order.id);
      return {
        success: true,
        alreadyProcessed: true,
        order,
        payment: existingPayment,
        message: 'Payment has already been verified and processed.'
      };
    }

    // Signature Verification via PaymentProvider
    const verifyResult = await PaymentService.provider.verifyPayment({
      orderId: order.id,
      providerOrderId: params.providerOrderId,
      providerPaymentId: params.providerPaymentId,
      providerSignature: params.providerSignature
    });

    let payment = await PaymentRepository.getByOrderId(order.id);
    if (!payment) {
      payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        provider: PaymentService.provider.name,
        providerOrderId: params.providerOrderId,
        amount: order.total,
        currency: 'INR',
        paymentMethod: verifyResult.method || order.paymentMethod || 'UPI',
        transactionId: params.providerPaymentId,
        status: verifyResult.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    if (verifyResult.success) {
      // Mark Payment as CAPTURED
      payment.status = 'CAPTURED';
      payment.providerPaymentId = params.providerPaymentId;
      payment.providerSignature = params.providerSignature;
      payment.transactionId = params.providerPaymentId;
      payment.paymentMethod = verifyResult.method || order.paymentMethod || 'UPI';
      payment.updatedAt = new Date().toISOString();
      await PaymentRepository.save(payment);

      // Save Successful Payment Attempt
      PaymentRepository.saveAttempt({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        paymentId: payment.id,
        providerOrderId: params.providerOrderId,
        providerPaymentId: params.providerPaymentId,
        paymentReference: params.providerPaymentId || params.providerOrderId,
        provider: 'razorpay',
        amount: order.total,
        currency: 'INR',
        method: payment.paymentMethod,
        status: 'CAPTURED',
        createdAt: new Date().toISOString()
      });

      // Update Order Status Authoritatively
      order.paymentStatus = 'PAID';
      order.paymentMethod = payment.paymentMethod;
      if (order.status === 'PLACED') {
        order.status = 'CONFIRMED';
      } else if (order.status !== 'CANCELLED') {
        order.status = 'COMPLETED';
      }
      order.updatedAt = new Date().toISOString();
      await OrderRepository.update(order);

      const invVerify = await InvoiceRepository.getByOrderId(order.id);
      if (invVerify) {
        invVerify.paymentStatus = 'PAID';
        invVerify.invoiceStatus = 'PAID';
        invVerify.paymentMethod = payment.paymentMethod;
        invVerify.paymentReference = params.providerPaymentId;
        invVerify.amountPaid = invVerify.grandTotal;
        invVerify.balanceDue = 0;
        invVerify.updatedAt = new Date().toISOString();
        await InvoiceRepository.save(invVerify);
      }

      // Audit Log & Notification
      AuditRepository.record({
        adminId: userId,
        adminEmail: order.customerEmail,
        action: 'PAYMENT_VERIFIED_CAPTURED',
        entity: 'ORDER',
        entityId: order.id,
        newValue: { paymentId: payment.id, providerPaymentId: params.providerPaymentId, amount: order.total },
        details: `Payment of ₹${order.total} for Order #${order.orderNumber} successfully verified via ${payment.paymentMethod} (${params.providerPaymentId}).`
      });

      NotificationRepository.create({
        type: 'NEW_ORDER',
        title: `Payment Confirmed — Order #${order.orderNumber}`,
        message: `${order.customerName} paid ₹${order.total} via ${payment.paymentMethod}. Order is now CONFIRMED.`,
        entityId: order.id,
        entityType: 'order'
      });

      return {
        success: true,
        alreadyProcessed: false,
        order,
        payment,
        message: 'Payment verified successfully. Order confirmed!'
      };
    } else {
      // Verification Failed
      payment.status = 'FAILED';
      payment.failureCode = verifyResult.failureCode || 'VERIFICATION_FAILED';
      payment.failureMessage = verifyResult.failureMessage || 'Signature verification failed.';
      await PaymentRepository.save(payment);

      PaymentRepository.saveAttempt({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        paymentId: payment.id,
        providerOrderId: params.providerOrderId,
        providerPaymentId: params.providerPaymentId,
        paymentReference: params.providerPaymentId || params.providerOrderId,
        provider: 'razorpay',
        amount: order.total,
        currency: 'INR',
        method: order.paymentMethod,
        status: 'FAILED',
        failureReason: payment.failureMessage,
        createdAt: new Date().toISOString()
      });

      return {
        success: false,
        alreadyProcessed: false,
        order,
        payment,
        message: payment.failureMessage || 'Payment verification failed.'
      };
    }
  }

  /**
   * 3. HANDLE GATEWAY WEBHOOK (Idempotent Event Handler)
   */
  public static async handleWebhook(bodyRaw: string, signatureHeader: string, payload: any) {
    const isValidSignature = PaymentService.provider.verifyWebhookSignature(bodyRaw, signatureHeader);
    if (!isValidSignature) {
      throw new Error('Webhook signature verification failed.');
    }

    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const providerOrderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;
    const providerPaymentId = paymentEntity?.id;

    if (!providerOrderId && !providerPaymentId) {
      return { success: true, processed: false, reason: 'No order or payment ID in event payload.' };
    }

    // Locate Payment / Order
    let payment = (providerOrderId ? await PaymentRepository.getByProviderOrderId(providerOrderId) : null) || (providerPaymentId ? await PaymentRepository.getByProviderPaymentId(providerPaymentId) : null);
    let order = payment ? await OrderRepository.getById(payment.orderId) : null;

    if (!order && providerOrderId) {
      // Search orders for matching order notes or providerOrderId
      const allOrders = await OrderRepository.getAll();
      order = allOrders.find((o) => o.id === paymentEntity?.notes?.orderId) || null;
    }

    if (!order) {
      return { success: true, processed: false, reason: 'Order not found for webhook event.' };
    }

    // Validate currency
    if (paymentEntity?.currency && paymentEntity.currency.toUpperCase() !== 'INR') {
      throw new Error(`Invalid payment currency: ${paymentEntity.currency}. Expected INR.`);
    }

    // Validate amount (in paise) matches order total
    if (paymentEntity?.amount !== undefined) {
      const expectedPaise = Math.round(order.total * 100);
      if (paymentEntity.amount !== expectedPaise) {
        console.error(`[SECURITY ALERT] Webhook payment amount mismatch! Order #${order.orderNumber} requires ₹${order.total} (${expectedPaise} paise), but webhook received ${paymentEntity.amount} paise.`);
        throw new Error('Payment amount does not match order total.');
      }
    }

    // IDEMPOTENCY CHECK
    if (event === 'payment.captured' || event === 'order.paid') {
      if (order.paymentStatus === 'PAID') {
        return { success: true, processed: true, idempotent: true, message: 'Event already processed.' };
      }

      if (!payment) {
        payment = {
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          orderId: order.id,
          provider: PaymentService.provider.name,
          providerOrderId,
          providerPaymentId,
          amount: order.total,
          currency: 'INR',
          paymentMethod: paymentEntity?.method === 'card' ? 'Card' : 'UPI',
          transactionId: providerPaymentId || providerOrderId,
          status: 'CAPTURED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        payment.status = 'CAPTURED';
        payment.providerPaymentId = providerPaymentId || payment.providerPaymentId;
      }
      await PaymentRepository.save(payment);

      order.paymentStatus = 'PAID';
      if (order.status === 'PLACED') {
        order.status = 'CONFIRMED';
      }
      await OrderRepository.update(order);

      // Idempotently update Invoice
      const inv = await InvoiceRepository.getByOrderId(order.id);
      if (inv && inv.paymentStatus !== 'PAID') {
        inv.paymentStatus = 'PAID';
        inv.invoiceStatus = 'PAID';
        inv.amountPaid = inv.grandTotal;
        inv.balanceDue = 0;
        inv.paymentReference = providerPaymentId || providerOrderId;
        inv.paymentMethod = payment.paymentMethod || 'Online';
        inv.updatedAt = new Date().toISOString();
        await InvoiceRepository.save(inv);
      }

      return { success: true, processed: true, idempotent: false, orderId: order.id };
    } else if (event === 'payment.failed') {
      if (payment) {
        payment.status = 'FAILED';
        payment.failureMessage = paymentEntity?.error_description || 'Payment failed at gateway.';
        await PaymentRepository.save(payment);
      }
      return { success: true, processed: true, idempotent: false, orderId: order.id };
    }

    return { success: true, processed: false, message: `Event ${event} received.` };
  }

  /**
   * 4. GET PAYMENT STATUS & ATTEMPTS FOR AN ORDER
   */
  public static async getPaymentStatusByOrderId(orderId: string, userId?: string, isAdmin = false) {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (!isAdmin && userId && order.userId !== userId) {
      throw new Error('Unauthorized access.');
    }

    const payment = await PaymentRepository.getByOrderId(order.id);
    const attempts = await PaymentRepository.getAttemptsByOrderId(order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      total: order.total,
      payment,
      attempts
    };
  }

  /**
   * 5. GET ALL PAYMENTS (ADMIN)
   */
  public static async getAllPaymentsAdmin(): Promise<Array<Payment & { orderNumber?: string; customerName?: string; customerEmail?: string }>> {
    const payments = await PaymentRepository.getAll();
    const allOrders = await OrderRepository.getAll();
    const orderMap = new Map(allOrders.map((o) => [o.id, o]));
    return payments.map((p) => {
      const order = orderMap.get(p.orderId);
      return {
        ...p,
        orderNumber: order?.orderNumber,
        customerName: order?.customerName,
        customerEmail: order?.customerEmail
      };
    });
  }

  /**
   * 6. REFUND PAYMENT (ADMIN)
   */
  public static async refundPaymentAdmin(
    paymentId: string,
    amountInRupees?: number,
    reason?: string,
    adminUser?: SafeUser
  ) {
    const payment = await PaymentRepository.getById(paymentId);
    if (!payment) {
      throw new Error('Payment record not found.');
    }

    if (payment.status !== 'CAPTURED') {
      throw new Error('Only CAPTURED payments can be refunded.');
    }

    const order = await OrderRepository.getById(payment.orderId);
    if (!order) {
      throw new Error('Associated order not found.');
    }

    const refundResult = await PaymentService.provider.refundPayment({
      providerPaymentId: payment.providerPaymentId || payment.transactionId,
      amountInRupees: amountInRupees || payment.amount,
      reason: reason || 'Admin initiated refund'
    });

    payment.status = 'REFUNDED';
    payment.updatedAt = new Date().toISOString();
    await PaymentRepository.save(payment);

    order.paymentStatus = 'REFUNDED';
    order.updatedAt = new Date().toISOString();
    await OrderRepository.update(order);

    AuditRepository.record({
      adminId: adminUser?.id || 'admin',
      adminEmail: adminUser?.email || 'admin@gmail.com',
      action: 'PAYMENT_REFUNDED',
      entity: 'ORDER',
      entityId: order.id,
      newValue: { refundId: refundResult.refundId, amount: refundResult.amount },
      details: `Refund of ₹${refundResult.amount} processed for Order #${order.orderNumber} (${payment.id}).`
    });

    return {
      success: true,
      refundId: refundResult.refundId,
      payment,
      order
    };
  }

  /**
   * 7. SEND PAYMENT REQUEST TO GUEST (STAFF/ADMIN)
   */
  public static async sendPaymentRequestAdmin(
    orderId: string,
    messageNote?: string,
    adminUser?: SafeUser
  ) {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (order.paymentStatus === 'PAID') {
      throw new Error('Order is already paid.');
    }

    order.status = 'WAITING_FOR_PAYMENT';
    order.updatedAt = new Date().toISOString();
    await OrderRepository.update(order);

    NotificationRepository.create({
      type: 'PAYMENT_REQUEST',
      title: `Payment Request — Order #${order.orderNumber}`,
      message: messageNote || `Staff requested payment of ₹${order.total} for Order #${order.orderNumber}. Please provide payment details & pay now.`,
      entityId: order.id,
      entityType: 'order'
    });

    AuditRepository.record({
      adminId: adminUser?.id || 'admin',
      adminEmail: adminUser?.email || 'admin@gmail.com',
      action: 'PAYMENT_REQUEST_SENT',
      entity: 'ORDER',
      entityId: order.id,
      newValue: { orderId: order.id, amount: order.total },
      details: `Payment request of ₹${order.total} sent to ${order.customerName} (${order.customerEmail || order.customerPhone}).`
    });

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      message: `Payment request sent successfully to ${order.customerName}!`
    };
  }

  /**
   * 8. RECONCILE PAYMENT (ADMIN)
   * Resolves discrepancies where Payment is CAPTURED/SUCCESS but Order status is PLACED/WAITING
   */
  public static async reconcilePaymentAdmin(paymentId: string, adminUser?: SafeUser) {
    const payment = await PaymentRepository.getById(paymentId);
    if (!payment) {
      throw new Error('Payment record not found.');
    }

    const order = await OrderRepository.getById(payment.orderId);
    if (!order) {
      throw new Error('Associated order not found.');
    }

    if (payment.status === 'CAPTURED') {
      order.paymentStatus = 'PAID';
      if (order.status === 'PLACED' || order.status === 'WAITING_FOR_PAYMENT') {
        order.status = 'CONFIRMED';
      }
      order.updatedAt = new Date().toISOString();
      await OrderRepository.update(order);

      AuditRepository.record({
        adminId: adminUser?.id || 'admin',
        adminEmail: adminUser?.email || 'admin@gmail.com',
        action: 'PAYMENT_RECONCILED',
        entity: 'ORDER',
        entityId: order.id,
        newValue: { paymentId: payment.id, orderStatus: order.status, paymentStatus: order.paymentStatus },
        details: `Reconciled captured payment ${payment.id} for Order #${order.orderNumber}. Order marked as CONFIRMED & PAID.`
      });

      return {
        success: true,
        order,
        payment,
        message: `Order #${order.orderNumber} successfully reconciled and confirmed.`
      };
    }

    return {
      success: true,
      order,
      payment,
      message: `Payment status is ${payment.status}. Order remains in current state.`
    };
  }
}
