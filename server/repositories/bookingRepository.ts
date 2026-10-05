/**
 * Table Booking Repository with Strict State Transitions
 * Authoritative Firestore persistence with local memory cache fallback.
 */
import { db } from '../database/db.ts';
import { TableBooking, BookingStatus } from '../types/index.ts';
import {
  getDocFromFirestore,
  loadCollectionFromFirestore,
  queryFirestore,
  saveDocToFirestore,
  deleteDocFromFirestore
} from '../database/firestoreSync.ts';

const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'COMPLETED', 'CANCELLED'],
  SEATED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: []
};

export class BookingRepository {
  public static async getAll(): Promise<TableBooking[]> {
    const fsBookings = await loadCollectionFromFirestore<TableBooking>('bookings');
    if (fsBookings && fsBookings.length > 0) {
      for (const b of fsBookings) {
        db.bookings.set(b.id, b);
        if (b.bookingReference) db.bookingRefIndex.set(b.bookingReference.toUpperCase(), b.id);
      }
      return fsBookings.sort(
        (a, b) => new Date(`${b.bookingDate}T${b.startTime}`).getTime() - new Date(`${a.bookingDate}T${a.startTime}`).getTime()
      );
    }
    return Array.from(db.bookings.values()).sort(
      (a, b) => new Date(`${b.bookingDate}T${b.startTime}`).getTime() - new Date(`${a.bookingDate}T${a.startTime}`).getTime()
    );
  }

  public static getAllSync(): TableBooking[] {
    return Array.from(db.bookings.values()).sort(
      (a, b) => new Date(`${b.bookingDate}T${b.startTime}`).getTime() - new Date(`${a.bookingDate}T${a.startTime}`).getTime()
    );
  }

  public static async getById(id: string): Promise<TableBooking | null> {
    if (!id) return null;
    const fsBooking = await getDocFromFirestore<TableBooking>('bookings', id);
    if (fsBooking) {
      db.bookings.set(fsBooking.id, fsBooking);
      if (fsBooking.bookingReference) db.bookingRefIndex.set(fsBooking.bookingReference.toUpperCase(), fsBooking.id);
      return fsBooking;
    }
    return db.bookings.get(id) || null;
  }

  public static getByIdSync(id: string): TableBooking | null {
    return db.bookings.get(id) || null;
  }

  public static async getByReference(reference: string): Promise<TableBooking | null> {
    if (!reference) return null;
    const clean = reference.toUpperCase().trim();
    const fsBookings = await queryFirestore<TableBooking>('bookings', 'bookingReference', '==', clean);
    if (fsBookings && fsBookings.length > 0) {
      const b = fsBookings[0];
      db.bookings.set(b.id, b);
      db.bookingRefIndex.set(clean, b.id);
      return b;
    }
    const id = db.bookingRefIndex.get(clean);
    if (id) return db.bookings.get(id) || null;
    return null;
  }

  public static async getByUserId(userId: string): Promise<TableBooking[]> {
    if (!userId) return [];
    const fsBookings = await queryFirestore<TableBooking>('bookings', 'userId', '==', userId);
    if (fsBookings && fsBookings.length > 0) {
      for (const b of fsBookings) {
        db.bookings.set(b.id, b);
      }
      return fsBookings.sort(
        (a, b) => new Date(`${b.bookingDate}T${b.startTime}`).getTime() - new Date(`${a.bookingDate}T${a.startTime}`).getTime()
      );
    }
    return Array.from(db.bookings.values())
      .filter((b) => b.userId === userId)
      .sort((a, b) => new Date(`${b.bookingDate}T${b.startTime}`).getTime() - new Date(`${a.bookingDate}T${a.startTime}`).getTime());
  }

  public static async getActiveBookingsForTableOnDate(tableId: string, bookingDate: string): Promise<TableBooking[]> {
    const all = await this.getAll();
    return all.filter(
      (b) => b.tableId === tableId && b.bookingDate === bookingDate && (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'SEATED')
    );
  }

  public static async hasOverlap(
    tableId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const existing = await this.getActiveBookingsForTableOnDate(tableId, bookingDate);
    return existing.some((b) => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      const noOverlap = endTime <= b.startTime || startTime >= b.endTime;
      return !noOverlap;
    });
  }

  public static async create(booking: TableBooking): Promise<TableBooking> {
    db.bookings.set(booking.id, booking);
    db.bookingRefIndex.set(booking.bookingReference.toUpperCase(), booking.id);
    await saveDocToFirestore('bookings', booking.id, booking);
    db.persist();
    return booking;
  }

  public static async updateStatus(id: string, status: BookingStatus): Promise<TableBooking | null> {
    const booking = await this.getById(id);
    if (!booking) return null;

    if (booking.status !== status) {
      const allowed = VALID_BOOKING_TRANSITIONS[booking.status] || [];
      if (!allowed.includes(status)) {
        throw new Error(`Invalid booking transition from ${booking.status} to ${status}.`);
      }
    }

    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    db.bookings.set(id, booking);
    await saveDocToFirestore('bookings', booking.id, booking);
    db.persist();
    return booking;
  }

  public static async delete(id: string): Promise<boolean> {
    db.bookings.delete(id);
    await deleteDocFromFirestore('bookings', id);
    db.persist();
    return true;
  }
}
