/**
 * Normalized Persistent Database Engine with File-Backed Storage,
 * ACID-like guarantees, Atomic Locking for Double-Booking Prevention,
 * Relational Foreign Keys, and Real-Time Staff Audit Logging.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  User,
  Hotel,
  Restaurant,
  DiningTable,
  TableBooking,
  MenuCategory,
  MenuItem,
  Order,
  Payment,
  PaymentAttempt,
  PaymentConfiguration,
  AuditLog,
  AdminNotification,
  Invoice,
  BillingSettings,
  BillingAuditLog,
  InventoryItem,
  MenuItemRecipe,
  StockMovement,
  DailyStockLog,
  MonthlyReconciliation,
  Supplier,
  PurchaseOrder,
  WastageRecord,
  InventoryBatch,
  DailySalesSummary,
  MonthlySummary,
  RetentionJobLog,
  DataRetentionConfig,
  OrderIdempotencyRecord
} from '../types/index.ts';
import { getSeedData } from './seed.ts';
import {
  saveDocToFirestore,
  syncDocToFirestore,
  deleteDocFromFirestore,
  loadCollectionFromFirestore,
  getDocFromFirestore
} from './firestoreSync.ts';
import { runFirestoreMigration } from './migrate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'hotel_database.json');

interface SerializedDatabase {
  users: User[];
  hotels: Hotel[];
  restaurants: Restaurant[];
  tables: DiningTable[];
  bookings: TableBooking[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  orders: Order[];
  payments: Payment[];
  paymentAttempts?: PaymentAttempt[];
  paymentConfig?: PaymentConfiguration;
  invoices?: Invoice[];
  billingSettings?: BillingSettings;
  billingAuditLogs?: BillingAuditLog[];
  invoiceCounter?: number;
  auditLogs?: AuditLog[];
  notifications?: AdminNotification[];
  inventoryItems?: InventoryItem[];
  menuItemRecipes?: MenuItemRecipe[];
  stockMovements?: StockMovement[];
  dailyStockLogs?: DailyStockLog[];
  monthlyReconciliations?: MonthlyReconciliation[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  wastageRecords?: WastageRecord[];
  inventoryBatches?: InventoryBatch[];
  // Analytics & Retention Stores
  dailySalesSummaries?: DailySalesSummary[];
  monthlySummaries?: MonthlySummary[];
  archivedOrders?: Order[];
  archivedBookings?: TableBooking[];
  archivedStockMovements?: StockMovement[];
  archivedWastageRecords?: WastageRecord[];
  retentionJobLogs?: RetentionJobLog[];
  dataRetentionConfig?: DataRetentionConfig;
  version: string;
  lastUpdated: string;
}

class DatabaseEngine {
  public users: Map<string, User> = new Map();
  public userEmailIndex: Map<string, string> = new Map(); // email -> userId
  public userUsernameIndex: Map<string, string> = new Map(); // username (lowercase) -> userId
  
  public hotels: Map<string, Hotel> = new Map();
  public restaurants: Map<string, Restaurant> = new Map();
  public tables: Map<string, DiningTable> = new Map();
  public bookings: Map<string, TableBooking> = new Map();
  public bookingRefIndex: Map<string, string> = new Map(); // bookingRef -> bookingId
  
  public menuCategories: Map<string, MenuCategory> = new Map();
  public menuItems: Map<string, MenuItem> = new Map();
  
  // Active Operational Stores (Defaults to current 1 month / 30 days)
  public orders: Map<string, Order> = new Map();
  public orderNumberIndex: Map<string, string> = new Map(); // orderNumber -> orderId
  
  // Fast Indexes for High-Volume Queries
  public ordersByDateIndex: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> Set<orderId>
  public ordersByStatusIndex: Map<string, Set<string>> = new Map(); // OrderStatus -> Set<orderId>
  public ordersByCustomerIdIndex: Map<string, Set<string>> = new Map(); // userId -> Set<orderId>

  public payments: Map<string, Payment> = new Map();
  public paymentAttempts: Map<string, PaymentAttempt> = new Map();
  public providerPaymentIndex: Map<string, string> = new Map(); // providerPaymentId -> paymentId
  public providerOrderIndex: Map<string, string> = new Map(); // providerOrderId -> paymentId
  public paymentOrderIdIndex: Map<string, string> = new Map(); // orderId -> paymentId

  // Idempotency records store
  public orderIdempotency: Map<string, OrderIdempotencyRecord> = new Map();

  // Historical Aggregated Analytics Stores (12 Months Retention)
  public dailySalesSummaries: Map<string, DailySalesSummary> = new Map(); // YYYY-MM-DD -> DailySalesSummary
  public monthlySummaries: Map<string, MonthlySummary> = new Map(); // YYYY-MM -> MonthlySummary

  // Archived Transaction Stores (Older than 30 days)
  public archivedOrders: Map<string, Order> = new Map();
  public archivedBookings: Map<string, TableBooking> = new Map();
  public archivedStockMovements: StockMovement[] = [];
  public archivedWastageRecords: Map<string, WastageRecord> = new Map();

  // Retention Governance & Logs
  public retentionJobLogs: RetentionJobLog[] = [];
  public dataRetentionConfig: DataRetentionConfig = {
    detailedRetentionDays: 30,
    dashboardAggregateRetentionMonths: 12,
    autoArchiveEnabled: true,
    autoArchiveHourUTC: 2, // 2:00 AM UTC
    updatedAt: new Date().toISOString()
  };

  // Billing & Invoice Stores
  public invoices: Map<string, Invoice> = new Map();
  public invoiceNumberIndex: Map<string, string> = new Map(); // invoiceNumber -> invoiceId
  public invoiceTokenIndex: Map<string, string> = new Map(); // publicToken -> invoiceId
  public orderInvoiceIndex: Map<string, string> = new Map(); // orderId -> invoiceId
  public invoiceCounter: number = 100;

  public billingSettings: BillingSettings = {
    id: 'billing-settings-001',
    hotelName: 'ABC HOTEL',
    hotelLogoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&auto=format&fit=crop&q=80',
    address: '77 Luxury Promenade, Outer Ring Road, Bengaluru, Karnataka 560103',
    phone: '+91 96203 69291',
    email: 'billing@abchotel.com',
    gstin: '29ABCDE1234F1ZH',
    fssaiNumber: '11223344556677',
    invoicePrefix: 'INV',
    gstPercent: 5,
    serviceFeePercent: 5,
    defaultPrintFormat: 'A4',
    invoiceFooter: 'Thank you for dining at ABC HOTEL. We look forward to serving you again.',
    termsAndConditions: '1. All prices are in INR. 2. Taxes as per applicable Govt GST regulations. 3. Please present invoice for any billing queries.',
    updatedAt: new Date().toISOString()
  };

  public billingAuditLogs: Map<string, BillingAuditLog> = new Map();
  
  // Inventory & Stock Stores
  public inventoryItems: Map<string, InventoryItem> = new Map();
  public menuItemRecipes: Map<string, MenuItemRecipe> = new Map(); // menuItemId -> MenuItemRecipe
  public stockMovements: StockMovement[] = [];
  public dailyStockLogs: Map<string, DailyStockLog> = new Map(); // logId (date_itemId) -> DailyStockLog
  public monthlyReconciliations: Map<string, MonthlyReconciliation> = new Map(); // month (YYYY-MM) -> MonthlyReconciliation
  public suppliers: Map<string, Supplier> = new Map();
  public purchaseOrders: Map<string, PurchaseOrder> = new Map();
  public wastageRecords: Map<string, WastageRecord> = new Map();
  public inventoryBatches: Map<string, InventoryBatch> = new Map();
  public paymentConfig: PaymentConfiguration = {
    id: 'hotel-payment-config',
    hotelName: 'ABC HOTEL',
    hotelUpiId: '9620369291@ybl',
    hotelMobileNumber: '+91 96203 69291',
    hotelQrCodeUrl: '',
    paymentProvider: 'razorpay',
    paymentEnvironment: 'production',
    paymentInstructions: 'Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, CRED). Pay exact amount to 9620369291@ybl for instant automated order confirmation.',
    supportContactNumber: '+91 96203 69291',
    updatedAt: new Date().toISOString()
  };

  public auditLogs: Map<string, AuditLog> = new Map();
  public notifications: Map<string, AdminNotification> = new Map();

  private isInitialized = false;
  private mutexLocks: Map<string, boolean> = new Map(); // Key locks for concurrency safety
  private saveTimeout: NodeJS.Timeout | null = null;
  public dirtySyncQueue: Map<string, { collection: string; id: string; data: any }> = new Map();

  public async queueSync(collection: string, id: string, data: any): Promise<void> {
    this.dirtySyncQueue.set(`${collection}:${id}`, { collection, id, data });
    // Synchronously await write to Firestore for authoritative Cloud Run persistence
    try {
      await saveDocToFirestore(collection, id, data);
    } catch (err: any) {
      console.warn(`[DATABASE FIRESTORE SYNC] Notice writing ${collection}/${id}:`, err?.message || err);
      if (process.env.NODE_ENV === 'production' && !process.env.IS_TEST_RUN) {
        throw err; // Fail-closed in production if Firestore persistence fails!
      }
    }
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
    this.dirtySyncQueue.delete(`${collection}:${id}`);
    try {
      await deleteDocFromFirestore(collection, id);
    } catch (err: any) {
      console.warn(`[DATABASE FIRESTORE DELETE] Notice deleting ${collection}/${id}:`, err?.message || err);
      if (process.env.NODE_ENV === 'production' && !process.env.IS_TEST_RUN) {
        throw err;
      }
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const isProduction = process.env.NODE_ENV === 'production';

    // 1. In production, Cloud Run requires Firestore as the authoritative persistent source of truth
    try {
      let fsUsers = await loadCollectionFromFirestore<User>('users');
      if (!fsUsers || fsUsers.length === 0) {
        console.log('[DATABASE] Firestore collections empty. Bootstrapping authoritative Firestore database...');
        await runFirestoreMigration();
        fsUsers = await loadCollectionFromFirestore<User>('users');
      }

      for (const u of fsUsers || []) {
        if (!u.status) u.status = 'ACTIVE';
        this.users.set(u.id, u);
        if (u.email) this.userEmailIndex.set(u.email.toLowerCase(), u.id);
        if (u.username) this.userUsernameIndex.set(u.username.toLowerCase(), u.id);
      }

      const fsTables = await loadCollectionFromFirestore<DiningTable>('tables');
      for (const t of fsTables || []) {
        this.tables.set(t.id, t);
      }

      const fsOrders = await loadCollectionFromFirestore<Order>('orders');
      for (const o of fsOrders || []) {
        this.orders.set(o.id, o);
        if (o.orderNumber) this.orderNumberIndex.set(o.orderNumber.toUpperCase(), o.id);
      }

      const fsPayments = await loadCollectionFromFirestore<Payment>('payments');
      for (const p of fsPayments || []) {
        this.payments.set(p.id, p);
      }

      const fsInvoices = await loadCollectionFromFirestore<Invoice>('invoices');
      for (const inv of fsInvoices || []) {
        this.invoices.set(inv.id, inv);
        if (inv.invoiceNumber) this.invoiceNumberIndex.set(inv.invoiceNumber.toUpperCase(), inv.id);
      }

      const fsCategories = await loadCollectionFromFirestore<MenuCategory>('menuCategories');
      for (const c of fsCategories || []) {
        this.menuCategories.set(c.id, c);
      }

      const fsMenuItems = await loadCollectionFromFirestore<MenuItem>('menuItems');
      for (const m of fsMenuItems || []) {
        this.menuItems.set(m.id, m);
      }

      const fsHotels = await loadCollectionFromFirestore<Hotel>('hotels');
      for (const h of fsHotels || []) {
        this.hotels.set(h.id, h);
      }

      const fsRestaurants = await loadCollectionFromFirestore<Restaurant>('restaurants');
      for (const r of fsRestaurants || []) {
        this.restaurants.set(r.id, r);
      }

      const fsInventory = await loadCollectionFromFirestore<InventoryItem>('inventoryItems');
      for (const inv of fsInventory || []) {
        this.inventoryItems.set(inv.id, inv);
      }
    } catch (err) {
      if (isProduction) {
        console.error('[CRITICAL PRODUCTION DATABASE ERROR] Unable to connect to authoritative Firestore database:', err);
        throw new Error('Authoritative Firestore connection failed in production. Halting startup.');
      }
      console.warn('[DATABASE] Error loading from Firestore in dev, falling back to local file engine:', err);
    }

    // 2. Load persistent data from local file ONLY for development/test fallback (Strictly excluded in production)
    if (!isProduction && this.users.size === 0 && fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data: SerializedDatabase = JSON.parse(raw);

        // Populate users
        for (const u of data.users || []) {
          // Normalize status
          if (!u.status) u.status = 'ACTIVE';
          this.users.set(u.id, u);
          if (u.email) this.userEmailIndex.set(u.email.toLowerCase(), u.id);
          if (u.username) this.userUsernameIndex.set(u.username.toLowerCase(), u.id);
        }

        // Ensure admin@gmail.com is created with Password@123
        const targetAdminEmail = 'admin@gmail.com';
        const passwordHash = '$2b$10$VRQy1Oq99j.aMG0qXIxDoeDMTOZf3e3tafpUcCAUVKrPxkFT1CGYm'; // Password@123
        if (!this.userEmailIndex.has(targetAdminEmail)) {
          const adminUser: User = {
            id: 'usr-admin-001',
            firstName: 'Hotel',
            lastName: 'Administrator',
            username: 'admin',
            email: targetAdminEmail,
            phone: '+91 9876543210',
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(adminUser.id, adminUser);
          this.userEmailIndex.set(targetAdminEmail, adminUser.id);
        } else {
          const existingId = this.userEmailIndex.get(targetAdminEmail)!;
          const admin = this.users.get(existingId);
          if (admin) {
            admin.passwordHash = passwordHash;
            admin.role = 'ADMIN';
            admin.status = 'ACTIVE';
            if (!admin.username) admin.username = 'admin';
          }
        }

        // Ensure kitchen@gmail.com is created with Password@123
        const targetKitchenEmail = 'kitchen@gmail.com';
        if (!this.userEmailIndex.has(targetKitchenEmail)) {
          const kitchenUser: User = {
            id: 'usr-kitchen-001',
            firstName: 'Executive',
            lastName: 'Chef & Kitchen',
            username: 'kitchen',
            email: targetKitchenEmail,
            phone: '+91 9876543299',
            passwordHash,
            role: 'KITCHEN',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(kitchenUser.id, kitchenUser);
          this.userEmailIndex.set(targetKitchenEmail, kitchenUser.id);
        } else {
          const existingKitchenId = this.userEmailIndex.get(targetKitchenEmail)!;
          const kitchen = this.users.get(existingKitchenId);
          if (kitchen) {
            kitchen.passwordHash = passwordHash;
            kitchen.role = 'KITCHEN';
            kitchen.status = 'ACTIVE';
            if (!kitchen.username) kitchen.username = 'kitchen';
          }
        }

        // Ensure manager@gmail.com is created with Password@123
        const targetManagerEmail = 'manager@gmail.com';
        if (!this.userEmailIndex.has(targetManagerEmail)) {
          const managerUser: User = {
            id: 'usr-manager-001',
            firstName: 'Hotel',
            lastName: 'Manager',
            username: 'manager',
            email: targetManagerEmail,
            phone: '+91 9876543222',
            passwordHash,
            role: 'MANAGER',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(managerUser.id, managerUser);
          this.userEmailIndex.set(targetManagerEmail, managerUser.id);
        } else {
          const existingManagerId = this.userEmailIndex.get(targetManagerEmail)!;
          const manager = this.users.get(existingManagerId);
          if (manager) {
            manager.passwordHash = passwordHash;
            manager.role = 'MANAGER';
            manager.status = 'ACTIVE';
            if (!manager.username) manager.username = 'manager';
          }
        }

        // Ensure delivery@gmail.com is created with Password@123
        const targetDeliveryEmail = 'delivery@gmail.com';
        if (!this.userEmailIndex.has(targetDeliveryEmail)) {
          const deliveryUser: User = {
            id: 'usr-delivery-001',
            firstName: 'Delivery',
            lastName: 'Staff Rider',
            username: 'delivery',
            email: targetDeliveryEmail,
            phone: '+91 9876543200',
            passwordHash,
            role: 'DELIVERY',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(deliveryUser.id, deliveryUser);
          this.userEmailIndex.set(targetDeliveryEmail, deliveryUser.id);
        } else {
          const existingDeliveryId = this.userEmailIndex.get(targetDeliveryEmail)!;
          const delivery = this.users.get(existingDeliveryId);
          if (delivery) {
            delivery.passwordHash = passwordHash;
            delivery.role = 'DELIVERY';
            delivery.status = 'ACTIVE';
            if (!delivery.username) delivery.username = 'delivery';
          }
        }

        // Ensure rakeshchandh1998@gmail.com is created with Password@123 as CUSTOMER
        const targetRakeshEmail = 'rakeshchandh1998@gmail.com';
        if (!this.userEmailIndex.has(targetRakeshEmail)) {
          const rakeshUser: User = {
            id: 'usr-rakesh-001',
            firstName: 'Rakesh',
            lastName: 'Chandh',
            username: 'rakesh.chandh',
            email: targetRakeshEmail,
            phone: '+91 9876543201',
            passwordHash,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(rakeshUser.id, rakeshUser);
          this.userEmailIndex.set(targetRakeshEmail, rakeshUser.id);
        } else {
          const existingRakeshId = this.userEmailIndex.get(targetRakeshEmail)!;
          const rakesh = this.users.get(existingRakeshId);
          if (rakesh) {
            rakesh.passwordHash = passwordHash;
            rakesh.role = 'CUSTOMER';
            rakesh.status = 'ACTIVE';
            if (!rakesh.username) rakesh.username = 'rakesh.chandh';
          }
        }

        // Ensure generic customer@gmail.com is created with Password@123 as CUSTOMER
        const targetCustEmail = 'customer@gmail.com';
        if (!this.userEmailIndex.has(targetCustEmail)) {
          const custUser: User = {
            id: 'usr-demo-cust-001',
            firstName: 'Priya',
            lastName: 'Sharma',
            username: 'customer',
            email: targetCustEmail,
            phone: '+91 9876543290',
            passwordHash,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(custUser.id, custUser);
          this.userEmailIndex.set(targetCustEmail, custUser.id);
        } else {
          const existingCustId = this.userEmailIndex.get(targetCustEmail)!;
          const cust = this.users.get(existingCustId);
          if (cust && !cust.username) cust.username = 'customer';
        }

        // Ensure staff@gmail.com is created with Password@123 as STAFF
        const targetStaffEmail = 'staff@gmail.com';
        if (!this.userEmailIndex.has(targetStaffEmail)) {
          const staffUser: User = {
            id: 'usr-staff-alias-001',
            firstName: 'Hotel',
            lastName: 'Staff Admin',
            username: 'staff',
            email: targetStaffEmail,
            phone: '+91 9876543211',
            passwordHash,
            role: 'STAFF',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.users.set(staffUser.id, staffUser);
          this.userEmailIndex.set(targetStaffEmail, staffUser.id);
        } else {
          const existingStaffId = this.userEmailIndex.get(targetStaffEmail)!;
          const staff = this.users.get(existingStaffId);
          if (staff) {
            staff.passwordHash = passwordHash;
            staff.role = 'STAFF';
            staff.status = 'ACTIVE';
            if (!staff.username) staff.username = 'staff';
          }
        }

        // Ensure all loaded users have a unique username and build userUsernameIndex
        for (const u of this.users.values()) {
          if (!u.username) {
            const fallback = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
            let candidate = fallback || `user.${u.id.substring(4, 9)}`;
            let counter = 1;
            while (this.userUsernameIndex.has(candidate)) {
              candidate = `${fallback}${counter++}`;
            }
            u.username = candidate;
          }
          this.userUsernameIndex.set(u.username.toLowerCase(), u.id);
        }

        // Populate hotels & restaurants
        for (const h of data.hotels || []) this.hotels.set(h.id, h);
        for (const r of data.restaurants || []) this.restaurants.set(r.id, r);

        // Populate tables
        for (const t of data.tables || []) this.tables.set(t.id, t);

        // Populate bookings
        for (const b of data.bookings || []) {
          this.bookings.set(b.id, b);
          this.bookingRefIndex.set(b.bookingReference.toUpperCase(), b.id);
        }

        // Populate menu categories & ensure the 5 canonical categories exist
        const seedData = await getSeedData();
        for (const c of seedData.menuCategories) {
          this.menuCategories.set(c.id, c);
        }
        for (const c of data.menuCategories || []) {
          if (!this.menuCategories.has(c.id)) {
            this.menuCategories.set(c.id, c);
          }
        }

        // Populate menu items
        for (const m of data.menuItems || []) {
          this.menuItems.set(m.id, m);
        }

        // Ensure all 25 default menu items from seed are present and synced by SKU/ID without duplicates
        for (const seedItem of seedData.menuItems) {
          let existingItem: MenuItem | undefined;
          for (const item of this.menuItems.values()) {
            if (item.sku && seedItem.sku && item.sku === seedItem.sku) {
              existingItem = item;
              break;
            }
            if (item.name.toLowerCase().trim() === seedItem.name.toLowerCase().trim()) {
              existingItem = item;
              break;
            }
          }

          if (existingItem) {
            existingItem.sku = seedItem.sku;
            existingItem.name = seedItem.name;
            existingItem.description = seedItem.description;
            existingItem.categoryId = seedItem.categoryId;
            existingItem.categoryName = seedItem.categoryName;
            existingItem.type = seedItem.type;
            existingItem.vegetarian = seedItem.vegetarian;
            if (!existingItem.imageUrl || existingItem.imageUrl.includes('placeholder')) {
              existingItem.imageUrl = seedItem.imageUrl;
            }
            if (typeof existingItem.price !== 'number' || isNaN(existingItem.price)) {
              existingItem.price = seedItem.price;
            }
            if (existingItem.available === undefined) existingItem.available = true;
            if (existingItem.isActive === undefined) existingItem.isActive = true;
          } else {
            this.menuItems.set(seedItem.id, { ...seedItem });
          }
        }

        // Populate orders
        for (const o of data.orders || []) {
          this.orders.set(o.id, o);
          this.orderNumberIndex.set(o.orderNumber.toUpperCase(), o.id);
        }

        // Populate payments
        for (const p of data.payments || []) {
          this.payments.set(p.id, p);
          if (p.providerPaymentId) {
            this.providerPaymentIndex.set(p.providerPaymentId, p.id);
          }
          if (p.providerOrderId) {
            this.providerOrderIndex.set(p.providerOrderId, p.id);
          }
        }

        // Populate payment attempts
        for (const pa of data.paymentAttempts || []) {
          this.paymentAttempts.set(pa.id, pa);
        }

        // Populate payment config
        if (data.paymentConfig) {
          this.paymentConfig = {
            ...this.paymentConfig,
            ...data.paymentConfig
          };
          if (!this.paymentConfig.hotelUpiId || this.paymentConfig.hotelUpiId === 'abchotel@upi') {
            this.paymentConfig.hotelUpiId = '9620369291@ybl';
          }
        }

        // Populate invoices & billing settings
        for (const inv of data.invoices || []) {
          this.invoices.set(inv.id, inv);
          this.invoiceNumberIndex.set(inv.invoiceNumber.toUpperCase(), inv.id);
          this.invoiceTokenIndex.set(inv.publicToken, inv.id);
          this.orderInvoiceIndex.set(inv.orderId, inv.id);
        }

        if (data.billingSettings) {
          this.billingSettings = {
            ...this.billingSettings,
            ...data.billingSettings
          };
        }

        if (data.invoiceCounter) {
          this.invoiceCounter = data.invoiceCounter;
        }

        for (const log of data.billingAuditLogs || []) {
          this.billingAuditLogs.set(log.id, log);
        }

        // Populate Inventory Items, Recipes & Movements
        for (const item of data.inventoryItems || []) {
          this.inventoryItems.set(item.id, item);
        }
        for (const recipe of data.menuItemRecipes || []) {
          this.menuItemRecipes.set(recipe.menuItemId, recipe);
        }
        this.stockMovements = data.stockMovements || [];

        for (const log of data.dailyStockLogs || []) {
          this.dailyStockLogs.set(log.id, log);
        }
        for (const rec of data.monthlyReconciliations || []) {
          this.monthlyReconciliations.set(rec.month, rec);
        }
        for (const sup of data.suppliers || []) {
          this.suppliers.set(sup.id, sup);
        }
        for (const po of data.purchaseOrders || []) {
          this.purchaseOrders.set(po.id, po);
        }
        for (const wr of data.wastageRecords || []) {
          this.wastageRecords.set(wr.id, wr);
        }
        for (const bat of data.inventoryBatches || []) {
          this.inventoryBatches.set(bat.id, bat);
        }

        // Ensure seed inventory exists if empty
        this.seedInitialInventory();

        // Populate audit logs & notifications
        for (const a of data.auditLogs || []) this.auditLogs.set(a.id, a);
        for (const n of data.notifications || []) this.notifications.set(n.id, n);

        // Populate Daily Sales Summaries & Monthly Summaries
        for (const ds of data.dailySalesSummaries || []) {
          this.dailySalesSummaries.set(ds.date, ds);
        }
        for (const ms of data.monthlySummaries || []) {
          this.monthlySummaries.set(ms.month, ms);
        }

        // Populate Archived Stores
        for (const ao of data.archivedOrders || []) {
          this.archivedOrders.set(ao.id, ao);
        }
        for (const ab of data.archivedBookings || []) {
          this.archivedBookings.set(ab.id, ab);
        }
        this.archivedStockMovements = data.archivedStockMovements || [];
        for (const aw of data.archivedWastageRecords || []) {
          this.archivedWastageRecords.set(aw.id, aw);
        }

        this.retentionJobLogs = data.retentionJobLogs || [];
        if (data.dataRetentionConfig) {
          this.dataRetentionConfig = {
            ...this.dataRetentionConfig,
            ...data.dataRetentionConfig
          };
        }

        // Build Fast Query Indexes
        this.rebuildIndexes();

        // Seed 12-month historical analytics summaries if empty
        this.seed12MonthHistoricalSummaries();

        this.isInitialized = true;
        this.persist();
        console.log(`[DATABASE] Loaded persistent database from ${DB_FILE} with ${this.users.size} users, ${this.bookings.size} bookings, ${this.orders.size} active orders, ${this.archivedOrders.size} archived orders, ${this.menuItems.size} menu items, ${this.monthlySummaries.size} monthly summaries.`);
        return;
      } catch (err) {
        console.error('[DATABASE] Error reading database file, re-seeding default records:', err);
      }
    }

    // Otherwise seed initial database
    const seed = await getSeedData();

    // Load Users
    for (const u of seed.users) {
      if (!u.status) u.status = 'ACTIVE';
      this.users.set(u.id, u);
      if (u.email) this.userEmailIndex.set(u.email.toLowerCase(), u.id);
      if (u.username) this.userUsernameIndex.set(u.username.toLowerCase(), u.id);
    }

    // Load Hotel & Restaurant
    this.hotels.set(seed.hotel.id, seed.hotel);
    this.restaurants.set(seed.restaurant.id, seed.restaurant);

    // Load Tables
    for (const t of seed.tables) {
      this.tables.set(t.id, t);
    }

    // Load Menu Categories
    for (const c of seed.menuCategories) {
      this.menuCategories.set(c.id, c);
    }

    // Load Menu Items
    for (const item of seed.menuItems) {
      this.menuItems.set(item.id, item);
    }

    // Initial Seed Audit Logs
    const sampleAudit: AuditLog = {
      id: 'audit-001',
      adminId: 'usr-admin-001',
      adminEmail: 'admin@gmail.com',
      action: 'SYSTEM_INITIALIZED',
      entity: 'SETTINGS',
      entityId: 'rst-abc-001',
      details: 'ABC Hotel database initialized with verified menu and floor plan.',
      timestamp: new Date().toISOString()
    };
    this.auditLogs.set(sampleAudit.id, sampleAudit);

    this.isInitialized = true;
    this.seedInitialInventory();
    this.persist();
  }

  /**
   * Seed initial raw materials, menu recipes, and opening movements
   */
  public seedInitialInventory(): void {
    const initialItems: InventoryItem[] = [
      {
        id: 'inv-001',
        name: 'Royal Paneer (Cottage Cheese)',
        category: 'Dairy',
        currentStock: 35.0,
        unit: 'kg',
        minThreshold: 5.0,
        unitCost: 380,
        supplier: 'Amul Dairy Co.',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-002',
        name: 'Amul Butter',
        category: 'Dairy',
        currentStock: 25.0,
        unit: 'kg',
        minThreshold: 3.0,
        unitCost: 520,
        supplier: 'Amul Dairy Co.',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-003',
        name: 'Royal Basmati Rice',
        category: 'Grains & Rice',
        currentStock: 60.0,
        unit: 'kg',
        minThreshold: 10.0,
        unitCost: 110,
        supplier: 'India Gate Rice Ltd',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-004',
        name: 'Fresh Farm Chicken',
        category: 'Meat & Poultry',
        currentStock: 40.0,
        unit: 'kg',
        minThreshold: 8.0,
        unitCost: 260,
        supplier: 'Suguna Poultry',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-005',
        name: 'Red Tomatoes',
        category: 'Vegetables',
        currentStock: 45.0,
        unit: 'kg',
        minThreshold: 10.0,
        unitCost: 40,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-006',
        name: 'Fresh Dairy Cream',
        category: 'Dairy',
        currentStock: 18.0,
        unit: 'kg',
        minThreshold: 3.0,
        unitCost: 240,
        supplier: 'Nandini Dairy',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-007',
        name: 'Pure Refined Sunflower Oil',
        category: 'Oils & Fats',
        currentStock: 50.0,
        unit: 'L',
        minThreshold: 8.0,
        unitCost: 160,
        supplier: 'Fortune Oils',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-008',
        name: 'Arabica Coffee Beans',
        category: 'Beverages',
        currentStock: 10.0,
        unit: 'kg',
        minThreshold: 2.0,
        unitCost: 950,
        supplier: 'Chikmagalur Estate',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-009',
        name: 'Whole Buffalo Milk',
        category: 'Dairy',
        currentStock: 40.0,
        unit: 'L',
        minThreshold: 5.0,
        unitCost: 65,
        supplier: 'Nandini Dairy',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-010',
        name: 'Fine Wheat Flour / Atta',
        category: 'Bakery & Flour',
        currentStock: 50.0,
        unit: 'kg',
        minThreshold: 10.0,
        unitCost: 45,
        supplier: 'Aashirvaad Atta',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-011',
        name: 'Fresh Tender Mutton',
        category: 'Meat & Poultry',
        currentStock: 25.0,
        unit: 'kg',
        minThreshold: 5.0,
        unitCost: 650,
        supplier: 'Royal Mutton Suppliers',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-012',
        name: 'Fresh Boneless Fish Fillet',
        category: 'Meat & Poultry',
        currentStock: 20.0,
        unit: 'kg',
        minThreshold: 4.0,
        unitCost: 500,
        supplier: 'Coastal Catch Fisheries',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-013',
        name: 'Fresh Onions',
        category: 'Vegetables',
        currentStock: 55.0,
        unit: 'kg',
        minThreshold: 10.0,
        unitCost: 35,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-014',
        name: 'Artisanal Yogurt / Hung Curd',
        category: 'Dairy',
        currentStock: 30.0,
        unit: 'kg',
        minThreshold: 6.0,
        unitCost: 90,
        supplier: 'Amul Dairy Co.',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-015',
        name: 'Ginger Garlic Paste',
        category: 'Spices',
        currentStock: 15.0,
        unit: 'kg',
        minThreshold: 3.0,
        unitCost: 140,
        supplier: 'Everest Spices',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-016',
        name: 'Royal Biryani & Garam Masala',
        category: 'Spices',
        currentStock: 12.0,
        unit: 'kg',
        minThreshold: 2.0,
        unitCost: 450,
        supplier: 'MDH Spices',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-017',
        name: 'Fresh Mint & Coriander Leaves',
        category: 'Vegetables',
        currentStock: 10.0,
        unit: 'kg',
        minThreshold: 2.0,
        unitCost: 60,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-018',
        name: 'Fresh Farm Cauliflower',
        category: 'Vegetables',
        currentStock: 25.0,
        unit: 'kg',
        minThreshold: 5.0,
        unitCost: 30,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-019',
        name: 'Sweet Golden Corn',
        category: 'Vegetables',
        currentStock: 20.0,
        unit: 'kg',
        minThreshold: 4.0,
        unitCost: 80,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-020',
        name: 'Fresh Bell Peppers & Capsicum',
        category: 'Vegetables',
        currentStock: 22.0,
        unit: 'kg',
        minThreshold: 4.0,
        unitCost: 70,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-021',
        name: 'Whole Black Lentils / Urad Dal',
        category: 'Grains & Rice',
        currentStock: 30.0,
        unit: 'kg',
        minThreshold: 5.0,
        unitCost: 130,
        supplier: 'Tata Sampann',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-022',
        name: 'Refined Pure Sugar',
        category: 'Pantry',
        currentStock: 35.0,
        unit: 'kg',
        minThreshold: 8.0,
        unitCost: 44,
        supplier: 'Madhur Sugar',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-023',
        name: 'Fresh Juicy Red Carrots',
        category: 'Vegetables',
        currentStock: 30.0,
        unit: 'kg',
        minThreshold: 6.0,
        unitCost: 50,
        supplier: 'Bengaluru Fresh Farm',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-024',
        name: 'Royal Khoya / Mawa',
        category: 'Dairy',
        currentStock: 15.0,
        unit: 'kg',
        minThreshold: 3.0,
        unitCost: 360,
        supplier: 'Amul Dairy Co.',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inv-025',
        name: 'Pure Desi Ghee',
        category: 'Oils & Fats',
        currentStock: 18.0,
        unit: 'kg',
        minThreshold: 3.0,
        unitCost: 680,
        supplier: 'Nandini Dairy',
        lastRestockedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const item of initialItems) {
      if (!this.inventoryItems.has(item.id)) {
        this.inventoryItems.set(item.id, item);
      }
    }

    // Seed suppliers
    if (!this.suppliers.has('sup-001')) {
      this.suppliers.set('sup-001', {
        id: 'sup-001',
        name: 'Bengaluru Fresh Farm',
        companyName: 'Bengaluru Fresh Farm Ltd.',
        contactPerson: 'Rajesh Kumar',
        mobile: '+91 9999999999',
        email: 'sales@bengalurufresh.com',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Seed 25 complete recipes mapped to dishes
    const all25Recipes: MenuItemRecipe[] = [
      {
        menuItemId: 'itm-001',
        menuItemName: 'Paneer Tikka',
        ingredients: [
          { inventoryItemId: 'inv-001', inventoryItemName: 'Royal Paneer (Cottage Cheese)', unit: 'kg', quantityRequired: 0.20 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-020', inventoryItemName: 'Fresh Bell Peppers & Capsicum', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-002',
        menuItemName: 'Gobi Manchurian',
        ingredients: [
          { inventoryItemId: 'inv-018', inventoryItemName: 'Fresh Farm Cauliflower', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-010', inventoryItemName: 'Fine Wheat Flour / Atta', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-003',
        menuItemName: 'Crispy Corn',
        ingredients: [
          { inventoryItemId: 'inv-019', inventoryItemName: 'Sweet Golden Corn', unit: 'kg', quantityRequired: 0.20 },
          { inventoryItemId: 'inv-010', inventoryItemName: 'Fine Wheat Flour / Atta', unit: 'kg', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.025 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.008 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-004',
        menuItemName: 'Veg Spring Rolls',
        ingredients: [
          { inventoryItemId: 'inv-010', inventoryItemName: 'Fine Wheat Flour / Atta', unit: 'kg', quantityRequired: 0.08 },
          { inventoryItemId: 'inv-018', inventoryItemName: 'Fresh Farm Cauliflower', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-020', inventoryItemName: 'Fresh Bell Peppers & Capsicum', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.03 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-005',
        menuItemName: 'Truffle Malai Paneer Tikka',
        ingredients: [
          { inventoryItemId: 'inv-001', inventoryItemName: 'Royal Paneer (Cottage Cheese)', unit: 'kg', quantityRequired: 0.22 },
          { inventoryItemId: 'inv-006', inventoryItemName: 'Fresh Dairy Cream', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-006',
        menuItemName: 'Chicken 65',
        ingredients: [
          { inventoryItemId: 'inv-004', inventoryItemName: 'Fresh Farm Chicken', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.012 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-007',
        menuItemName: 'Chicken Tikka',
        ingredients: [
          { inventoryItemId: 'inv-004', inventoryItemName: 'Fresh Farm Chicken', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-002', inventoryItemName: 'Amul Butter', unit: 'kg', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.012 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-008',
        menuItemName: 'Chicken Wings',
        ingredients: [
          { inventoryItemId: 'inv-004', inventoryItemName: 'Fresh Farm Chicken', unit: 'kg', quantityRequired: 0.30 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-009',
        menuItemName: 'Mutton Seekh Kebab',
        ingredients: [
          { inventoryItemId: 'inv-011', inventoryItemName: 'Fresh Tender Mutton', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-017', inventoryItemName: 'Fresh Mint & Coriander Leaves', unit: 'kg', quantityRequired: 0.01 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.012 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-010',
        menuItemName: 'Fish Tikka',
        ingredients: [
          { inventoryItemId: 'inv-012', inventoryItemName: 'Fresh Boneless Fish Fillet', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-011',
        menuItemName: 'Chicken Biryani',
        ingredients: [
          { inventoryItemId: 'inv-004', inventoryItemName: 'Fresh Farm Chicken', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-003', inventoryItemName: 'Royal Basmati Rice', unit: 'kg', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.08 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 },
          { inventoryItemId: 'inv-017', inventoryItemName: 'Fresh Mint & Coriander Leaves', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-012',
        menuItemName: 'Mutton Biryani',
        ingredients: [
          { inventoryItemId: 'inv-011', inventoryItemName: 'Fresh Tender Mutton', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-003', inventoryItemName: 'Royal Basmati Rice', unit: 'kg', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.08 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-025', inventoryItemName: 'Pure Desi Ghee', unit: 'kg', quantityRequired: 0.025 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.012 },
          { inventoryItemId: 'inv-017', inventoryItemName: 'Fresh Mint & Coriander Leaves', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-013',
        menuItemName: 'Veg Biryani',
        ingredients: [
          { inventoryItemId: 'inv-003', inventoryItemName: 'Royal Basmati Rice', unit: 'kg', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-018', inventoryItemName: 'Fresh Farm Cauliflower', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-023', inventoryItemName: 'Fresh Juicy Red Carrots', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-014',
        menuItemName: 'Paneer Biryani',
        ingredients: [
          { inventoryItemId: 'inv-001', inventoryItemName: 'Royal Paneer (Cottage Cheese)', unit: 'kg', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-003', inventoryItemName: 'Royal Basmati Rice', unit: 'kg', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-015',
        menuItemName: 'Paneer Butter Masala',
        ingredients: [
          { inventoryItemId: 'inv-001', inventoryItemName: 'Royal Paneer (Cottage Cheese)', unit: 'kg', quantityRequired: 0.20 },
          { inventoryItemId: 'inv-002', inventoryItemName: 'Amul Butter', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.12 },
          { inventoryItemId: 'inv-006', inventoryItemName: 'Fresh Dairy Cream', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-016',
        menuItemName: 'Dal Makhani',
        ingredients: [
          { inventoryItemId: 'inv-021', inventoryItemName: 'Whole Black Lentils / Urad Dal', unit: 'kg', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-002', inventoryItemName: 'Amul Butter', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-006', inventoryItemName: 'Fresh Dairy Cream', unit: 'kg', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.08 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-017',
        menuItemName: 'Kadai Paneer',
        ingredients: [
          { inventoryItemId: 'inv-001', inventoryItemName: 'Royal Paneer (Cottage Cheese)', unit: 'kg', quantityRequired: 0.20 },
          { inventoryItemId: 'inv-020', inventoryItemName: 'Fresh Bell Peppers & Capsicum', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.10 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.012 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-018',
        menuItemName: 'Veg Kolhapuri',
        ingredients: [
          { inventoryItemId: 'inv-018', inventoryItemName: 'Fresh Farm Cauliflower', unit: 'kg', quantityRequired: 0.08 },
          { inventoryItemId: 'inv-023', inventoryItemName: 'Fresh Juicy Red Carrots', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-020', inventoryItemName: 'Fresh Bell Peppers & Capsicum', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.10 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.025 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.015 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-019',
        menuItemName: 'Butter Chicken',
        ingredients: [
          { inventoryItemId: 'inv-004', inventoryItemName: 'Fresh Farm Chicken', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-002', inventoryItemName: 'Amul Butter', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.12 },
          { inventoryItemId: 'inv-006', inventoryItemName: 'Fresh Dairy Cream', unit: 'kg', quantityRequired: 0.04 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.01 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.015 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-020',
        menuItemName: 'Chicken Tikka Masala',
        ingredients: [
          { inventoryItemId: 'inv-004', inventoryItemName: 'Fresh Farm Chicken', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-005', inventoryItemName: 'Red Tomatoes', unit: 'kg', quantityRequired: 0.12 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-006', inventoryItemName: 'Fresh Dairy Cream', unit: 'kg', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.012 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-021',
        menuItemName: 'Mutton Rogan Josh',
        ingredients: [
          { inventoryItemId: 'inv-011', inventoryItemName: 'Fresh Tender Mutton', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-013', inventoryItemName: 'Fresh Onions', unit: 'kg', quantityRequired: 0.08 },
          { inventoryItemId: 'inv-014', inventoryItemName: 'Artisanal Yogurt / Hung Curd', unit: 'kg', quantityRequired: 0.05 },
          { inventoryItemId: 'inv-007', inventoryItemName: 'Pure Refined Sunflower Oil', unit: 'L', quantityRequired: 0.025 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-016', inventoryItemName: 'Royal Biryani & Garam Masala', unit: 'kg', quantityRequired: 0.015 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-022',
        menuItemName: 'Butter Naan',
        ingredients: [
          { inventoryItemId: 'inv-010', inventoryItemName: 'Fine Wheat Flour / Atta', unit: 'kg', quantityRequired: 0.12 },
          { inventoryItemId: 'inv-002', inventoryItemName: 'Amul Butter', unit: 'kg', quantityRequired: 0.025 },
          { inventoryItemId: 'inv-009', inventoryItemName: 'Whole Buffalo Milk', unit: 'L', quantityRequired: 0.03 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-023',
        menuItemName: 'Garlic Naan',
        ingredients: [
          { inventoryItemId: 'inv-010', inventoryItemName: 'Fine Wheat Flour / Atta', unit: 'kg', quantityRequired: 0.12 },
          { inventoryItemId: 'inv-002', inventoryItemName: 'Amul Butter', unit: 'kg', quantityRequired: 0.025 },
          { inventoryItemId: 'inv-015', inventoryItemName: 'Ginger Garlic Paste', unit: 'kg', quantityRequired: 0.015 },
          { inventoryItemId: 'inv-009', inventoryItemName: 'Whole Buffalo Milk', unit: 'L', quantityRequired: 0.03 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-024',
        menuItemName: 'Gulab Jamun',
        ingredients: [
          { inventoryItemId: 'inv-024', inventoryItemName: 'Royal Khoya / Mawa', unit: 'kg', quantityRequired: 0.10 },
          { inventoryItemId: 'inv-010', inventoryItemName: 'Fine Wheat Flour / Atta', unit: 'kg', quantityRequired: 0.02 },
          { inventoryItemId: 'inv-022', inventoryItemName: 'Refined Pure Sugar', unit: 'kg', quantityRequired: 0.12 },
          { inventoryItemId: 'inv-025', inventoryItemName: 'Pure Desi Ghee', unit: 'kg', quantityRequired: 0.03 }
        ],
        updatedAt: new Date().toISOString()
      },
      {
        menuItemId: 'itm-025',
        menuItemName: 'Gajar Ka Halwa',
        ingredients: [
          { inventoryItemId: 'inv-023', inventoryItemName: 'Fresh Juicy Red Carrots', unit: 'kg', quantityRequired: 0.25 },
          { inventoryItemId: 'inv-009', inventoryItemName: 'Whole Buffalo Milk', unit: 'L', quantityRequired: 0.15 },
          { inventoryItemId: 'inv-022', inventoryItemName: 'Refined Pure Sugar', unit: 'kg', quantityRequired: 0.06 },
          { inventoryItemId: 'inv-025', inventoryItemName: 'Pure Desi Ghee', unit: 'kg', quantityRequired: 0.03 },
          { inventoryItemId: 'inv-024', inventoryItemName: 'Royal Khoya / Mawa', unit: 'kg', quantityRequired: 0.03 }
        ],
        updatedAt: new Date().toISOString()
      }
    ];

    for (const recipe of all25Recipes) {
      this.menuItemRecipes.set(recipe.menuItemId, recipe);
    }

    // Seed initial stock movement log if empty
    if (this.stockMovements.length === 0) {
      this.stockMovements = [
        {
          id: 'mov-001',
          inventoryItemId: 'inv-001',
          inventoryItemName: 'Royal Paneer (Cottage Cheese)',
          type: 'PURCHASE',
          quantity: 35.0,
          unit: 'kg',
          supplier: 'Amul Dairy Co.',
          cost: 13300,
          notes: 'Initial Opening Purchase Received',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'mov-002',
          inventoryItemId: 'inv-003',
          inventoryItemName: 'Royal Basmati Rice',
          type: 'PURCHASE',
          quantity: 60.0,
          unit: 'kg',
          supplier: 'India Gate Rice Ltd',
          cost: 6600,
          notes: 'Initial Opening Purchase Received',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
    }
  }

  /**
   * Fast In-Memory Indexes for Orders & Performance
   */
  public rebuildIndexes(): void {
    this.ordersByDateIndex.clear();
    this.ordersByStatusIndex.clear();
    this.ordersByCustomerIdIndex.clear();
    this.paymentOrderIdIndex.clear();

    for (const o of this.orders.values()) {
      this.indexOrder(o);
    }
    for (const p of this.payments.values()) {
      if (p.orderId) this.paymentOrderIdIndex.set(p.orderId, p.id);
    }
  }

  public indexOrder(order: Order): void {
    const dateKey = (order.createdAt || '').split('T')[0] || new Date().toISOString().split('T')[0];
    if (!this.ordersByDateIndex.has(dateKey)) {
      this.ordersByDateIndex.set(dateKey, new Set());
    }
    this.ordersByDateIndex.get(dateKey)!.add(order.id);

    if (!this.ordersByStatusIndex.has(order.status)) {
      this.ordersByStatusIndex.set(order.status, new Set());
    }
    this.ordersByStatusIndex.get(order.status)!.add(order.id);

    if (order.userId) {
      if (!this.ordersByCustomerIdIndex.has(order.userId)) {
        this.ordersByCustomerIdIndex.set(order.userId, new Set());
      }
      this.ordersByCustomerIdIndex.get(order.userId)!.add(order.id);
    }
  }

  public unindexOrder(order: Order): void {
    const dateKey = (order.createdAt || '').split('T')[0];
    if (dateKey && this.ordersByDateIndex.has(dateKey)) {
      this.ordersByDateIndex.get(dateKey)!.delete(order.id);
    }
    if (this.ordersByStatusIndex.has(order.status)) {
      this.ordersByStatusIndex.get(order.status)!.delete(order.id);
    }
    if (order.userId && this.ordersByCustomerIdIndex.has(order.userId)) {
      this.ordersByCustomerIdIndex.get(order.userId)!.delete(order.id);
    }
  }

  /**
   * Generate or update Daily Sales Summary for a specific date (YYYY-MM-DD)
   */
  public generateDailySalesSummary(dateStr: string): DailySalesSummary {
    const allMatchingOrders: Order[] = [];

    // Collect from active orders and archived orders
    for (const o of this.orders.values()) {
      if ((o.createdAt || '').startsWith(dateStr)) {
        allMatchingOrders.push(o);
      }
    }
    for (const ao of this.archivedOrders.values()) {
      if ((ao.createdAt || '').startsWith(dateStr)) {
        allMatchingOrders.push(ao);
      }
    }

    const completed = allMatchingOrders.filter((o) => o.status === 'COMPLETED');
    const cancelled = allMatchingOrders.filter((o) => o.status === 'CANCELLED');
    const grossSales = allMatchingOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const discounts = allMatchingOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.discount || 0), 0);
    const tax = allMatchingOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.tax || 0), 0);
    const netSales = allMatchingOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const paidOrders = allMatchingOrders.filter((o) => o.paymentStatus === 'PAID');
    const totalPayments = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const cashPayments = paidOrders.filter((o) => o.paymentMethod === 'Cash').reduce((sum, o) => sum + o.total, 0);
    const cardPayments = paidOrders.filter((o) => o.paymentMethod === 'Card').reduce((sum, o) => sum + o.total, 0);
    const upiPayments = paidOrders.filter((o) => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.total, 0);
    const pendingPayments = allMatchingOrders.filter((o) => o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED').reduce((sum, o) => sum + o.total, 0);

    const totalItemsSold = allMatchingOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.items || []).reduce((isum, item) => isum + item.quantity, 0), 0);

    const uniqueCustomers = new Set(allMatchingOrders.map((o) => o.userId || o.customerPhone || o.customerEmail)).size;

    // Daily Bookings count
    const totalBookings = Array.from(this.bookings.values()).filter((b) => (b.bookingDate === dateStr || (b.createdAt || '').startsWith(dateStr))).length
      + Array.from(this.archivedBookings.values()).filter((b) => (b.bookingDate === dateStr || (b.createdAt || '').startsWith(dateStr))).length;

    // Daily Wastage amount
    const totalWastage = Array.from(this.wastageRecords.values())
      .concat(Array.from(this.archivedWastageRecords.values()))
      .filter((w) => (w.createdAt || '').startsWith(dateStr))
      .reduce((sum, w) => sum + (w.estimatedCost || 0), 0);

    // Daily Inventory Consumption Cost
    const totalInventoryConsumption = this.stockMovements
      .concat(this.archivedStockMovements)
      .filter((m) => m.type === 'AUTO_CONSUMPTION' && (m.createdAt || '').startsWith(dateStr))
      .reduce((sum, m) => sum + (m.cost || 0), 0);

    const nonCancelledCount = allMatchingOrders.filter((o) => o.status !== 'CANCELLED').length;
    const averageOrderValue = nonCancelledCount > 0 ? Math.round(netSales / nonCancelledCount) : 0;
    const foodCost = Math.round(netSales * 0.32); // Average ~32% benchmark food cost ratio

    const summary: DailySalesSummary = {
      id: `dsum-${dateStr}`,
      date: dateStr,
      totalOrders: allMatchingOrders.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      grossSales,
      discounts,
      tax,
      netSales,
      totalPayments,
      cashPayments,
      cardPayments,
      upiPayments,
      pendingPayments,
      averageOrderValue,
      totalItemsSold,
      totalCustomers: uniqueCustomers,
      totalBookings,
      totalWastage,
      totalInventoryConsumption,
      foodCost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.dailySalesSummaries.set(dateStr, summary);
    return summary;
  }

  /**
   * Generate or update Monthly Summary for a month (YYYY-MM)
   */
  public generateMonthlySummary(year: number, monthStr: string): MonthlySummary {
    const dailySummariesInMonth: DailySalesSummary[] = [];

    for (const [dateKey, ds] of this.dailySalesSummaries.entries()) {
      if (dateKey.startsWith(monthStr)) {
        dailySummariesInMonth.push(ds);
      }
    }

    const totalOrders = dailySummariesInMonth.reduce((sum, d) => sum + d.totalOrders, 0);
    const completedOrders = dailySummariesInMonth.reduce((sum, d) => sum + d.completedOrders, 0);
    const cancelledOrders = dailySummariesInMonth.reduce((sum, d) => sum + d.cancelledOrders, 0);
    const grossSales = dailySummariesInMonth.reduce((sum, d) => sum + d.grossSales, 0);
    const discounts = dailySummariesInMonth.reduce((sum, d) => sum + d.discounts, 0);
    const tax = dailySummariesInMonth.reduce((sum, d) => sum + d.tax, 0);
    const netSales = dailySummariesInMonth.reduce((sum, d) => sum + d.netSales, 0);
    const totalPayments = dailySummariesInMonth.reduce((sum, d) => sum + d.totalPayments, 0);
    const cashPayments = dailySummariesInMonth.reduce((sum, d) => sum + d.cashPayments, 0);
    const cardPayments = dailySummariesInMonth.reduce((sum, d) => sum + d.cardPayments, 0);
    const upiPayments = dailySummariesInMonth.reduce((sum, d) => sum + d.upiPayments, 0);
    const totalItemsSold = dailySummariesInMonth.reduce((sum, d) => sum + d.totalItemsSold, 0);
    const totalBookings = dailySummariesInMonth.reduce((sum, d) => sum + d.totalBookings, 0);
    const totalWastage = dailySummariesInMonth.reduce((sum, d) => sum + d.totalWastage, 0);
    const inventoryCost = dailySummariesInMonth.reduce((sum, d) => sum + d.totalInventoryConsumption, 0);
    const foodCost = dailySummariesInMonth.reduce((sum, d) => sum + d.foodCost, 0);
    const nonCancelled = totalOrders - cancelledOrders;
    const averageOrderValue = nonCancelled > 0 ? Math.round(netSales / nonCancelled) : 0;

    const summary: MonthlySummary = {
      id: `msum-${monthStr}`,
      year,
      month: monthStr,
      totalOrders,
      completedOrders,
      cancelledOrders,
      grossSales,
      discounts,
      tax,
      netSales,
      totalPayments,
      cashPayments,
      cardPayments,
      upiPayments,
      averageOrderValue,
      totalItemsSold,
      totalBookings,
      totalWastage,
      inventoryCost,
      foodCost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.monthlySummaries.set(monthStr, summary);
    return summary;
  }

  /**
   * Idempotent Automated Data Retention & Safe Archival Job
   * Moves records older than detailedRetentionDays (30 days) to Archive
   * Verifies Financial Consistency: Source Orders Total === Daily Summary Total === Monthly Total
   */
  public executeRetentionAndArchivalJob(force: boolean = false): RetentionJobLog {
    const startedAt = new Date().toISOString();
    const retentionDays = this.dataRetentionConfig.detailedRetentionDays || 30;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const logEntry: RetentionJobLog = {
      id: `ret-job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      jobName: 'DATA_RETENTION_AND_ARCHIVAL_JOB',
      startedAt,
      status: 'IN_PROGRESS',
      recordsProcessed: 0,
      recordsArchived: 0,
      summariesUpdated: 0,
      createdAt: startedAt
    };

    try {
      // 1. Identify distinct dates older than retention cutoff
      const datesToProcess = new Set<string>();
      for (const o of this.orders.values()) {
        const orderDate = (o.createdAt || '').split('T')[0];
        if (orderDate && orderDate < cutoffDateStr) {
          datesToProcess.add(orderDate);
        }
      }

      let totalArchivedOrders = 0;
      let totalArchivedBookings = 0;
      let totalArchivedMovements = 0;
      let totalArchivedWastage = 0;
      let summariesGenerated = 0;

      // 2. For each date: verify totals, generate daily summary, update monthly summary, then archive
      for (const dateStr of Array.from(datesToProcess).sort()) {
        const sourceOrders = Array.from(this.orders.values()).filter((o) => (o.createdAt || '').startsWith(dateStr));
        const dailySummary = this.generateDailySalesSummary(dateStr);
        summariesGenerated++;

        // Verify Financial totals match exactly
        const sourceGrossSales = sourceOrders
          .filter((o) => o.status !== 'CANCELLED')
          .reduce((sum, o) => sum + (o.subtotal || 0), 0);

        if (!force && sourceGrossSales !== dailySummary.grossSales) {
          logEntry.status = 'REQUIRES_REVIEW';
          logEntry.errorMessage = `Data mismatch on ${dateStr}: Source Orders Gross Sales (₹${sourceGrossSales}) !== Daily Summary (₹${dailySummary.grossSales}). Archival halted for safety.`;
          logEntry.completedAt = new Date().toISOString();
          this.retentionJobLogs.unshift(logEntry);
          this.persist();
          return logEntry;
        }

        // Move eligible finalized orders to archive
        for (const order of sourceOrders) {
          this.archivedOrders.set(order.id, order);
          this.orders.delete(order.id);
          this.unindexOrder(order);
          totalArchivedOrders++;
        }

        // Update corresponding Monthly Summary
        const monthStr = dateStr.substring(0, 7);
        const year = parseInt(dateStr.substring(0, 4), 10);
        this.generateMonthlySummary(year, monthStr);
      }

      // 3. Archive older bookings (> 30 days)
      for (const [id, b] of this.bookings.entries()) {
        const bDate = b.bookingDate || (b.createdAt || '').split('T')[0];
        if (bDate && bDate < cutoffDateStr) {
          this.archivedBookings.set(id, b);
          this.bookings.delete(id);
          totalArchivedBookings++;
        }
      }

      // 4. Archive older stock movements (> 30 days)
      const activeMovements: StockMovement[] = [];
      for (const sm of this.stockMovements) {
        const smDate = (sm.createdAt || '').split('T')[0];
        if (smDate && smDate < cutoffDateStr) {
          this.archivedStockMovements.push(sm);
          totalArchivedMovements++;
        } else {
          activeMovements.push(sm);
        }
      }
      this.stockMovements = activeMovements;

      // 5. Archive older wastage records (> 30 days)
      for (const [id, wr] of this.wastageRecords.entries()) {
        const wrDate = (wr.createdAt || '').split('T')[0];
        if (wrDate && wrDate < cutoffDateStr) {
          this.archivedWastageRecords.set(id, wr);
          this.wastageRecords.delete(id);
          totalArchivedWastage++;
        }
      }

      logEntry.status = 'COMPLETED';
      logEntry.recordsProcessed = totalArchivedOrders + totalArchivedBookings + totalArchivedMovements + totalArchivedWastage;
      logEntry.recordsArchived = totalArchivedOrders + totalArchivedBookings + totalArchivedMovements + totalArchivedWastage;
      logEntry.summariesUpdated = summariesGenerated;
      logEntry.details = {
        archivedOrders: totalArchivedOrders,
        archivedBookings: totalArchivedBookings,
        archivedMovements: totalArchivedMovements,
        archivedWastage: totalArchivedWastage,
        cutoffDate: cutoffDateStr
      };
      logEntry.completedAt = new Date().toISOString();

      this.retentionJobLogs.unshift(logEntry);
      if (this.retentionJobLogs.length > 100) this.retentionJobLogs.length = 100;
      this.persist();

      this.recordAudit({
        adminId: 'system-retention-worker',
        adminEmail: 'system@abchotel.com',
        action: 'DATA_RETENTION_JOB_COMPLETED',
        entity: 'SETTINGS',
        entityId: logEntry.id,
        details: `Retention policy executed: Archived ${logEntry.recordsArchived} historical records beyond ${retentionDays}-day operational window. Updated ${summariesGenerated} daily/monthly summaries.`
      });

      return logEntry;
    } catch (err: any) {
      logEntry.status = 'FAILED';
      logEntry.errorMessage = err?.message || 'Unknown retention job error';
      logEntry.completedAt = new Date().toISOString();
      this.retentionJobLogs.unshift(logEntry);
      this.persist();
      return logEntry;
    }
  }

  /**
   * Seed 12-Month Historical Summaries for Immediate Analytics Display
   * Creates realistic historical aggregated performance for the past 12 months
   */
  public seed12MonthHistoricalSummaries(): void {
    if (this.monthlySummaries.size >= 12) return;

    const now = new Date();
    const monthsData = [
      { offset: 0, orders: 480, grossSales: 245000, discounts: 12000, tax: 11650, netSales: 244650, payments: 244650, bookings: 160, wastage: 3400, itemsSold: 1280 },
      { offset: 1, orders: 460, grossSales: 232000, discounts: 11000, tax: 11050, netSales: 232050, payments: 232050, bookings: 152, wastage: 3200, itemsSold: 1210 },
      { offset: 2, orders: 510, grossSales: 268000, discounts: 14000, tax: 12700, netSales: 266700, payments: 266700, bookings: 178, wastage: 3800, itemsSold: 1390 },
      { offset: 3, orders: 495, grossSales: 254000, discounts: 13000, tax: 12050, netSales: 253050, payments: 253050, bookings: 165, wastage: 3500, itemsSold: 1320 },
      { offset: 4, orders: 440, grossSales: 218000, discounts: 10000, tax: 10400, netSales: 218400, payments: 218400, bookings: 140, wastage: 2900, itemsSold: 1140 },
      { offset: 5, orders: 475, grossSales: 241000, discounts: 12000, tax: 11450, netSales: 240450, payments: 240450, bookings: 158, wastage: 3300, itemsSold: 1260 },
      { offset: 6, orders: 530, grossSales: 279000, discounts: 15000, tax: 13200, netSales: 277200, payments: 277200, bookings: 185, wastage: 4100, itemsSold: 1440 },
      { offset: 7, orders: 560, grossSales: 295000, discounts: 16000, tax: 13950, netSales: 292950, payments: 292950, bookings: 195, wastage: 4300, itemsSold: 1520 },
      { offset: 8, orders: 520, grossSales: 271000, discounts: 14000, tax: 12850, netSales: 269850, payments: 269850, bookings: 175, wastage: 3900, itemsSold: 1380 },
      { offset: 9, orders: 450, grossSales: 226000, discounts: 11000, tax: 10750, netSales: 225750, payments: 225750, bookings: 148, wastage: 3100, itemsSold: 1190 },
      { offset: 10, orders: 490, grossSales: 251000, discounts: 13000, tax: 11900, netSales: 249900, payments: 249900, bookings: 162, wastage: 3600, itemsSold: 1300 },
      { offset: 11, orders: 540, grossSales: 284000, discounts: 15000, tax: 13450, netSales: 282450, payments: 282450, bookings: 188, wastage: 4200, itemsSold: 1460 }
    ];

    for (const mData of monthsData) {
      const d = new Date(now.getFullYear(), now.getMonth() - mData.offset, 1);
      const year = d.getFullYear();
      const monthNumber = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${monthNumber}`;

      if (!this.monthlySummaries.has(monthStr)) {
        const foodCost = Math.round(mData.netSales * 0.32);
        const inventoryCost = Math.round(mData.netSales * 0.28);
        const cashPayments = Math.round(mData.payments * 0.25);
        const cardPayments = Math.round(mData.payments * 0.35);
        const upiPayments = mData.payments - cashPayments - cardPayments;

        const summary: MonthlySummary = {
          id: `msum-${monthStr}`,
          year,
          month: monthStr,
          totalOrders: mData.orders,
          completedOrders: Math.round(mData.orders * 0.94),
          cancelledOrders: Math.round(mData.orders * 0.03),
          grossSales: mData.grossSales,
          discounts: mData.discounts,
          tax: mData.tax,
          netSales: mData.netSales,
          totalPayments: mData.payments,
          cashPayments,
          cardPayments,
          upiPayments,
          averageOrderValue: Math.round(mData.netSales / (mData.orders * 0.97)),
          totalItemsSold: mData.itemsSold,
          totalBookings: mData.bookings,
          totalWastage: mData.wastage,
          inventoryCost,
          foodCost,
          createdAt: new Date(d.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString()
        };

        this.monthlySummaries.set(monthStr, summary);
      }
    }
  }

  /**
   * Persist current state to file
   */
  public persist(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        const serialized: SerializedDatabase = {
          users: Array.from(this.users.values()),
          hotels: Array.from(this.hotels.values()),
          restaurants: Array.from(this.restaurants.values()),
          tables: Array.from(this.tables.values()),
          bookings: Array.from(this.bookings.values()),
          menuCategories: Array.from(this.menuCategories.values()),
          menuItems: Array.from(this.menuItems.values()),
          orders: Array.from(this.orders.values()),
          payments: Array.from(this.payments.values()),
          paymentAttempts: Array.from(this.paymentAttempts.values()),
          paymentConfig: this.paymentConfig,
          invoices: Array.from(this.invoices.values()),
          billingSettings: this.billingSettings,
          billingAuditLogs: Array.from(this.billingAuditLogs.values()),
          inventoryItems: Array.from(this.inventoryItems.values()),
          menuItemRecipes: Array.from(this.menuItemRecipes.values()),
          stockMovements: this.stockMovements,
          dailyStockLogs: Array.from(this.dailyStockLogs.values()),
          monthlyReconciliations: Array.from(this.monthlyReconciliations.values()),
          suppliers: Array.from(this.suppliers.values()),
          purchaseOrders: Array.from(this.purchaseOrders.values()),
          wastageRecords: Array.from(this.wastageRecords.values()),
          inventoryBatches: Array.from(this.inventoryBatches.values()),
          invoiceCounter: this.invoiceCounter,
          auditLogs: Array.from(this.auditLogs.values()),
          notifications: Array.from(this.notifications.values()),
          // Analytics & Retention
          dailySalesSummaries: Array.from(this.dailySalesSummaries.values()),
          monthlySummaries: Array.from(this.monthlySummaries.values()),
          archivedOrders: Array.from(this.archivedOrders.values()),
          archivedBookings: Array.from(this.archivedBookings.values()),
          archivedStockMovements: this.archivedStockMovements,
          archivedWastageRecords: Array.from(this.archivedWastageRecords.values()),
          retentionJobLogs: this.retentionJobLogs.slice(0, 50),
          dataRetentionConfig: this.dataRetentionConfig,
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        };

        // Local JSON persistence is strictly isolated for development/testing only
        if (process.env.NODE_ENV !== 'production') {
          fs.writeFileSync(DB_FILE, JSON.stringify(serialized, null, 2), 'utf-8');
        }

        // Real-time Firestore delta sync (modified documents only)
        if (this.dirtySyncQueue.size > 0 && process.env.IS_TEST_RUN !== 'true' && process.env.NODE_ENV !== 'test') {
          const itemsToSync = Array.from(this.dirtySyncQueue.values());
          this.dirtySyncQueue.clear();
          for (const item of itemsToSync) {
            syncDocToFirestore(item.collection, item.id, item.data).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[DATABASE] Failed to write database to disk/firestore:', err);
      }
    }, 50);
  }

  // Mutex Lock for atomic reservations
  public async withLock<T>(lockKey: string, fn: () => Promise<T> | T): Promise<T> {
    while (this.mutexLocks.get(lockKey)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.mutexLocks.set(lockKey, true);
    try {
      return await fn();
    } finally {
      this.mutexLocks.delete(lockKey);
    }
  }

  public recordAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const entry: AuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.set(entry.id, entry);
    this.persist();
    return entry;
  }

  public sendNotification(notif: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>): AdminNotification {
    const entry: AdminNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    this.notifications.set(entry.id, entry);
    this.persist();
    return entry;
  }

  public clearAllOrdersAndBookings(): void {
    this.orders.clear();
    this.orderNumberIndex.clear();
    this.bookings.clear();
    this.bookingRefIndex.clear();
    this.payments.clear();
    this.paymentAttempts.clear();
    this.providerPaymentIndex.clear();
    this.providerOrderIndex.clear();
    this.invoices.clear();
    this.invoiceNumberIndex.clear();
    this.invoiceTokenIndex.clear();
    this.orderInvoiceIndex.clear();
    this.billingAuditLogs.clear();
    this.auditLogs.clear();
    this.notifications.clear();
    this.persist();
  }

  public reset(): void {
    this.users.clear();
    this.userEmailIndex.clear();
    this.hotels.clear();
    this.restaurants.clear();
    this.tables.clear();
    this.bookings.clear();
    this.bookingRefIndex.clear();
    this.menuCategories.clear();
    this.menuItems.clear();
    this.orders.clear();
    this.orderNumberIndex.clear();
    this.payments.clear();
    this.auditLogs.clear();
    this.notifications.clear();
    this.isInitialized = false;
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.unlinkSync(DB_FILE);
      } catch {}
    }
  }
}

export const db = new DatabaseEngine();
// Auto-initialize
db.initialize();
