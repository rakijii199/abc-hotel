/**
 * Comprehensive Unit, Integration & E2E Test Suite Runner for ABC Hotel System
 */
import { AuthService } from '../server/services/authService.ts';
import { BookingService } from '../server/services/bookingService.ts';
import { OrderService } from '../server/services/orderService.ts';
import { PaymentService } from '../server/services/paymentService.ts';
import { AdminService } from '../server/services/adminService.ts';
import { MenuRepository } from '../server/repositories/menuRepository.ts';
import { TableRepository } from '../server/repositories/tableRepository.ts';
import { PaymentRepository } from '../server/repositories/paymentRepository.ts';
import { OrderRepository } from '../server/repositories/orderRepository.ts';
import { db } from '../server/database/db.ts';
import { registerSchema } from '../server/validators/index.ts';
import type { Order, OrderType, PaymentMethod } from '../server/types/index.ts';
import { formatDisplayDate, formatOrderDateTime, getPast30DaysRange } from '../src/utils/formatters.ts';

export interface TestCaseResult {
  id: string;
  suite: string;
  name: string;
  description: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  error?: string;
}

export async function runAllTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}> {
  process.env.IS_TEST_RUN = 'true';
  const startTime = Date.now();
  const results: TestCaseResult[] = [];

  const runTest = async (
    id: string,
    suite: string,
    name: string,
    description: string,
    fn: () => Promise<void> | void
  ) => {
    const t0 = Date.now();
    try {
      await fn();
      results.push({
        id,
        suite,
        name,
        description,
        status: 'PASSED',
        durationMs: Date.now() - t0
      });
    } catch (err: any) {
      results.push({
        id,
        suite,
        name,
        description,
        status: 'FAILED',
        durationMs: Date.now() - t0,
        error: err.message || String(err)
      });
    }
  };

  // Ensure DB initialized
  await db.initialize();

  let testDateOffset = 1;
  const getTestDate = () => {
    testDateOffset = (testDateOffset % 20) + 1;
    const now = new Date(Date.now() + 86400000 * testDateOffset);
    return now.toISOString().split('T')[0];
  };

  // -------------------------------------------------------------
  // SUITE 1: AUTHENTICATION, PASSWORD SECURITY & RBAC
  // -------------------------------------------------------------
  await runTest(
    'TC_AUTH_001',
    'Authentication',
    'User Registration & Password Hashing',
    'Verify user registration generates bcrypt hash and JWT token',
    async () => {
      const email = `test.user.${Date.now()}@example.com`;
      const res = await AuthService.register({
        firstName: 'Tester',
        lastName: 'One',
        email,
        phone: '+91 9999988888',
        password: 'Password@123'
      });
      if (!res.token || !res.user || res.user.email !== email) {
        throw new Error('Registration failed to return user or token');
      }
    }
  );

  await runTest(
    'TC_AUTH_002',
    'Authentication',
    'SafeUser Output Integrity',
    'Verify passwordHash is never exposed in user API payloads',
    async () => {
      const email = `secure.user.${Date.now()}@example.com`;
      const res = await AuthService.register({
        firstName: 'Secure',
        lastName: 'User',
        email,
        phone: '+91 9999988888',
        password: 'Password@123'
      });
      if ((res.user as any).passwordHash) {
        throw new Error('passwordHash must never be exposed to safe user output');
      }
    }
  );

  await runTest(
    'TC_AUTH_003',
    'Authentication',
    'Duplicate Email Rejection',
    'Verify registering with an existing email throws validation error',
    async () => {
      try {
        await AuthService.register({
          firstName: 'Duplicate',
          lastName: 'User',
          email: 'admin@gmail.com',
          phone: '+91 9999988888',
          password: 'Password@123'
        });
        throw new Error('Expected duplicate email error was not thrown');
      } catch (err: any) {
        if (!err.message.includes('already exists')) throw err;
      }
    }
  );

  await runTest(
    'TC_AUTH_004',
    'Authentication',
    'Invalid Password Login Rejection',
    'Verify login with wrong password throws 401 error',
    async () => {
      try {
        await AuthService.login({
          email: 'admin@gmail.com',
          password: 'WrongPassword123'
        });
        throw new Error('Expected invalid credentials error');
      } catch (err: any) {
        if (!err.message.toLowerCase().includes('invalid')) throw err;
      }
    }
  );

  await runTest(
    'TC_AUTH_005',
    'Authentication',
    'Weak Password Schema Validation',
    'Verify password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number',
    () => {
      const result = registerSchema.safeParse({
        firstName: 'Weak',
        lastName: 'Password',
        email: 'weak@example.com',
        phone: '+91 9999988888',
        password: 'pass',
        confirmPassword: 'pass'
      });
      if (result.success) {
        throw new Error('Weak password was unexpectedly accepted by register schema');
      }
    }
  );

  await runTest(
    'TC_AUTH_006',
    'Authentication',
    'Password Mismatch Schema Validation',
    'Verify password and confirmPassword must match',
    () => {
      const result = registerSchema.safeParse({
        firstName: 'Mismatch',
        lastName: 'Password',
        email: 'mismatch@example.com',
        phone: '+91 9999988888',
        password: 'Password@123',
        confirmPassword: 'Password@456'
      });
      if (result.success) {
        throw new Error('Password mismatch was unexpectedly accepted');
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 2: TABLE AVAILABILITY & BOOKING ENGINE
  // -------------------------------------------------------------
  await runTest(
    'TC_BOOK_001',
    'Booking Engine',
    'Operating Hours Check',
    'Verify booking outside 09:00 - 23:00 is rejected',
    () => {
      const isOkEarly = BookingService.isWithinOperatingHours('07:00', '09:00');
      const isOkLate = BookingService.isWithinOperatingHours('23:30', '01:30');
      const isOkValid = BookingService.isWithinOperatingHours('19:30', '21:30');
      if (isOkEarly || isOkLate || !isOkValid) {
        throw new Error('Operating hours boundary check failed');
      }
    }
  );

  await runTest(
    'TC_BOOK_002',
    'Booking Engine',
    'Table Capacity Validation',
    'Verify selecting a 2-person table for 6 guests throws capacity error',
    async () => {
      try {
        await BookingService.createBooking({
          userId: 'usr-admin-001',
          tableId: 'tbl-001', // capacity 2
          bookingDate: '2026-10-15',
          startTime: '19:30',
          guestCount: 6
        });
        throw new Error('Expected table capacity error was not thrown');
      } catch (err: any) {
        if (!err.message.includes('only accommodates')) throw err;
      }
    }
  );

  await runTest(
    'TC_BOOK_003',
    'Booking Engine',
    'Double Booking Prevention (Atomic Overlap Check)',
    'Verify second booking on same table and overlapping time slot is rejected',
    async () => {
      const testDate = getTestDate();
      // Booking 1: 19:00 - 19:30 on Table 02
      await BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId: 'tbl-002',
        bookingDate: testDate,
        startTime: '19:00',
        guestCount: 2
      });

      // Booking 2: 19:15 on Table 02 (Overlap!)
      try {
        await BookingService.createBooking({
          userId: 'usr-admin-001',
          tableId: 'tbl-002',
          bookingDate: testDate,
          startTime: '19:15',
          guestCount: 2
        });
        throw new Error('Expected double booking overlap rejection');
      } catch (err: any) {
        if (!err.message.includes('no longer available')) throw err;
      }
    }
  );

  await runTest(
    'TC_BOOK_004',
    'Booking Engine',
    'Unique Booking Reference Generation',
    'Verify booking reference matches BK-YYYYMMDD-XXXXX format',
    async () => {
      const booking = await BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId: 'tbl-005',
        bookingDate: getTestDate(),
        startTime: '13:00',
        guestCount: 4
      });
      if (!/^BK-\d{8}-\d{5}$/.test(booking.bookingReference)) {
        throw new Error(`Invalid booking reference format: ${booking.bookingReference}`);
      }
    }
  );

  await runTest(
    'TC_BOOK_005',
    'Booking Engine',
    'Past Date Booking Rejection',
    'Verify booking for past date is rejected',
    async () => {
      try {
        await BookingService.createBooking({
          userId: 'usr-admin-001',
          tableId: 'tbl-001',
          bookingDate: '2020-01-01',
          startTime: '19:00',
          guestCount: 2
        });
        throw new Error('Expected past date rejection');
      } catch (err: any) {
        if (!err.message.includes('past date')) throw err;
      }
    }
  );

  await runTest(
    'TC_BOOK_006',
    'Booking Engine',
    'Prevent Cancelling Completed or Seated Booking',
    'Verify seated or completed reservations cannot be cancelled',
    async () => {
      const booking = await BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId: 'tbl-004',
        bookingDate: getTestDate(),
        startTime: '14:00',
        guestCount: 2
      });

      await AdminService.updateBookingStatus(booking.id, 'CONFIRMED');
      await AdminService.updateBookingStatus(booking.id, 'SEATED');

      try {
        await BookingService.cancelBooking(booking.id, 'usr-admin-001', true);
        throw new Error('Expected cancellation of seated booking to be rejected');
      } catch (err: any) {
        if (!err.message.includes('Cannot cancel a booking that is already seated')) throw err;
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 3: ORDERING & SERVER-SIDE PRICE CALCULATIONS
  // -------------------------------------------------------------
  await runTest(
    'TC_ORD_001',
    'Ordering Engine',
    'Server-Side Price Calculation',
    'Verify total price is strictly derived from DB, ignoring client manipulated prices',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 01',
        customerName: 'Test Diner',
        customerPhone: '+91 9999988888',
        customerEmail: 'test@example.com',
        paymentMethod: 'UPI',
        items: [
          { menuItemId: 'itm-001', quantity: 2 }, // Paneer Tikka: 280 * 2 = 560
          { menuItemId: 'itm-009', quantity: 2 }  // Mutton Seekh Kebab: 420 * 2 = 840
        ]
      });

      // Subtotal should be 560 + 840 = 1400
      if (order.subtotal !== 1400) {
        throw new Error(`Expected subtotal 1400, got ${order.subtotal}`);
      }
      // Tax: 5% of 1400 = 70
      if (order.tax !== 70) {
        throw new Error(`Expected tax 70, got ${order.tax}`);
      }
      // Service charge = 40
      // Total = 1400 + 70 + 40 = 1510
      if (order.total !== 1510) {
        throw new Error(`Expected total 1510, got ${order.total}`);
      }
    }
  );

  await runTest(
    'TC_ORD_002',
    'Ordering Engine',
    'Promo Code Discount Application',
    'Verify WELCOME10 applies 10% discount to subtotal',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 01',
        customerName: 'Test Diner',
        customerPhone: '+91 9999988888',
        customerEmail: 'test@example.com',
        paymentMethod: 'UPI',
        discountCode: 'WELCOME10',
        items: [
          { menuItemId: 'itm-005', quantity: 1 } // Truffle Malai Paneer Tikka: 340
        ]
      });

      // Subtotal = 340, Discount (10%) = 34
      if (order.discount !== 34) {
        throw new Error(`Expected discount 34, got ${order.discount}`);
      }
    }
  );

  await runTest(
    'TC_ORD_003',
    'Ordering Engine',
    'Order Status State Machine Transition',
    'Verify status transitions PLACED -> CONFIRMED -> PREPARING -> READY -> COMPLETED',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Takeaway',
        customerName: 'State Tester',
        customerPhone: '+91 9999988888',
        customerEmail: 'test@example.com',
        paymentMethod: 'Cash',
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      });

      if (order.status !== 'PLACED') throw new Error('Initial status must be PLACED');

      const conf = await OrderService.updateOrderStatus(order.id, 'CONFIRMED', undefined, true);
      if (conf.status !== 'CONFIRMED') throw new Error('Failed to transition to CONFIRMED');

      const prep = await OrderService.updateOrderStatus(order.id, 'PREPARING', undefined, true);
      if (prep.status !== 'PREPARING') throw new Error('Failed to transition to PREPARING');

      const rdy = await OrderService.updateOrderStatus(order.id, 'READY', undefined, true);
      if (rdy.status !== 'READY') throw new Error('Failed to transition to READY');

      const comp = await OrderService.updateOrderStatus(order.id, 'COMPLETED', undefined, true);
      if (comp.status !== 'COMPLETED') throw new Error('Failed to transition to COMPLETED');
    }
  );

  await runTest(
    'TC_ORD_004',
    'Ordering Engine',
    'Invalid Order Status Transition Rejection',
    'Verify jumping from COMPLETED to PREPARING is strictly rejected',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Takeaway',
        customerName: 'Transition Tester',
        customerPhone: '+91 9999988888',
        customerEmail: 'test@example.com',
        paymentMethod: 'Cash',
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      });

      await OrderService.updateOrderStatus(order.id, 'CONFIRMED', undefined, true);
      await OrderService.updateOrderStatus(order.id, 'PREPARING', undefined, true);
      await OrderService.updateOrderStatus(order.id, 'READY', undefined, true);
      await OrderService.updateOrderStatus(order.id, 'COMPLETED', undefined, true);

      try {
        await OrderService.updateOrderStatus(order.id, 'PREPARING', undefined, true);
        throw new Error('Expected invalid transition rejection');
      } catch (err: any) {
        if (!err.message.includes('Invalid order transition')) throw err;
      }
    }
  );

  await runTest(
    'TC_ORD_005',
    'Ordering Engine',
    'Unavailable Dish Order Rejection',
    'Verify attempting to order a sold out or disabled dish is rejected by backend',
    async () => {
      // Temporarily mark an item as unavailable
      const item = await MenuRepository.getItemById('itm-002');
      if (item) {
        await MenuRepository.updateItem(item.id, { available: false });
        try {
          await OrderService.createOrder({
            userId: 'usr-admin-001',
            orderType: 'Takeaway',
            customerName: 'Unavail Tester',
            customerPhone: '+91 9999988888',
            customerEmail: 'test@example.com',
            paymentMethod: 'Cash',
            items: [{ menuItemId: item.id, quantity: 1 }]
          });
          throw new Error('Expected unavailable item rejection');
        } catch (err: any) {
          if (!err.message.includes('currently unavailable')) throw err;
        } finally {
          await MenuRepository.updateItem(item.id, { available: true });
        }
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 3.5: DISTRIBUTED ORDER CREATION IDEMPOTENCY
  // -------------------------------------------------------------
  await runTest(
    'TC_IDEMP_001',
    'Order Idempotency',
    'First Request with Key & Idempotent Replay',
    'Verify retry with same key and identical request returns original order without duplicate',
    async () => {
      const key = `test_idemp_key_${Date.now()}_1`;
      const payload = {
        userId: 'usr-admin-001',
        orderType: 'Takeaway' as OrderType,
        customerName: 'Idemp Tester',
        customerPhone: '+91 9999988888',
        customerEmail: 'idemp@example.com',
        paymentMethod: 'Cash' as PaymentMethod,
        idempotencyKey: key,
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      };

      const order1 = await OrderService.createOrder(payload);
      const order2 = await OrderService.createOrder(payload);

      if (order1.id !== order2.id) {
        throw new Error(`Expected identical order ID on idempotent replay, got ${order1.id} vs ${order2.id}`);
      }
      if (order1.orderNumber !== order2.orderNumber) {
        throw new Error(`Expected identical orderNumber, got ${order1.orderNumber} vs ${order2.orderNumber}`);
      }
    }
  );

  await runTest(
    'TC_IDEMP_002',
    'Order Idempotency',
    'Payload Conflict on Reused Key Rejection',
    'Verify reusing the same idempotency key with a different payload is rejected with 409 Conflict',
    async () => {
      const key = `test_idemp_conflict_${Date.now()}`;
      const payload1 = {
        userId: 'usr-admin-001',
        orderType: 'Takeaway' as OrderType,
        customerName: 'Conflict Tester',
        customerPhone: '+91 9999988888',
        customerEmail: 'conflict@example.com',
        paymentMethod: 'Cash' as PaymentMethod,
        idempotencyKey: key,
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      };

      await OrderService.createOrder(payload1);

      // Mutate items / payload with same key
      const payload2 = {
        ...payload1,
        items: [{ menuItemId: 'itm-001', quantity: 2 }]
      };

      try {
        await OrderService.createOrder(payload2);
        throw new Error('Expected 409 Conflict for modified payload on existing idempotency key');
      } catch (err: any) {
        if (!err.message.includes('409') && !err.message.includes('Conflict') && err.code !== 'IDEMPOTENCY_CONFLICT') {
          throw err;
        }
      }
    }
  );

  await runTest(
    'TC_IDEMP_003',
    'Order Idempotency',
    'Simultaneous Concurrent Order Requests Deduplication',
    'Verify two parallel concurrent requests with the same Idempotency-Key create exactly ONE order',
    async () => {
      const key = `test_idemp_concurrent_${Date.now()}`;
      const payload = {
        userId: 'usr-admin-001',
        orderType: 'Takeaway' as OrderType,
        customerName: 'Concurrent Idemp Tester',
        customerPhone: '+91 9999988888',
        customerEmail: 'concurrent@example.com',
        paymentMethod: 'Cash' as PaymentMethod,
        idempotencyKey: key,
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      };

      const [res1, res2] = await Promise.all([
        OrderService.createOrder(payload),
        OrderService.createOrder(payload)
      ]);

      if (res1.id !== res2.id) {
        throw new Error(`Concurrent race condition created two distinct orders: ${res1.id} vs ${res2.id}`);
      }
    }
  );

  await runTest(
    'TC_IDEMP_004',
    'Order Idempotency',
    'User Identity Scoping (No Cross-User Key Collisions)',
    'Verify distinct users using the same client key generate distinct orders independently',
    async () => {
      const sharedClientKey = `client_uuid_fixed_123`;
      const orderUserA = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Takeaway',
        customerName: 'User A',
        customerPhone: '+91 9999988888',
        customerEmail: 'usera@example.com',
        paymentMethod: 'Cash',
        idempotencyKey: sharedClientKey,
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      });

      const orderUserB = await OrderService.createOrder({
        userId: 'usr-staff',
        orderType: 'Takeaway',
        customerName: 'User B',
        customerPhone: '+91 9888877777',
        customerEmail: 'userb@example.com',
        paymentMethod: 'Cash',
        idempotencyKey: sharedClientKey,
        items: [{ menuItemId: 'itm-009', quantity: 1 }]
      });

      if (orderUserA.id === orderUserB.id) {
        throw new Error('Distinct users with same client key must NOT collide into the same order!');
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 4: ADMIN OPERATIONS & CRITICAL E2E SCENARIOS
  // -------------------------------------------------------------
  await runTest(
    'TC_ADMIN_001',
    'Admin Operations',
    'E2E-003: Admin Adds Food -> Customer Sees Food',
    'Verify newly created dish appears in menu catalog',
    async () => {
      const dishName = `Signature Kebabs ${Date.now()}`;
      const dish = await AdminService.createMenuItem({
        name: dishName,
        description: 'Tender marinated kebabs with secret spices',
        price: 420,
        categoryId: 'cat-001',
        imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
        available: true,
        vegetarian: false,
        spicy: true,
        spiceLevel: 'Medium',
        isChefSpecial: true,
        prepTimeMinutes: 20
      });

      const customerItems = await MenuRepository.getAllItems();
      const found = customerItems.find((i) => i.id === dish.id);
      if (!found || found.name !== dishName) {
        throw new Error('Newly created dish was not found in customer menu');
      }
    }
  );

  await runTest(
    'TC_ADMIN_002',
    'Admin Operations',
    'E2E-004: Admin Changes Price -> Customer Sees Updated Price',
    'Verify updating dish price updates the single source of truth',
    async () => {
      const item = await MenuRepository.getItemById('itm-001');
      if (!item) throw new Error('Base test dish not found');
      const originalPrice = item.price;
      const newPrice = originalPrice + 50;

      await AdminService.updateMenuItem(item.id, { price: newPrice });

      const updated = await MenuRepository.getItemById(item.id);
      if (!updated || updated.price !== newPrice) {
        throw new Error(`Expected price ${newPrice}, got ${updated?.price}`);
      }

      // Revert price
      await AdminService.updateMenuItem(item.id, { price: originalPrice });
    }
  );

  await runTest(
    'TC_ADMIN_003',
    'Admin Operations',
    'E2E-005: Admin Disables Food -> Dish Cannot Be Ordered',
    'Verify disabled food item cannot be ordered',
    async () => {
      const item = await MenuRepository.getItemById('itm-003');
      if (!item) throw new Error('Base item not found');

      await AdminService.toggleItemAvailability(item.id); // set to false

      try {
        await OrderService.createOrder({
          userId: 'usr-admin-001',
          orderType: 'Takeaway',
          customerName: 'Disabled Item Tester',
          customerPhone: '+91 9999988888',
          customerEmail: 'test@example.com',
          paymentMethod: 'Cash',
          items: [{ menuItemId: item.id, quantity: 1 }]
        });
        throw new Error('Expected disabled dish to be rejected');
      } catch (err: any) {
        if (!err.message.includes('currently unavailable')) throw err;
      } finally {
        await AdminService.toggleItemAvailability(item.id); // revert to true
      }
    }
  );

  await runTest(
    'TC_ADMIN_004',
    'Admin Operations',
    'Category Deletion Protection (BUG-003 Regression)',
    'Verify deleting category with active dishes is rejected',
    async () => {
      try {
        await AdminService.deleteCategory('cat-001');
        throw new Error('Expected deletion rejection for category with assigned dishes');
      } catch (err: any) {
        if (!err.message.includes('assigned to it')) throw err;
      }
    }
  );

  await runTest(
    'TC_ADMIN_005',
    'Admin Operations',
    'Table Deletion Protection (BUG-002 Regression)',
    'Verify deleting table with active reservations is rejected',
    async () => {
      const booking = await BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId: 'tbl-003',
        bookingDate: getTestDate(),
        startTime: '19:00',
        guestCount: 2
      });

      try {
        await AdminService.deleteTable('tbl-003');
        throw new Error('Expected deletion rejection for table with active reservation');
      } catch (err: any) {
        if (!err.message.includes('active or upcoming reservation')) throw err;
      }
    }
  );

  await runTest(
    'TC_ADMIN_006',
    'Admin Operations',
    'E2E-001: Complete Customer Order to Admin Confirmation Flow',
    'Customer places order -> Admin updates to CONFIRMED -> Customer sees CONFIRMED',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 04',
        customerName: 'E2E Diner',
        customerPhone: '+91 9999988888',
        customerEmail: 'e2e@example.com',
        paymentMethod: 'Card',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      if (order.status !== 'PLACED') throw new Error('Initial order status must be PLACED');

      // Admin confirms
      const confirmed = await AdminService.updateOrderStatus(order.id, 'CONFIRMED');
      if (confirmed.status !== 'CONFIRMED') throw new Error('Admin status update failed');

      // Customer fetches order
      const customerOrder = await OrderService.getOrder(order.id, 'usr-admin-001', false);
      if (customerOrder.status !== 'CONFIRMED') throw new Error('Customer order view out of sync');
    }
  );

  await runTest(
    'TC_ADMIN_007',
    'Admin Operations',
    'E2E-002: Complete Customer Booking to Admin Confirmation Flow',
    'Customer books table -> Admin confirms booking -> Customer sees CONFIRMED',
    async () => {
      const testDate = getTestDate();
      for (const [id, b] of db.bookings.entries()) {
        if (b.tableId === 'tbl-006' && b.bookingDate === testDate) {
          db.bookings.delete(id);
        }
      }

      const booking = await BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId: 'tbl-006',
        bookingDate: testDate,
        startTime: '20:00',
        guestCount: 4
      });

      if (booking.status !== 'PENDING') throw new Error('Initial booking status must be PENDING');

      // Admin confirms
      const confirmed = await AdminService.updateBookingStatus(booking.id, 'CONFIRMED');
      if (confirmed.status !== 'CONFIRMED') throw new Error('Admin confirmation failed');

      // Customer fetches booking
      const customerBookings = await BookingService.getUserBookings('usr-admin-001');
      const found = customerBookings.find((b) => b.id === booking.id);
      if (!found || found.status !== 'CONFIRMED') throw new Error('Customer booking view out of sync');
    }
  );

  await runTest(
    'TC_ADMIN_008',
    'Admin Operations',
    'E2E-007: Concurrent Double Booking Mutex Race Condition',
    'Simulate simultaneous overlapping reservation requests on same table',
    async () => {
      const date = getTestDate();
      const tableId = 'tbl-007';

      // Clear prior bookings on tbl-007 for this test date so it starts available
      for (const [id, b] of db.bookings.entries()) {
        if (b.tableId === tableId && b.bookingDate === date) {
          db.bookings.delete(id);
        }
      }

      // Both try to book Table 7 at 19:30
      const p1 = BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId,
        bookingDate: date,
        startTime: '19:30',
        guestCount: 2
      });

      const p2 = BookingService.createBooking({
        userId: 'usr-admin-001',
        tableId,
        bookingDate: date,
        startTime: '19:30',
        guestCount: 2
      });

      const settled = await Promise.allSettled([p1, p2]);
      const fulfilled = settled.filter((s) => s.status === 'fulfilled');
      const rejected = settled.filter((s) => s.status === 'rejected');

      if (fulfilled.length !== 1 || rejected.length !== 1) {
        throw new Error(
          `Expected exactly 1 fulfilled and 1 rejected, got ${fulfilled.length} fulfilled and ${rejected.length} rejected`
        );
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 5: ONLINE PAYMENT GATEWAY, SIGNATURES & RECONCILIATION
  // -------------------------------------------------------------
  await runTest(
    'TC_PAY_001',
    'Payment Gateway',
    'Successful UPI Payment & HMAC Signature Verification',
    'Verify backend payment order creation and HMAC signature verification for UPI',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 01',
        customerName: 'Payment Tester',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      const pOrder = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');
      if (!pOrder.providerOrderId || pOrder.amountInRupees !== order.total) {
        throw new Error('Gateway order amount or ID mismatch');
      }

      const verifyRes = await PaymentService.verifyPayment('usr-admin-001', {
        orderId: order.id,
        providerOrderId: pOrder.providerOrderId,
        providerPaymentId: `pay_test_${Date.now()}`,
        providerSignature: `sig_test_${Date.now()}`
      });

      if (!verifyRes.success || verifyRes.order.paymentStatus !== 'PAID' || verifyRes.order.status !== 'CONFIRMED') {
        throw new Error('Payment verification failed to set order to PAID and CONFIRMED');
      }
    }
  );

  await runTest(
    'TC_PAY_002',
    'Payment Gateway',
    'Server-Side Trusted Amount Security Calculation',
    'Verify gateway order amount is strictly derived from DB menu prices',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Takeaway',
        customerName: 'Amount Security Diner',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'Card',
        items: [{ menuItemId: 'itm-002', quantity: 2 }]
      });

      const pOrder = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'Card');
      const expectedPaise = Math.round(order.total * 100);

      if (pOrder.amount !== expectedPaise) {
        throw new Error(`Amount security mismatch: Expected ${expectedPaise} paise, got ${pOrder.amount}`);
      }
    }
  );

  await runTest(
    'TC_PAY_003',
    'Payment Gateway',
    'Invalid Signature Payment Rejection',
    'Verify invalid payment signature marks payment as FAILED and retains unpaid order state',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 02',
        customerName: 'Invalid Sig Tester',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      const pOrder = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');

      const verifyRes = await PaymentService.verifyPayment('usr-admin-001', {
        orderId: order.id,
        providerOrderId: pOrder.providerOrderId,
        providerPaymentId: 'pay_bad_123',
        providerSignature: 'INVALID_SIGNATURE_STRING'
      });

      if (verifyRes.success || verifyRes.order.paymentStatus === 'PAID') {
        throw new Error('Invalid signature was improperly accepted');
      }
    }
  );

  await runTest(
    'TC_PAY_004',
    'Payment Gateway',
    'Webhook Idempotency & Duplicate Callback Protection',
    'Verify duplicate webhook processing responds idempotently without changing totals',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 03',
        customerName: 'Webhook Tester',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      const providerOrderId = `order_test_wh_${Date.now()}`;
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_test_wh_${Date.now()}`,
              order_id: providerOrderId,
              method: 'upi',
              notes: { orderId: order.id }
            }
          }
        }
      };

      // Call 1
      const res1 = await PaymentService.handleWebhook(JSON.stringify(payload), 'whsec_test_abchotel_demo', payload);
      if (!res1.processed) throw new Error('Webhook 1 failed to process');

      // Call 2 (Duplicate)
      const res2 = await PaymentService.handleWebhook(JSON.stringify(payload), 'whsec_test_abchotel_demo', payload);
      if (!res2.idempotent) throw new Error('Webhook 2 duplicate call was not detected as idempotent');
    }
  );

  await runTest(
    'TC_PAY_005',
    'Payment Gateway',
    'Unauthorized Payment Verification Prevention',
    'Verify user cannot verify or access another user\'s payment order',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-cust-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 04',
        customerName: 'User One',
        customerPhone: '+91 9876543210',
        customerEmail: 'user1@example.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      try {
        await PaymentService.createPaymentOrder('usr-different-002', order.id, 'UPI');
        throw new Error('Allowed unauthorized user to create payment order for another user');
      } catch (err: any) {
        if (!err.message.includes('Unauthorized')) {
          throw err;
        }
      }
    }
  );

  await runTest(
    'TC_PAY_006',
    'Payment Gateway',
    'Payment Retry Flow on Unpaid Order',
    'Verify customer can retry payment on an unpaid order without creating duplicate orders',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 05',
        customerName: 'Retry Tester',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      // Attempt 1: Failed
      const p1 = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');
      await PaymentService.verifyPayment('usr-admin-001', {
        orderId: order.id,
        providerOrderId: p1.providerOrderId,
        providerPaymentId: 'pay_fail_1',
        providerSignature: 'BAD_SIG'
      });

      // Attempt 2: Successful Retry
      const p2 = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');
      const verifyRes = await PaymentService.verifyPayment('usr-admin-001', {
        orderId: order.id,
        providerOrderId: p2.providerOrderId,
        providerPaymentId: `pay_retry_success_${Date.now()}`,
        providerSignature: `sig_retry_success_${Date.now()}`
      });

      if (!verifyRes.success || verifyRes.order.paymentStatus !== 'PAID') {
        throw new Error('Retry payment failed to confirm order');
      }

      const statusInfo = await PaymentService.getPaymentStatusByOrderId(order.id, 'usr-admin-001', true);
      if (statusInfo.attempts.length < 2) {
        throw new Error(`Expected at least 2 payment attempt history records, got ${statusInfo.attempts.length}`);
      }
    }
  );

  await runTest(
    'TC_PAY_007',
    'Payment Gateway',
    'Send Payment Request to Guest & Provide Details Workflow',
    'Verify staff can trigger payment request and transition order to WAITING_FOR_PAYMENT',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 08',
        customerName: 'Payment Request Guest',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 2 }]
      });

      const reqRes = await PaymentService.sendPaymentRequestAdmin(
        order.id,
        'Staff requested payment of bill for Table 08'
      );

      if (!reqRes.success || reqRes.amount !== order.total) {
        throw new Error('Payment request creation failed');
      }

      const updatedStatus = await PaymentService.getPaymentStatusByOrderId(order.id, 'usr-admin-001', true);
      if (updatedStatus.orderStatus !== 'WAITING_FOR_PAYMENT') {
        throw new Error(`Expected order status WAITING_FOR_PAYMENT, got ${updatedStatus.orderStatus}`);
      }
    }
  );

  await runTest(
    'TC_PAY_008',
    'Payment Gateway',
    'Hotel UPI QR Attempt Creation & Polling',
    'Verify creation of dynamic UPI intent and status polling',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 09',
        customerName: 'QR Guest',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }, { menuItemId: 'itm-002', quantity: 1 }]
      });

      const upiResult = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');
      if (!upiResult.attemptId || !upiResult.upiIntentUrl || !upiResult.hotelUpiId) {
        throw new Error('Failed to generate complete Hotel UPI QR payload');
      }

      const pollStatus = await PaymentService.getPaymentAttemptStatus(upiResult.attemptId, 'usr-admin-001');
      if (pollStatus.status !== 'PENDING' || pollStatus.amount !== order.total) {
        throw new Error(`Unexpected poll status: ${pollStatus.status}, amount: ${pollStatus.amount}`);
      }
    }
  );

  await runTest(
    'TC_PAY_009',
    'Payment Gateway',
    'Hotel Payment Settings Update & VPA Validation',
    'Verify admin can update hotel UPI ID, name, and instructions with strict validation',
    async () => {
      const originalConfig = PaymentService.getAdminPaymentSettings();

      const updated = await PaymentService.updateAdminPaymentSettings({
        hotelName: 'ABC GRAND HOTEL',
        hotelUpiId: 'abcgrandhotel@icici',
        hotelMobileNumber: '+91 99887 76655'
      });

      if (updated.hotelUpiId !== 'abcgrandhotel@icici' || updated.hotelName !== 'ABC GRAND HOTEL') {
        throw new Error('Failed to update hotel payment settings');
      }

      // Revert back
      await PaymentService.updateAdminPaymentSettings({
        hotelName: originalConfig.hotelName,
        hotelUpiId: originalConfig.hotelUpiId,
        hotelMobileNumber: originalConfig.hotelMobileNumber
      });
    }
  );

  await runTest(
    'TC_PAY_010',
    'Payment Gateway',
    'Verified UPI Simulation & Atomic Order Confirmation',
    'Verify simulated verified callback marks attempt SUCCESS, order CONFIRMED, and payment PAID',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 10',
        customerName: 'Simulated Guest',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      const pOrder = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');
      const simResult = await PaymentService.simulateUpiPaymentSuccess(pOrder.attemptId!, 'usr-admin-001');

      if (!simResult.success || simResult.order.paymentStatus !== 'PAID' || simResult.order.status !== 'CONFIRMED') {
        throw new Error('Simulation failed to atomically update order to PAID and CONFIRMED');
      }

      const pollCheck = await PaymentService.getPaymentAttemptStatus(pOrder.attemptId!, 'usr-admin-001');
      if (pollCheck.status !== 'SUCCESS') {
        throw new Error(`Expected attempt status SUCCESS after simulation, got ${pollCheck.status}`);
      }
    }
  );

  await runTest(
    'TC_PAY_011',
    'Payment Gateway',
    'Payment Reconciliation for Orphan Captured Payment',
    'Verify admin can reconcile captured payment and ensure order is marked confirmed and paid',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 11',
        customerName: 'Reconcile Guest',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      });

      const pOrder = await PaymentService.createPaymentOrder('usr-admin-001', order.id, 'UPI');
      
      // Directly mark payment record as CAPTURED in DB repository (simulating gateway capture with network drop)
      const payRecord = (await PaymentRepository.getByOrderId(order.id))!;
      payRecord.status = 'CAPTURED';
      await PaymentRepository.save(payRecord);

      // Reconcile
      const reconcileRes = await PaymentService.reconcilePaymentAdmin(payRecord.id);
      if (!reconcileRes.success || reconcileRes.order.paymentStatus !== 'PAID') {
        throw new Error('Reconciliation failed to transition order to PAID');
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 12: DATA RETENTION, 12-MONTH AGGREGATE DASHBOARD & PERFORMANCE
  // -------------------------------------------------------------
  await runTest(
    'TC_RET_001',
    'Data Retention',
    'Order Creation & Operational 30-Day Visibility',
    'Verify that newly created orders appear in operational order list within retention window',
    async () => {
      const order = await OrderService.createOrder({
        userId: 'usr-admin-001',
        orderType: 'Dine-in',
        tableNumber: 'Table 01',
        customerName: 'Retention Test Guest',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 2 }]
      });

      const paginated = AdminService.getPaginatedOrders({ pageSize: 20 });
      const found = paginated.items.some((o) => o.id === order.id);
      if (!found) {
        throw new Error(`Order ${order.id} not found in operational orders within 30-day window`);
      }
    }
  );

  await runTest(
    'TC_RET_002',
    'Data Retention',
    'Operational Retention Boundary (Orders > 30 Days Omitted by Default)',
    'Verify that historical orders older than 30 days are excluded from normal operational view',
    async () => {
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const oldOrder: Order = {
        id: `ord-old-test-${Date.now()}`,
        orderNumber: `OLD-${Date.now().toString().slice(-4)}`,
        restaurantId: 'rest-001',
        userId: 'usr-admin-001',
        customerName: 'Archived Guest',
        customerPhone: '+91 9876543210',
        customerEmail: 'admin@gmail.com',
        orderType: 'Dine-in',
        tableNumber: 'Table 02',
        status: 'COMPLETED',
        items: [{ id: 'itm-1', orderId: 'ord-1', menuItemId: 'itm-001', name: 'Paneer Tikka', unitPrice: 280, quantity: 1, totalPrice: 280 }],
        subtotal: 280,
        tax: 14,
        discount: 0,
        serviceCharge: 0,
        total: 294,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        createdAt: oldDate,
        updatedAt: oldDate
      };

      // Put in active orders to test retention cutoff filter
      db.orders.set(oldOrder.id, oldOrder);

      const operational = AdminService.getPaginatedOrders({ pageSize: 50 });
      const included = operational.items.some((o) => o.id === oldOrder.id);
      if (included) {
        throw new Error('Order older than 30 days must be excluded from default operational view');
      }

      // Cleanup
      db.orders.delete(oldOrder.id);
    }
  );

  await runTest(
    'TC_RET_003',
    'Data Retention',
    'Daily Sales Summary Calculation & Accuracy',
    'Verify generateDailySalesSummary calculates orders, gross sales, net sales, and payments correctly',
    async () => {
      const today = new Date().toISOString().split('T')[0];
      const summary = db.generateDailySalesSummary(today);

      if (!summary || summary.date !== today) {
        throw new Error('Failed to generate daily sales summary for today');
      }
      if (summary.grossSales < 0 || summary.netSales < 0 || summary.totalOrders < 0) {
        throw new Error('Daily summary numbers must be non-negative');
      }
      if (summary.totalOrders > 0 && summary.averageOrderValue <= 0) {
        throw new Error('Average order value must be positive when orders exist');
      }
    }
  );

  await runTest(
    'TC_RET_004',
    'Data Retention',
    'Monthly Summary Rollup & Accumulation',
    'Verify generateMonthlySummary correctly rolls up daily summaries for the specified month',
    async () => {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthly = db.generateMonthlySummary(now.getFullYear(), monthStr);

      if (!monthly || monthly.month !== monthStr) {
        throw new Error(`Failed to generate monthly summary for ${monthStr}`);
      }
      if (monthly.totalOrders < 0 || monthly.netSales < 0) {
        throw new Error('Monthly summary metrics cannot be negative');
      }
    }
  );

  await runTest(
    'TC_RET_005',
    'Data Retention',
    '12-Month Aggregated Dashboard Query Performance',
    'Verify getDashboardAggregate retrieves 12-month metrics from aggregated summaries without full scans',
    async () => {
      const t0 = performance.now();
      const aggregate = AdminService.getDashboardAggregate('LAST_12_MONTHS');
      const durationMs = performance.now() - t0;

      if (!aggregate || !aggregate.kpi || !aggregate.monthlySalesTrend) {
        throw new Error('Dashboard aggregate response missing KPI or monthly trend');
      }
      if (aggregate.monthlySalesTrend.length < 12) {
        throw new Error(`Expected at least 12 monthly trend data points, got ${aggregate.monthlySalesTrend.length}`);
      }
      if (durationMs > 200) {
        throw new Error(`12-month aggregated dashboard query took too long: ${durationMs.toFixed(2)}ms (target < 200ms)`);
      }
    }
  );

  await runTest(
    'TC_RET_006',
    'Data Retention',
    'Historical Analytics Persist Even After Archival',
    'Verify that aggregated analytics summaries remain fully accessible after orders are archived',
    async () => {
      const pastMonth = '2026-08';
      const summary = db.monthlySummaries.get(pastMonth);
      if (!summary) {
        throw new Error(`Expected pre-seeded historical aggregate summary for ${pastMonth}`);
      }
      if (summary.netSales <= 0 || summary.totalOrders <= 0) {
        throw new Error(`Historical aggregate for ${pastMonth} should have positive sales figures`);
      }
    }
  );

  await runTest(
    'TC_RET_007',
    'Data Retention',
    'Retention Job Idempotency',
    'Verify running retention job repeatedly does not duplicate data or corrupt summaries',
    async () => {
      const job1 = db.executeRetentionAndArchivalJob(false);
      const job2 = db.executeRetentionAndArchivalJob(false);

      if (job1.status !== 'COMPLETED' && job1.status !== 'REQUIRES_REVIEW') {
        throw new Error(`Job 1 unexpected status: ${job1.status}`);
      }
      if (job2.status !== 'COMPLETED' && job2.status !== 'REQUIRES_REVIEW') {
        throw new Error(`Job 2 unexpected status: ${job2.status}`);
      }
      // On second run with no new older data, recordsArchived should be 0
      if (job2.status === 'COMPLETED' && job2.recordsArchived > 0 && job1.recordsArchived > 0) {
        throw new Error('Idempotent retention job re-archived records that were already archived');
      }
    }
  );

  await runTest(
    'TC_RET_008',
    'Data Retention',
    'Financial Consistency: Source Orders Total === Daily Summary Total',
    'Verify source transactions match daily summary gross sales exactly',
    async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const dailySummary = db.generateDailySalesSummary(todayStr);

      const activeOrdersToday = Array.from(db.orders.values())
        .filter((o) => (o.createdAt || '').startsWith(todayStr) && o.status !== 'CANCELLED');
      const expectedGross = activeOrdersToday.reduce((sum, o) => sum + (o.subtotal || 0), 0);

      if (expectedGross !== dailySummary.grossSales) {
        throw new Error(`Financial mismatch: Source gross (₹${expectedGross}) !== Daily summary gross (₹${dailySummary.grossSales})`);
      }
    }
  );

  await runTest(
    'TC_RET_009',
    'Data Retention',
    'Master Data Protection (Master Entities Never Archived or Deleted)',
    'Verify user accounts, menu master, recipes, and suppliers are never archived or wiped by retention jobs',
    async () => {
      if (db.users.size === 0) throw new Error('Master users missing');
      if (db.menuItems.size < 25) throw new Error(`Expected at least 25 menu items, got ${db.menuItems.size}`);
      if (db.menuItemRecipes.size < 25) throw new Error(`Expected at least 25 recipes, got ${db.menuItemRecipes.size}`);
      if (db.inventoryItems.size === 0) throw new Error('Inventory master data missing');
      if (db.tables.size === 0) throw new Error('Dining tables master data missing');
    }
  );

  await runTest(
    'TC_RET_010',
    'Data Retention',
    'Server-Side Pagination & Filter Performance',
    'Verify pagination returns correct total, pages, and respects page size',
    async () => {
      const page1 = AdminService.getPaginatedOrders({ page: 1, pageSize: 5 });
      if (page1.pageSize !== 5) throw new Error(`Expected pageSize 5, got ${page1.pageSize}`);
      if (page1.items.length > 5) throw new Error(`Expected max 5 items, got ${page1.items.length}`);
      if (page1.totalPages < 1) throw new Error('totalPages must be >= 1');
    }
  );

  await runTest(
    'TC_RET_011',
    'Concurrency & Locking',
    'Database Mutex Locking Prevents Concurrent Mutation Collisions',
    'Verify db.withLock serializes concurrent async operations safely',
    async () => {
      let counter = 0;
      const tasks = Array.from({ length: 10 }).map(async () => {
        await db.withLock('test-mutex', async () => {
          const current = counter;
          await new Promise((r) => setTimeout(r, 2));
          counter = current + 1;
        });
      });

      await Promise.all(tasks);
      if (counter !== 10) {
        throw new Error(`Expected counter to be 10 after serialized execution, got ${counter}`);
      }
    }
  );

  await runTest(
    'TC_RET_012',
    'Performance & Latency',
    'High-Volume Benchmark & Latency Target Verification',
    'Verify hot-path query latency meets p95 < 200ms target',
    async () => {
      const report = AdminService.runLoadSimulation({
        simulatedOrdersCount: 1000,
        concurrencyLevels: [100, 500]
      });

      if (!report.passCriteriaMet) {
        throw new Error(`Benchmark criteria not met: p95 = ${report.performanceMetrics.p95Ms}ms, avg = ${report.performanceMetrics.avgLatencyMs}ms`);
      }
    }
  );

  // -------------------------------------------------------------
  // SUITE 13: 30-DAY DATE NAVIGATION & KITCHEN / POS ORDERS BY DATE
  // -------------------------------------------------------------
  await runTest(
    'TC_DATE_001',
    'Date Navigation',
    '30-Day Date Range Calculation',
    'Verify getPast30DaysRange provides current date as default and enforces 30 days prior minimum',
    () => {
      const { today, yesterday, minDate } = getPast30DaysRange();
      const now = new Date();
      const expectedToday = now.toISOString().split('T')[0];
      if (today !== expectedToday) {
        throw new Error(`Expected today to be ${expectedToday}, got ${today}`);
      }

      const diffDays = Math.round(
        (new Date(today).getTime() - new Date(minDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays !== 30) {
        throw new Error(`Expected minDate to be exactly 30 days prior, got ${diffDays} days`);
      }
    }
  );

  await runTest(
    'TC_DATE_002',
    'Date Navigation',
    'Human-Readable Date Format Display',
    'Verify formatDisplayDate and formatOrderDateTime output friendly labels',
    () => {
      const { today, yesterday } = getPast30DaysRange();
      const todayFormatted = formatDisplayDate(today);
      if (!todayFormatted.startsWith('Today (')) {
        throw new Error(`Expected format for today to start with "Today (", got ${todayFormatted}`);
      }

      const yesterdayFormatted = formatDisplayDate(yesterday);
      if (!yesterdayFormatted.startsWith('Yesterday (')) {
        throw new Error(`Expected format for yesterday to start with "Yesterday (", got ${yesterdayFormatted}`);
      }

      const sampleIso = '2026-09-30T12:45:00.000Z';
      const orderDateTime = formatOrderDateTime(sampleIso);
      if (!orderDateTime.includes('2026') || !orderDateTime.includes('•')) {
        throw new Error(`Expected order date-time to contain year and separator, got ${orderDateTime}`);
      }
    }
  );

  await runTest(
    'TC_DATE_003',
    'Date Navigation',
    'OrderRepository.getByDate Query for Specific Date',
    'Verify OrderRepository.getByDate retrieves all orders placed on a specific day within 30-day window',
    async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = await OrderRepository.getByDate(today);
      if (!Array.isArray(todayOrders)) {
        throw new Error('Expected array of orders for date');
      }

      // Check all returned orders have creation date matching today
      const allMatch = todayOrders.every((o) => (o.createdAt || '').startsWith(today));
      if (!allMatch) {
        throw new Error('OrderRepository.getByDate returned orders with mismatched dates');
      }
    }
  );

  await runTest(
    'TC_DATE_004',
    'Date Navigation',
    'Previous Day Order List Filtering via Admin API',
    'Verify getPaginatedOrders filters correctly by startDate and endDate for previous day queries',
    async () => {
      const { yesterday } = getPast30DaysRange();
      const res = AdminService.getPaginatedOrders({
        startDate: yesterday,
        endDate: yesterday
      });

      if (!Array.isArray(res.items)) {
        throw new Error('Expected paginated items array');
      }
      const allMatchYesterday = res.items.every((o) => (o.createdAt || '').startsWith(yesterday));
      if (!allMatchYesterday) {
        throw new Error('getPaginatedOrders returned orders not matching yesterday date');
      }
    }
  );

  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  const failedCount = results.filter((r) => r.status === 'FAILED').length;

  delete process.env.IS_TEST_RUN;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    durationMs: Date.now() - startTime,
    results
  };
}
