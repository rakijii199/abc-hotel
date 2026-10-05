/**
 * Food Ordering Service
 * Server-Side Price Verification, Snapshotting, and Real-time Staff Alerts
 */
import crypto from 'crypto';
import { config } from '../config/index.ts';
import { db } from '../database/db.ts';
import { getFirestoreDb } from '../database/firestoreSync.ts';
import { MenuRepository } from '../repositories/menuRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { RestaurantRepository } from '../repositories/tableRepository.ts';
import { NotificationRepository } from '../repositories/notificationRepository.ts';
import { InventoryService } from './inventoryService.ts';
import {
  Order,
  OrderIdempotencyRecord,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus
} from '../types/index.ts';

export class OrderService {
  /**
   * Deterministically compute SHA-256 fingerprint for material order request
   */
  public static computeFingerprint(params: {
    userId: string;
    orderType: string;
    tableNumber?: string;
    bookingReference?: string;
    roomNumber?: string;
    deliveryAddress?: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    paymentMethod: string;
    discountCode?: string;
    notes?: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      specialInstructions?: string;
    }>;
  }): string {
    const sortedItems = [...(params.items || [])]
      .map((i) => ({
        menuItemId: String(i.menuItemId || '').trim(),
        quantity: Number(i.quantity || 0),
        specialInstructions: String(i.specialInstructions || '').trim()
      }))
      .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));

    const canonical = {
      userId: String(params.userId || '').trim(),
      orderType: String(params.orderType || '').trim(),
      tableNumber: String(params.tableNumber || '').trim(),
      bookingReference: String(params.bookingReference || '').trim(),
      roomNumber: String(params.roomNumber || '').trim(),
      deliveryAddress: String(params.deliveryAddress || '').trim(),
      customerName: String(params.customerName || '').trim().toLowerCase(),
      customerPhone: String(params.customerPhone || '').replace(/[^\d+]/g, ''),
      customerEmail: String(params.customerEmail || '').trim().toLowerCase(),
      paymentMethod: String(params.paymentMethod || '').trim(),
      discountCode: String(params.discountCode || '').trim().toUpperCase(),
      notes: String(params.notes || '').trim(),
      items: sortedItems
    };

    return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  /**
   * Place a new food order with Server-Side Price Verification and Distributed Idempotency
   */
  public static async createOrder(params: {
    userId: string;
    orderType: OrderType;
    tableNumber?: string;
    bookingReference?: string;
    roomNumber?: string;
    deliveryAddress?: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    paymentMethod: PaymentMethod;
    discountCode?: string;
    notes?: string;
    idempotencyKey?: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      specialInstructions?: string;
    }>;
  }): Promise<Order> {
    if (!params.items || params.items.length === 0) {
      throw new Error('Order must contain at least one item.');
    }

    const cleanKey = (params.idempotencyKey || '').trim();
    const requestHash = this.computeFingerprint(params);
    const scopedKey = cleanKey
      ? `${params.userId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${cleanKey}`
      : '';

    const fsDb = getFirestoreDb();

    // 1. Check existing in-memory / cache idempotency record
    if (scopedKey) {
      const existingRecord = await OrderRepository.getIdempotencyRecord(scopedKey);
      if (existingRecord) {
        if (existingRecord.requestHash !== requestHash) {
          const err: any = new Error('409 Conflict: Idempotency key reused with different request payload.');
          err.code = 'IDEMPOTENCY_CONFLICT';
          err.status = 409;
          throw err;
        }
        if (existingRecord.responseOrder) {
          return existingRecord.responseOrder;
        }
        const existingOrder = await OrderRepository.getById(existingRecord.orderId);
        if (existingOrder) {
          return existingOrder;
        }
      }
    }

    // 2. Authoritative Firestore Transaction Path (for Cloud Run & production mode)
    if (fsDb) {
      let isNewlyCreated = false;
      const order = await fsDb.runTransaction(async (transaction) => {
        if (scopedKey) {
          const idempRef = fsDb.collection('orderIdempotency').doc(scopedKey);
          const idempDoc = await transaction.get(idempRef);
          if (idempDoc.exists) {
            const existing = idempDoc.data() as OrderIdempotencyRecord;
            if (existing.requestHash !== requestHash) {
              const err: any = new Error('409 Conflict: Idempotency key reused with different request payload.');
              err.code = 'IDEMPOTENCY_CONFLICT';
              err.status = 409;
              throw err;
            }
            if (existing.status === 'COMPLETED' || existing.responseOrder) {
              if (existing.responseOrder) {
                return existing.responseOrder;
              }
              const orderDoc = await transaction.get(fsDb.collection('orders').doc(existing.orderId));
              if (orderDoc.exists) {
                return orderDoc.data() as Order;
              }
              if (existing.responseOrder) return existing.responseOrder;
            }
          }
        }

        // Generate cryptographically unique Order ID
        const orderId = `ord_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`}`;
        const seqStr = String(Date.now()).slice(-6);
        const orderNumber = `ABC ${seqStr}`;

        // Validate item prices strictly from DB
        const validatedOrderItems: OrderItem[] = [];
        let subtotal = 0;

        for (const rawItem of params.items) {
          const dbItem = await MenuRepository.getItemById(rawItem.menuItemId);
          if (!dbItem) {
            throw new Error(`Item ${rawItem.menuItemId} is not available on the menu.`);
          }
          if (!dbItem.available) {
            throw new Error(`"${dbItem.name}" is currently unavailable.`);
          }
          if (rawItem.quantity <= 0) {
            throw new Error(`Quantity for "${dbItem.name}" must be greater than zero.`);
          }

          const itemTotal = dbItem.price * rawItem.quantity;
          subtotal += itemTotal;

          validatedOrderItems.push({
            id: `ord-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId,
            menuItemId: dbItem.id,
            name: dbItem.name,
            imageUrl: dbItem.imageUrl,
            quantity: rawItem.quantity,
            unitPrice: dbItem.price,
            totalPrice: itemTotal,
            specialInstructions: rawItem.specialInstructions?.trim()
          });
        }

        let discount = 0;
        const appliedDiscountCode = params.discountCode?.trim().toUpperCase();
        if (appliedDiscountCode === config.hotel.discountCode) {
          discount = Math.round(subtotal * config.hotel.discountPercent);
        }

        const taxableAmount = Math.max(0, subtotal - discount);
        const tax = Math.round(taxableAmount * config.hotel.taxRate);
        const serviceCharge = params.orderType === 'Takeaway' ? 0 : config.hotel.serviceCharge;
        const total = taxableAmount + tax + serviceCharge;
        const restaurant = RestaurantRepository.getRestaurant();
        const now = new Date().toISOString();

        const newOrder: Order = {
          id: orderId,
          orderNumber,
          userId: params.userId,
          restaurantId: restaurant?.id || 'rst-abc-001',
          orderType: params.orderType,
          tableNumber: params.tableNumber?.trim(),
          bookingReference: params.bookingReference?.trim(),
          roomNumber: params.roomNumber?.trim(),
          deliveryAddress: params.deliveryAddress?.trim(),
          customerName: params.customerName.trim(),
          customerPhone: params.customerPhone.trim(),
          customerEmail: params.customerEmail.trim(),
          subtotal,
          tax,
          discount,
          discountCode: appliedDiscountCode || undefined,
          serviceCharge,
          total,
          status: 'PLACED',
          paymentStatus: 'PENDING',
          paymentMethod: params.paymentMethod,
          notes: params.notes?.trim(),
          items: validatedOrderItems,
          createdAt: now,
          updatedAt: now
        };

        const orderRef = fsDb.collection('orders').doc(orderId);
        transaction.set(orderRef, newOrder);

        if (scopedKey) {
          const idempRef = fsDb.collection('orderIdempotency').doc(scopedKey);
          const idempRecord: OrderIdempotencyRecord = {
            id: scopedKey,
            idempotencyKey: cleanKey,
            userId: params.userId,
            orderId: newOrder.id,
            orderNumber: newOrder.orderNumber,
            requestHash,
            status: 'COMPLETED',
            responseOrder: newOrder,
            createdAt: now,
            updatedAt: now
          };
          transaction.set(idempRef, idempRecord);
        }

        isNewlyCreated = true;
        return newOrder;
      });

      if (isNewlyCreated) {
        db.orders.set(order.id, order);
        db.orderNumberIndex.set(order.orderNumber.toUpperCase(), order.id);
        if (scopedKey) {
          db.orderIdempotency.set(scopedKey, {
            id: scopedKey,
            idempotencyKey: cleanKey,
            userId: params.userId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            requestHash,
            status: 'COMPLETED',
            responseOrder: order,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
          });
        }
        await InventoryService.deductStockForOrder(order);
        await OrderRepository.recordPayment({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          orderId: order.id,
          provider: params.paymentMethod === 'Cash' ? 'offline' : 'razorpay',
          amount: order.total,
          currency: 'INR',
          paymentMethod: params.paymentMethod,
          transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'CREATED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        NotificationRepository.create({
          type: 'NEW_ORDER',
          title: `New Food Order #${order.orderNumber}`,
          message: `${order.customerName} placed order for ₹${order.total} (${order.orderType}).`,
          entityId: order.id,
          entityType: 'order'
        });
      }

      return order;
    }

    // 3. In-memory / local fallback for local development & unit test suite (wrapped with mutex)
    return await db.withLock(scopedKey ? `order_idemp_${scopedKey}` : `order_user_${params.userId}`, async () => {
      if (scopedKey) {
        const existingRecord = await OrderRepository.getIdempotencyRecord(scopedKey);
        if (existingRecord) {
          if (existingRecord.requestHash !== requestHash) {
            const err: any = new Error('409 Conflict: Idempotency key reused with different request payload.');
            err.code = 'IDEMPOTENCY_CONFLICT';
            err.status = 409;
            throw err;
          }
          if (existingRecord.responseOrder) {
            return existingRecord.responseOrder;
          }
          const existingOrder = await OrderRepository.getById(existingRecord.orderId);
          if (existingOrder) {
            return existingOrder;
          }
        }
      }

      const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const totalCount = db.orders.size + db.archivedOrders.size;
      const nextSeq = totalCount + 1;
      const seqStr = String(nextSeq).padStart(3, '0');
      const orderNumber = `ABC ${seqStr}`;

      // Calculate item prices strictly from DB
      const validatedOrderItems: OrderItem[] = [];
      let subtotal = 0;

      for (const rawItem of params.items) {
        const dbItem = await MenuRepository.getItemById(rawItem.menuItemId);
        if (!dbItem) {
          throw new Error(`Item ${rawItem.menuItemId} is not available on the menu.`);
        }

        if (!dbItem.available) {
          throw new Error(`"${dbItem.name}" is currently unavailable.`);
        }

        if (rawItem.quantity <= 0) {
          throw new Error(`Quantity for "${dbItem.name}" must be greater than zero.`);
        }

        // Snapshot unit price strictly from database
        const itemTotal = dbItem.price * rawItem.quantity;
        subtotal += itemTotal;

        validatedOrderItems.push({
          id: `ord-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          orderId,
          menuItemId: dbItem.id,
          name: dbItem.name,
          imageUrl: dbItem.imageUrl,
          quantity: rawItem.quantity,
          unitPrice: dbItem.price,
          totalPrice: itemTotal,
          specialInstructions: rawItem.specialInstructions?.trim()
        });
      }

      // Discounts
      let discount = 0;
      const appliedDiscountCode = params.discountCode?.trim().toUpperCase();
      if (appliedDiscountCode === config.hotel.discountCode) {
        discount = Math.round(subtotal * config.hotel.discountPercent);
      }

      // Calculate Tax & Service Charge
      const taxableAmount = Math.max(0, subtotal - discount);
      const tax = Math.round(taxableAmount * config.hotel.taxRate);
      const serviceCharge = params.orderType === 'Takeaway' ? 0 : config.hotel.serviceCharge;
      const total = taxableAmount + tax + serviceCharge;

      const restaurant = RestaurantRepository.getRestaurant();
      const paymentStatus: PaymentStatus = 'PENDING';

      const newOrder: Order = {
        id: orderId,
        orderNumber,
        userId: params.userId,
        restaurantId: restaurant?.id || 'rst-abc-001',
        orderType: params.orderType,
        tableNumber: params.tableNumber?.trim(),
        bookingReference: params.bookingReference?.trim(),
        roomNumber: params.roomNumber?.trim(),
        deliveryAddress: params.deliveryAddress?.trim(),
        customerName: params.customerName.trim(),
        customerPhone: params.customerPhone.trim(),
        customerEmail: params.customerEmail.trim(),
        subtotal,
        tax,
        discount,
        discountCode: appliedDiscountCode || undefined,
        serviceCharge,
        total,
        status: 'PLACED',
        paymentStatus,
        paymentMethod: params.paymentMethod,
        notes: params.notes?.trim(),
        items: validatedOrderItems,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await OrderRepository.create(newOrder);

      if (scopedKey) {
        await OrderRepository.saveIdempotencyRecord({
          id: scopedKey,
          idempotencyKey: cleanKey,
          userId: params.userId,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          requestHash,
          status: 'COMPLETED',
          responseOrder: newOrder,
          createdAt: newOrder.createdAt,
          updatedAt: newOrder.updatedAt
        });
      }

      // Auto-deduct inventory ingredient stock based on recipes (strictly verifies stock availability)
      await InventoryService.deductStockForOrder(newOrder);

      // Record payment transaction
      await OrderRepository.recordPayment({
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: newOrder.id,
        provider: params.paymentMethod === 'Cash' ? 'offline' : 'razorpay',
        amount: total,
        currency: 'INR',
        paymentMethod: params.paymentMethod,
        transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'CREATED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Send real-time notification to staff
      NotificationRepository.create({
        type: 'NEW_ORDER',
        title: `New Food Order #${orderNumber}`,
        message: `${newOrder.customerName} placed order for ₹${total} (${newOrder.orderType}).`,
        entityId: newOrder.id,
        entityType: 'order'
      });

      return newOrder;
    });
  }

  /**
   * Update Order Status following the state machine
   */
  public static async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId?: string,
    isAdmin = false
  ): Promise<Order> {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (!isAdmin && userId && order.userId !== userId) {
      throw new Error('Unauthorized access to update this order.');
    }

    // Customers can only cancel an order if it is still in PLACED status
    if (!isAdmin && newStatus === 'CANCELLED') {
      if (order.status !== 'PLACED') {
        throw new Error('Cannot cancel an order that is already being prepared or confirmed.');
      }
    }

    const updated = await OrderRepository.updateStatus(orderId, newStatus);
    if (!updated) {
      throw new Error('Failed to update order status.');
    }

    if (newStatus === 'CANCELLED') {
      try {
        await InventoryService.restoreStockForOrder(order.id);
      } catch (restErr) {
        console.warn('[INVENTORY] Stock restoration notice:', restErr);
      }

      NotificationRepository.create({
        type: 'ORDER_CANCELLED',
        title: `Order Cancelled #${order.orderNumber}`,
        message: `Order #${order.orderNumber} by ${order.customerName} was cancelled.`,
        entityId: order.id,
        entityType: 'order'
      });
    }

    return updated;
  }

  /**
   * Get User Orders
   */
  public static async getUserOrders(userId: string): Promise<Order[]> {
    return await OrderRepository.getByUserId(userId);
  }

  /**
   * Get single Order
   */
  public static async getOrder(identifier: string, userId?: string, isAdmin = false): Promise<Order> {
    const order = identifier.startsWith('ABC-')
      ? await OrderRepository.getByOrderNumber(identifier)
      : await OrderRepository.getById(identifier);

    if (!order) {
      throw new Error('Order not found.');
    }

    if (!isAdmin && order.userId) {
      if (!userId || order.userId !== userId) {
        throw new Error('Unauthorized access to order details.');
      }
    }

    return order;
  }

  /**
   * Add new items (Add-on order) to an existing open Order
   * Recalculates total, deducts inventory for new items, notifies kitchen, and updates invoices.
   */
  public static async addItemsToOrder(
    orderId: string,
    items: Array<{
      menuItemId: string;
      quantity: number;
      specialInstructions?: string;
    }>,
    userId?: string,
    isAdmin = false
  ): Promise<Order> {
    const order = await OrderRepository.getById(orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    if (!isAdmin && order.userId) {
      if (!userId || order.userId !== userId) {
        throw new Error('Unauthorized access: You do not own this order.');
      }
    }

    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new Error('Cannot add items to a cancelled or completed order.');
    }

    if (!items || items.length === 0) {
      throw new Error('Please select at least one item to add.');
    }

    const validatedNewItems: OrderItem[] = [];
    const now = new Date().toISOString();

    for (const rawItem of items) {
      const dbItem = await MenuRepository.getItemById(rawItem.menuItemId);
      if (!dbItem) {
        throw new Error(`Item ${rawItem.menuItemId} is not available on the menu.`);
      }

      if (!dbItem.available) {
        throw new Error(`"${dbItem.name}" is currently unavailable.`);
      }

      if (rawItem.quantity <= 0) {
        throw new Error(`Quantity for "${dbItem.name}" must be greater than zero.`);
      }

      const itemTotal = dbItem.price * rawItem.quantity;

      validatedNewItems.push({
        id: `ord-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        menuItemId: dbItem.id,
        name: dbItem.name,
        imageUrl: dbItem.imageUrl,
        quantity: rawItem.quantity,
        unitPrice: dbItem.price,
        totalPrice: itemTotal,
        specialInstructions: rawItem.specialInstructions?.trim(),
        isAddon: true,
        addedAt: now
      });
    }

    // Append newly validated items to order
    order.items = [...order.items, ...validatedNewItems];

    // Recalculate full order subtotal strictly from DB items
    let trustedSubtotal = 0;
    for (const it of order.items) {
      const dbItem = await MenuRepository.getItemById(it.menuItemId);
      const unitP = dbItem ? dbItem.price : it.unitPrice;
      it.unitPrice = unitP;
      it.totalPrice = unitP * it.quantity;
      trustedSubtotal += it.totalPrice;
    }

    order.subtotal = trustedSubtotal;

    // Recalculate discount
    let discount = 0;
    if (order.discountCode && order.discountCode.toUpperCase() === config.hotel.discountCode) {
      discount = Math.round(trustedSubtotal * config.hotel.discountPercent);
    }
    order.discount = discount;

    // Recalculate tax & service charge
    const taxableAmount = Math.max(0, trustedSubtotal - discount);
    const tax = Math.round(taxableAmount * config.hotel.taxRate);
    const serviceCharge = order.orderType === 'Takeaway' ? 0 : config.hotel.serviceCharge;
    const total = taxableAmount + tax + serviceCharge;

    order.tax = tax;
    order.serviceCharge = serviceCharge;
    order.total = total;
    order.updatedAt = now;

    // If order was in PLACED or CONFIRMED, ensure operational status allows active preparation
    if (order.status === 'READY' || order.status === 'SERVED') {
      order.status = 'PREPARING'; // New items need kitchen preparation
    }

    // Update Order in Repository
    await OrderRepository.update(order);

    // Auto-deduct inventory stock only for the newly added items
    try {
      InventoryService.deductStockForOrderItems(validatedNewItems, order.id, order.orderNumber);
    } catch (invErr) {
      console.error('[INVENTORY] Add-on stock deduction error:', invErr);
    }

    // Update real-time staff notification
    NotificationRepository.create({
      type: 'NEW_ORDER',
      title: `Add-on items for Order #${order.orderNumber}`,
      message: `${order.customerName} added ${validatedNewItems.length} more item(s) (${validatedNewItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}). Total now: ₹${total}.`,
      entityId: order.id,
      entityType: 'order'
    });

    return order;
  }
}

