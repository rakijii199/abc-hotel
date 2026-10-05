/**
 * Domain Models and Types for ABC Hotel Client
 */

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'STAFF' | 'KITCHEN' | 'MANAGER' | 'DELIVERY';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED' | 'SUSPENDED';

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  username?: string;
  email: string;
  phone: string;
  normalizedPhone?: string;
  firebaseUid?: string;
  authProvider?: 'PHONE' | 'EMAIL';
  role: UserRole;
  status: UserStatus;
  restaurantId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
}

export interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  removedEmployees: number;
  kitchenCount: number;
  deliveryCount: number;
  staffCount: number;
  managerCount: number;
}

export type TableLocation = 'Window View' | 'Center Terrace' | 'Private Booth' | 'Garden Side' | 'VIP Section';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'UNAVAILABLE';

export interface DiningTable {
  id: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
  location: TableLocation;
  status: TableStatus;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export interface TableBooking {
  id: string;
  bookingReference: string;
  userId: string;
  restaurantId: string;
  tableId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  status: BookingStatus;
  specialRequest?: string;
  tableNumber?: string;
  tableName?: string;
  user?: SafeUser;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export type SpiceLevel = 'None' | 'Mild' | 'Medium' | 'Hot' | 'Extra Hot';

export interface MenuItem {
  id: string;
  sku?: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  vegetarian: boolean;
  type?: 'VEGETARIAN' | 'NON_VEGETARIAN';
  spicy: boolean;
  spiceLevel: SpiceLevel;
  prepTimeMinutes: number;
  calories?: number;
  available: boolean;
  isActive?: boolean;
  isChefSpecial?: boolean;
  allergens?: string[];
  createdAt: string;
  updatedAt: string;
}

export type OrderType = 'Dine-in' | 'Takeaway' | 'Room Service' | 'Delivery';
export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_ACCEPTED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'SERVED'
  | 'CUSTOMER_DONE'
  | 'BILLING_PENDING'
  | 'BILL_GENERATED'
  | 'PAYMENT_PENDING'
  | 'WAITING_FOR_PAYMENT'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED';
export type CustomerStatus = 'ORDERED' | 'DINING' | 'DONE';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_PAID';
export type PaymentGatewayStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';
export type PaymentMethod = 'UPI' | 'Card' | 'Cash' | 'Pay at Exit' | 'PAY_AT_EXIT';

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
  isAddon?: boolean;
  addedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  restaurantId: string;
  orderType: OrderType;
  tableNumber?: string;
  bookingReference?: string;
  roomNumber?: string;
  deliveryAddress?: string;
  deliveryRiderId?: string;
  deliveryRiderName?: string;
  deliveryRiderPhone?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  subtotal: number;
  tax: number;
  discount: number;
  discountCode?: string;
  serviceCharge: number;
  total: number;
  status: OrderStatus;
  customerStatus?: CustomerStatus;
  billingRequestedAt?: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'VOID';
export type InvoicePrintFormat = 'A4' | '80mm' | '58mm';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  menuItemId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  discountSnapshot: number;
  taxSnapshot: number;
  lineTotal: number;
  specialInstructions?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g., INV-2026-000125
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  tableId?: string;
  tableNumber?: string;
  orderType: OrderType;

  // Snapshots & Calculations
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  taxableAmount: number;
  gstPercent: number;
  tax: number; // GST Amount
  serviceFeePercent: number;
  serviceCharge: number;
  otherCharges: number;
  grandTotal: number;

  // Status & Payment
  invoiceStatus: InvoiceStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  amountPaid: number;
  balanceDue: number;

  // Public & Security
  publicToken: string; // High-entropy token for secure customer invoice link

  // Hotel Legal Metadata Snapshots
  hotelNameSnapshot: string;
  hotelLogoSnapshot?: string;
  hotelAddressSnapshot: string;
  hotelPhoneSnapshot: string;
  hotelEmailSnapshot: string;
  hotelGstinSnapshot?: string;
  hotelFssaiSnapshot?: string;
  invoiceFooterSnapshot?: string;
  termsSnapshot?: string;

  createdBy: string;
  receivedBy?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
}

export interface BillingSettings {
  id: string;
  hotelName: string;
  hotelLogoUrl: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  fssaiNumber: string;
  invoicePrefix: string;
  gstPercent: number;
  serviceFeePercent: number;
  defaultPrintFormat: InvoicePrintFormat;
  invoiceFooter: string;
  termsAndConditions: string;
  updatedAt: string;
}

export interface BillingAuditLog {
  id: string;
  invoiceId?: string;
  orderId: string;
  action:
    | 'BILL_REQUESTED'
    | 'BILL_GENERATED'
    | 'INVOICE_CREATED'
    | 'PAYMENT_INITIATED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_FAILED'
    | 'BILL_PRINTED'
    | 'INVOICE_SHARED'
    | 'BILL_CANCELLED'
    | 'BILL_REFUNDED';
  userId: string;
  userName?: string;
  userRole: string;
  details: string;
  reference?: string;
  timestamp: string;
}

export interface PaymentAttempt {
  id: string;
  orderId: string;
  orderDraftId?: string;
  customerId?: string;
  paymentId?: string;
  providerOrderId: string;
  providerPaymentId?: string;
  paymentReference: string;
  amount: number;
  currency: string;
  method: string;
  provider: string;
  status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  qrCodeUrl?: string;
  upiIntentUrl?: string;
  upiId?: string;
  failureReason?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentConfiguration {
  id: string;
  hotelName: string;
  hotelUpiId: string;
  hotelMobileNumber: string;
  hotelQrCodeUrl: string;
  paymentProvider: 'razorpay' | 'custom_upi';
  paymentEnvironment: 'test' | 'production';
  paymentInstructions: string;
  supportContactNumber: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string; // 'razorpay' | 'offline'
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  transactionId: string;
  status: PaymentGatewayStatus;
  failureCode?: string;
  failureMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entity: 'BOOKING' | 'ORDER' | 'MENU_ITEM' | 'CATEGORY' | 'TABLE' | 'USER' | 'SETTINGS';
  entityId: string;
  oldValue?: any;
  newValue?: any;
  details?: string;
  timestamp: string;
}

export interface AdminNotification {
  id: string;
  type: 'NEW_BOOKING' | 'NEW_ORDER' | 'BOOKING_CANCELLED' | 'ORDER_CANCELLED' | 'LOW_MENU_AVAILABILITY' | 'PAYMENT_REQUEST';
  title: string;
  message: string;
  entityId: string;
  entityType: 'booking' | 'order' | 'menu';
  read: boolean;
  createdAt: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

// --- Inventory & Stock Management Domain Types ---
export type InventoryCategory =
  | 'Dairy'
  | 'Spices'
  | 'Grains & Rice'
  | 'Meat & Poultry'
  | 'Vegetables'
  | 'Beverages'
  | 'Oils & Fats'
  | 'Pantry'
  | 'Bakery & Flour'
  | 'Other';

export type InventoryUnit = 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'packets' | 'boxes';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  subcategory?: string;
  sku?: string;
  currentStock: number;
  unit: InventoryUnit;
  minThreshold: number; // Keep for fallback compatibility
  minimumStock?: number;
  reorderLevel?: number;
  maximumStock?: number;
  unitCost: number; // Cost in INR per unit (fallback)
  purchasePrice?: number;
  averageCost?: number;
  supplier?: string;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  storageLocation?: string;
  shelfLife?: string; // e.g. "7 Days"
  expiryTrackingEnabled?: boolean;
  batchTrackingEnabled?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  openingStock?: number;
  totalPurchased?: number;
  totalConsumed?: number;
  totalWasted?: number;
  monthlyPurchased?: number;
  monthlyConsumed?: number;
  monthlyWasted?: number;
  lastRestockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  gstNumber?: string;
  paymentTerms?: string; // e.g. "Net 30"
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: InventoryUnit;
  purchaseRate: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  notes?: string;
  createdBy: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface WastageRecord {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: InventoryUnit;
  reason: 'Spoiled' | 'Expired' | 'Damaged' | 'Overproduction' | 'Cooking Loss' | 'Spillage' | 'Wrong Preparation' | 'Other';
  estimatedCost: number;
  batchNumber?: string;
  expiryDate?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  recordedBy: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface InventoryBatch {
  id: string;
  inventoryItemId: string;
  batchNumber: string;
  receivedDate: string;
  expiryDate: string;
  originalQuantity: number;
  currentQuantity: number;
  unit: InventoryUnit;
  supplier?: string;
  poNumber?: string;
}

export interface MenuItemRecipeItem {
  inventoryItemId: string;
  inventoryItemName?: string;
  unit?: string;
  quantityRequired: number; // e.g. 0.20 kg for Paneer Butter Masala
}

export interface MenuItemRecipe {
  menuItemId: string;
  menuItemName?: string;
  ingredients: MenuItemRecipeItem[];
  updatedAt: string;
}

export type StockMovementType = 'PURCHASE' | 'ADD_ON_STOCK' | 'AUTO_CONSUMPTION' | 'MANUAL_ADJUSTMENT' | 'WASTAGE';

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  type: StockMovementType;
  quantity: number; // + for additions, - for deductions
  unit: InventoryUnit;
  orderId?: string;
  orderNumber?: string;
  supplier?: string;
  cost?: number;
  reason?: string; // e.g. "Weekend Surge", "Banquet Event", "Mid-Month Extra Stock", "Safety Buffer"
  month?: string; // YYYY-MM
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface InventoryStats {
  totalItems: number;
  totalValuation: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  recentMovementsCount: number;
  suppliersCount: number;
  pendingPOsCount: number;
}

export interface DailyStockLog {
  id: string;
  date: string; // YYYY-MM-DD
  inventoryItemId: string;
  inventoryItemName: string;
  unit: InventoryUnit;
  openingStock: number;
  autoConsumed: number;
  replenished: number;
  expectedStock: number;
  physicalStock?: number; // Submitted by staff/kitchen daily
  variance?: number; // expected - physical
  status: 'PENDING' | 'RECONCILED';
  notes?: string;
  reconciledAt?: string;
  reconciledBy?: string;
}

export interface MonthlyItemBreakdown {
  itemId: string;
  itemName: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  unitCost: number;
  openingStock: number;
  basePurchasesQty: number;
  basePurchasesCost: number;
  addOnStockQty: number;
  addOnStockCost: number;
  consumedQty: number;
  consumedCost: number;
  wastageQty: number;
  wastageCost: number;
  closingStock: number;
  closingValuation: number;
  addOnOrdersCount: number;
}

export interface MonthlyReconciliation {
  id: string;
  month: string; // YYYY-MM
  totalOpeningValuation: number;
  totalPurchases: number;
  totalAddOnStock?: number;
  totalAddOnStockQty?: number;
  totalConsumption: number;
  totalWastage: number;
  totalClosingValuation: number;
  itemsBreakdown?: MonthlyItemBreakdown[];
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  closedBy?: string;
}

export interface DailySalesSummary {
  id: string;
  date: string; // YYYY-MM-DD
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossSales: number;
  discounts: number;
  tax: number;
  netSales: number;
  totalPayments: number;
  cashPayments: number;
  cardPayments: number;
  upiPayments: number;
  pendingPayments: number;
  averageOrderValue: number;
  totalItemsSold: number;
  totalCustomers: number;
  totalBookings: number;
  totalWastage: number;
  totalInventoryConsumption: number;
  foodCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySummary {
  id: string;
  year: number;
  month: string; // YYYY-MM
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossSales: number;
  discounts: number;
  tax: number;
  netSales: number;
  totalPayments: number;
  cashPayments: number;
  cardPayments: number;
  upiPayments: number;
  averageOrderValue: number;
  totalItemsSold: number;
  totalBookings: number;
  totalWastage: number;
  inventoryCost: number;
  foodCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionJobLog {
  id: string;
  jobName: string;
  startedAt: string;
  completedAt?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REQUIRES_REVIEW';
  recordsProcessed: number;
  recordsArchived: number;
  summariesUpdated: number;
  errorMessage?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface DataRetentionConfig {
  detailedRetentionDays: number; // default 30 days
  dashboardAggregateRetentionMonths: number; // default 12 months
  autoArchiveEnabled: boolean;
  autoArchiveHourUTC: number; // e.g. 2 (2:00 AM)
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export type DashboardTimeFilter =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'LAST_3_MONTHS'
  | 'LAST_6_MONTHS'
  | 'LAST_12_MONTHS'
  | 'CUSTOM';

export interface DashboardAggregateResponse {
  filter: DashboardTimeFilter;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  dataTierNotice: string;
  kpi: {
    totalOrders: number;
    completedOrders: number;
    successfulOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    grossSales: number;
    discounts: number;
    tax: number;
    netSales: number;
    totalAmount: number;
    totalPayments: number;
    averageOrderValue: number;
    onlineOrdersCount: number;
    onlineOrdersAmount: number;
    offlineOrdersCount: number;
    offlineOrdersAmount: number;
    foodCost: number;
    inventoryConsumption: number;
    rawMaterialsAmount: number;
    wastage: number;
    wastageAmount: number;
    profit: number;
    profitMargin: number;
    totalBookings: number;
  };
  inventoryStats?: {
    totalRawMaterialsAmount: number;
    totalWastageAmount: number;
    totalProfit: number;
    averageProfitMargin: number;
    daily: Array<{
      date: string;
      label: string;
      totalSales: number;
      rawMaterialsAmount: number;
      wastageAmount: number;
      profit: number;
      profitMargin: number;
      ordersCount: number;
      successfulOrders: number;
      cancelledOrders: number;
    }>;
    monthly: Array<{
      month: string;
      label: string;
      totalSales: number;
      rawMaterialsAmount: number;
      wastageAmount: number;
      profit: number;
      profitMargin: number;
      ordersCount: number;
      successfulOrders: number;
      cancelledOrders: number;
      onlineOrdersCount: number;
      onlineOrdersAmount: number;
      offlineOrdersCount: number;
      offlineOrdersAmount: number;
    }>;
  };
  monthlySalesTrend: Array<{
    month: string;
    grossSales: number;
    netSales: number;
    orders: number;
    foodCost: number;
    payments: number;
  }>;
  dailySalesTrend: Array<{
    date: string;
    sales: number;
    orders: number;
  }>;
  paymentMethodDistribution: Array<{
    method: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  topSellingDishes: Array<{
    id: string;
    name: string;
    categoryName: string;
    quantity: number;
    revenue: number;
  }>;
  inventoryConsumptionTrend: Array<{
    date: string;
    consumptionCost: number;
    wastageCost: number;
  }>;
  wastageTrend: Array<{
    date: string;
    amount: number;
    itemsCount: number;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
