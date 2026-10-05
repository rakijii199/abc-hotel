/**
 * Request Validation Schemas using Zod
 */
import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(1, 'Last name must be at least 1 character').max(50),
  email: z.string().email('Please enter a valid email address').toLowerCase(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export const loginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1, 'Password is required')
}).refine((data) => !!(data.email || data.username), {
  message: 'Username or email address is required',
  path: ['email']
});

export const registerCustomerPhoneSchema = z.object({
  idToken: z.string().min(10, 'Firebase ID token is required for authentication'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().max(25).optional(),
  firebaseUid: z.string().max(128).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  countryCode: z.string().max(10).optional()
});

export const loginCustomerPhoneSchema = z.object({
  idToken: z.string().min(10, 'Firebase ID token is required for authentication'),
  phone: z.string().max(25).optional(),
  firebaseUid: z.string().max(128).optional()
});

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, periods, underscores, and dashes')
    .transform((val) => val.toLowerCase().trim()),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  phone: z
    .string()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(16, 'Mobile number is too long')
    .regex(/^(\+?\d{1,4}[-\s]?)?\(?\d{3,5}\)?[-\s]?\d{3,5}[-\s]?\d{3,5}$/, 'Please enter a valid mobile number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm password'),
  role: z.enum(['STAFF', 'KITCHEN', 'DELIVERY', 'MANAGER'], {
    message: 'Role must be one of: STAFF, KITCHEN, DELIVERY, MANAGER'
  }),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name must not be empty').max(50).optional(),
  lastName: z.string().min(1, 'Last name must not be empty').max(50).optional(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim().optional(),
  phone: z
    .string()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(16, 'Mobile number is too long')
    .regex(/^(\+?\d{1,4}[-\s]?)?\(?\d{3,5}\)?[-\s]?\d{3,5}[-\s]?\d{3,5}$/, 'Please enter a valid mobile number')
    .optional(),
  role: z.enum(['STAFF', 'KITCHEN', 'DELIVERY', 'MANAGER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'REMOVED']).optional()
});

export const resetEmployeePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmNewPassword: z.string().min(1, 'Please confirm new password')
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ['confirmNewPassword']
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50).optional(),
  lastName: z.string().min(1, 'Last name must be at least 1 character').max(50).optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15).optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ['confirmNewPassword']
});

export const createBookingSchema = z.object({
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:mm 24-hour format'),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').max(20, 'For parties larger than 20, please contact concierge'),
  tableId: z.string().min(1, 'Table selection is required'),
  specialRequest: z.string().max(300).optional()
});

export const createOrderSchema = z.object({
  orderType: z.enum(['Dine-in', 'Takeaway', 'Room Service', 'Delivery']),
  tableNumber: z.string().optional(),
  bookingReference: z.string().optional(),
  roomNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
  customerName: z.string().optional().default('Walk-in Guest'),
  customerPhone: z.string().optional().default('—'),
  customerEmail: z.string().email('Valid email is required'),
  paymentMethod: z.enum(['UPI', 'Card', 'Cash', 'Pay at Exit', 'PAY_AT_EXIT']),
  discountCode: z.string().optional(),
  notes: z.string().max(250).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1, 'Menu item ID is required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20),
      specialInstructions: z.string().max(100).optional()
    })
  ).min(1, 'Order must contain at least one item')
}).refine((data) => {
  if (data.orderType === 'Dine-in' && !data.tableNumber && !data.bookingReference) {
    return false;
  }
  if (data.orderType === 'Room Service' && !data.roomNumber) {
    return false;
  }
  if (data.orderType === 'Delivery' && !data.deliveryAddress) {
    return false;
  }
  return true;
}, {
  message: 'Please provide table number/booking reference for Dine-in, room number for Room Service, or address for Delivery',
  path: ['orderType']
});

export const createStaffOrderSchema = z.object({
  orderType: z.enum(['Dine-in', 'Takeaway', 'Room Service', 'Delivery']),
  tableNumber: z.string().optional(),
  bookingReference: z.string().optional(),
  roomNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
  customerName: z.string().optional().default('Walk-in Guest'),
  customerPhone: z.string().optional().default('—'),
  customerEmail: z.string().email('Valid email is required').optional(),
  paymentMethod: z.enum(['UPI', 'Card', 'Cash', 'Pay at Exit', 'PAY_AT_EXIT']).default('Cash'),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).default('PAID'),
  initialStatus: z.enum(['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SERVED', 'WAITING_FOR_PAYMENT', 'COMPLETED', 'CANCELLED']).default('CONFIRMED'),
  discountCode: z.string().optional(),
  notes: z.string().max(250).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1, 'Menu item ID is required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50),
      specialInstructions: z.string().max(150).optional()
    })
  ).min(1, 'Order must contain at least one item')
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SERVED', 'WAITING_FOR_PAYMENT', 'COMPLETED', 'CANCELLED']),
  deliveryRiderId: z.string().optional(),
  deliveryRiderName: z.string().optional(),
  deliveryRiderPhone: z.string().optional()
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'REJECTED'])
});

export const createMenuItemSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().min(5, 'Description is required').max(500),
  price: z.number().positive('Price must be greater than 0'),
  imageUrl: z.string().refine(
    (val) => val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/') || val.startsWith('/'),
    'Must be a valid image URL or uploaded image'
  ),
  vegetarian: z.boolean(),
  spicy: z.boolean(),
  spiceLevel: z.enum(['None', 'Mild', 'Medium', 'Hot', 'Extra Hot']),
  prepTimeMinutes: z.number().int().min(1).max(120),
  calories: z.number().int().positive().optional(),
  available: z.boolean().default(true),
  isChefSpecial: z.boolean().default(false),
  allergens: z.array(z.string()).optional()
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(50),
  description: z.string().max(200).optional().default(''),
  icon: z.string().optional(),
  displayOrder: z.number().int().default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

export const updateCategorySchema = createCategorySchema.partial();

export const createTableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required').max(20),
  capacity: z.number().int().min(1).max(20),
  location: z.enum(['Window View', 'Center Terrace', 'Private Booth', 'Garden Side', 'VIP Section']),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'UNAVAILABLE']).default('AVAILABLE')
});

export const updateTableSchema = createTableSchema.partial();
