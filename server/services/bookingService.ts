/**
 * Table Booking Service & Availability Engine
 * Prevents double-bookings with atomic mutex locks and alerts staff
 */
import { config } from '../config/index.ts';
import { db } from '../database/db.ts';
import { BookingRepository } from '../repositories/bookingRepository.ts';
import { RestaurantRepository, TableRepository } from '../repositories/tableRepository.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { NotificationRepository } from '../repositories/notificationRepository.ts';
import { DiningTable, TableBooking } from '../types/index.ts';

export class BookingService {
  /**
   * Calculate end time given start time and duration (default 30 mins)
   */
  public static calculateEndTime(startTime: string, durationMinutes = 30): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  /**
   * Check if booking date exceeds 1 month (30 days) in advance
   */
  public static isBeyondOneMonth(dateStr: string): boolean {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const maxDateStr = d.toISOString().split('T')[0];
    return dateStr > maxDateStr;
  }

  /**
   * Check if a time falls within operating hours
   */
  public static isWithinOperatingHours(startTime: string, endTime: string): boolean {
    const [startH] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    // Restaurant opens at 09:00 and closes at 23:00
    if (startH < config.hotel.openingHour) return false;
    if (startH >= config.hotel.closingHour) return false;
    if (endH > config.hotel.closingHour || (endH === config.hotel.closingHour && endM > 0)) {
      return false;
    }
    return true;
  }

  /**
   * Check if booking date/time is in the past
   */
  public static isPastDateTime(dateStr: string, timeStr: string): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;

    // Date is today - check time slot against current hour/minute
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const [slotH, slotM] = timeStr.split(':').map(Number);

    if (slotH < currentHours) return true;
    if (slotH === currentHours && slotM <= currentMinutes) return true;
    return false;
  }

  /**
   * Get table availability list for a given date, time, and guest count
   */
  public static async getTableAvailability(params: {
    bookingDate: string;
    startTime: string;
    guestCount: number;
  }): Promise<{
    tables: Array<DiningTable & { isAvailable: boolean; reason?: string }>;
    operatingHours: { open: string; close: string };
  }> {
    const restaurant = RestaurantRepository.getRestaurant();
    const tables = await TableRepository.getAll();
    const endTime = this.calculateEndTime(params.startTime, config.hotel.slotDurationMinutes);
    const withinHours = this.isWithinOperatingHours(params.startTime, endTime);
    const isPast = this.isPastDateTime(params.bookingDate, params.startTime);

    const result = await Promise.all(
      tables.map(async (tbl) => {
        let isAvailable = true;
        let reason: string | undefined;

        if (!withinHours) {
          isAvailable = false;
          reason = `Outside operating hours (${restaurant?.openingTime || '09:00'} - ${restaurant?.closingTime || '23:00'})`;
        } else if (this.isBeyondOneMonth(params.bookingDate)) {
          isAvailable = false;
          reason = 'Date exceeds 1-month advance booking window';
        } else if (isPast) {
          isAvailable = false;
          reason = 'Cannot select past date or time slot';
        } else if (params.guestCount > tbl.capacity) {
          isAvailable = false;
          reason = `Table capacity (${tbl.capacity}) is less than guests (${params.guestCount})`;
        } else if (tbl.status === 'MAINTENANCE' || tbl.status === 'UNAVAILABLE') {
          isAvailable = false;
          reason = `Table is in ${tbl.status.toLowerCase()}`;
        } else if (tbl.status === 'OCCUPIED') {
          isAvailable = false;
          reason = 'Table is currently occupied';
        } else if (tbl.status === 'RESERVED') {
          isAvailable = false;
          reason = 'Table is reserved by staff';
        } else if (await BookingRepository.hasOverlap(tbl.id, params.bookingDate, params.startTime, endTime)) {
          isAvailable = false;
          reason = 'Table is already booked for this time slot';
        }

        return {
          ...tbl,
          isAvailable,
          reason
        };
      })
    );

    return {
      tables: result,
      operatingHours: {
        open: restaurant?.openingTime || '09:00',
        close: restaurant?.closingTime || '23:00'
      }
    };
  }

  /**
   * Create Table Booking with Atomic Mutex Lock to prevent double bookings
   */
  public static async createBooking(params: {
    userId: string;
    tableId: string;
    bookingDate: string;
    startTime: string;
    guestCount: number;
    specialRequest?: string;
  }): Promise<TableBooking> {
    const lockKey = `booking-lock-${params.tableId}-${params.bookingDate}`;

    return await db.withLock(lockKey, async () => {
      // 1. Verify User
      const user = await UserRepository.findById(params.userId);
      if (!user) {
        throw new Error('User account not found.');
      }

      // 2. Verify Table
      const table = await TableRepository.getById(params.tableId);
      if (!table) {
        throw new Error('Selected table does not exist.');
      }

      if (table.status === 'MAINTENANCE' || table.status === 'UNAVAILABLE') {
        throw new Error(`The selected table is currently ${table.status.toLowerCase()}.`);
      }

      // 3. Verify Capacity
      if (params.guestCount > table.capacity) {
        throw new Error(`The selected table only accommodates up to ${table.capacity} guests.`);
      }

      // 4. Time Calculations
      const endTime = this.calculateEndTime(params.startTime, config.hotel.slotDurationMinutes);

      // 5. Verify Operating Hours
      if (!this.isWithinOperatingHours(params.startTime, endTime)) {
        throw new Error(
          `Bookings must be between ${config.hotel.openingHour}:00 and ${config.hotel.closingHour}:00.`
        );
      }

      // 6. Verify Date is within 1 month and not in past
      if (this.isBeyondOneMonth(params.bookingDate)) {
        throw new Error('Table bookings can only be scheduled up to 1 month (30 days) in advance.');
      }

      if (this.isPastDateTime(params.bookingDate, params.startTime)) {
        throw new Error('Cannot create a booking for a past date or time.');
      }

      // 7. Prevent Double Booking / Overlap Check
      const hasOverlap = await BookingRepository.hasOverlap(
        params.tableId,
        params.bookingDate,
        params.startTime,
        endTime
      );

      if (hasOverlap) {
        throw new Error('That table is no longer available for the selected time slot. Please select another table.');
      }

      // 8. Generate Unique Booking Reference
      const cleanDate = params.bookingDate.replace(/-/g, '');
      const randomSeq = Math.floor(10000 + Math.random() * 90000);
      const bookingReference = `BK-${cleanDate}-${randomSeq}`;

      const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const restaurant = RestaurantRepository.getRestaurant();

      const newBooking: TableBooking = {
        id: bookingId,
        bookingReference,
        userId: params.userId,
        restaurantId: restaurant?.id || 'rst-abc-001',
        tableId: params.tableId,
        bookingDate: params.bookingDate,
        startTime: params.startTime,
        endTime,
        guestCount: params.guestCount,
        status: 'PENDING',
        specialRequest: params.specialRequest?.trim(),
        tableNumber: table.tableNumber,
        tableName: `${table.tableNumber} (${table.location}, ${table.capacity} Seats)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await BookingRepository.create(newBooking);

      // Send real-time notification to staff
      NotificationRepository.create({
        type: 'NEW_BOOKING',
        title: `New Table Booking ${bookingReference}`,
        message: `${user.firstName} ${user.lastName} requested ${table.tableNumber} for ${params.guestCount} guests at ${params.startTime} (${params.bookingDate}).`,
        entityId: newBooking.id,
        entityType: 'booking'
      });

      return newBooking;
    });
  }

  /**
   * Cancel booking
   */
  public static async cancelBooking(bookingId: string, userId: string, isAdmin = false): Promise<TableBooking> {
    const booking = await BookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Booking not found.');
    }

    if (!isAdmin && booking.userId !== userId) {
      throw new Error('Unauthorized to cancel this booking.');
    }

    if (booking.status === 'COMPLETED' || booking.status === 'SEATED') {
      throw new Error(`Cannot cancel a booking that is already ${booking.status.toLowerCase()}.`);
    }

    if (booking.status === 'CANCELLED') {
      return booking;
    }

    const updated = await BookingRepository.updateStatus(bookingId, 'CANCELLED');
    if (!updated) {
      throw new Error('Failed to cancel booking.');
    }

    NotificationRepository.create({
      type: 'BOOKING_CANCELLED',
      title: `Booking Cancelled ${booking.bookingReference}`,
      message: `Reservation ${booking.bookingReference} for ${booking.tableNumber || 'Table'} was cancelled.`,
      entityId: booking.id,
      entityType: 'booking'
    });

    return updated;
  }

  /**
   * Get user bookings
   */
  public static async getUserBookings(userId: string): Promise<TableBooking[]> {
    const bookings = await BookingRepository.getByUserId(userId);
    return Promise.all(
      bookings.map(async (b) => {
        const table = await TableRepository.getById(b.tableId);
        return {
          ...b,
          tableNumber: table?.tableNumber || b.tableNumber,
          tableName: table ? `${table.tableNumber} (${table.location})` : b.tableNumber
        };
      })
    );
  }

  /**
   * Get single booking by ID or Reference
   */
  public static async getBooking(identifier: string, userId?: string, isAdmin = false): Promise<TableBooking> {
    const booking = identifier.startsWith('BK-')
      ? await BookingRepository.getByReference(identifier)
      : await BookingRepository.getById(identifier);

    if (!booking) {
      throw new Error('Booking not found.');
    }

    if (!isAdmin && booking.userId) {
      if (!userId || booking.userId !== userId) {
        throw new Error('Unauthorized access to booking details.');
      }
    }

    const table = await TableRepository.getById(booking.tableId);
    const user = booking.userId ? await UserRepository.findById(booking.userId) : null;

    return {
      ...booking,
      tableNumber: table?.tableNumber || booking.tableNumber,
      tableName: table ? `${table.tableNumber} (${table.location}, ${table.capacity} Seats)` : booking.tableNumber,
      user: user ? UserRepository.toSafeUser(user) : undefined
    };
  }
}
