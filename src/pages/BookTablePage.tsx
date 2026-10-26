/**
 * Table Reservation Page with Real-Time Availability and Floor Plan
 * Features:
 * - Booking date restricted strictly within 1 month (past dates disabled & dates beyond 30 days disabled)
 * - Past time slots disabled for today's date based on current real-time clock
 * - 30-Minute table holding window with atomic conflict protection
 * - Real-time table blocking for booked/occupied tables
 * - Instant table release when manager/staff makes available or completes reservation
 * - Clean, responsive luxury dining room floor plan & validation
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sun,
  Moon,
  Info
} from 'lucide-react';
import { DiningTable, TableBooking } from '../types/index.ts';
import { BookingApi } from '../api/index.ts';
import { TableFloorPlan } from '../components/booking/TableFloorPlan.tsx';
import { Modal, Spinner } from '../components/common/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatDate, formatTime, getBookingStatusBadge } from '../utils/formatters.ts';
import { LUX_IMAGES, luxImage, hideOnError } from '../components/customer/Reveal.tsx';

interface TableWithAvail extends DiningTable {
  isAvailable: boolean;
  reason?: string;
}

// Full Operational Service Slots (every 30 minutes)
const LUNCH_SLOTS = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'
];

const DINNER_SLOTS = [
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const ALL_TIME_SLOTS = [...LUNCH_SLOTS, ...DINNER_SLOTS];

// Time & Date calculation helpers
const getTodayStr = (): string => new Date().toISOString().split('T')[0];

const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const getMax1MonthStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

/**
 * Returns true if the given slot time on dateStr has already passed compared to current local time.
 */
const isSlotInPast = (dateStr: string, slotTimeStr: string): boolean => {
  const todayStr = getTodayStr();
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const [slotH, slotM] = slotTimeStr.split(':').map(Number);

  if (slotH < currentHours) return true;
  if (slotH === currentHours && slotM <= currentMinutes) return true;
  return false;
};

/**
 * Finds the earliest upcoming time slot for a given date.
 */
const getFirstAvailableSlot = (dateStr: string): string | null => {
  for (const slot of ALL_TIME_SLOTS) {
    if (!isSlotInPast(dateStr, slot)) {
      return slot;
    }
  }
  return null;
};

export const BookTablePage: React.FC<{ navigate: (route: string, state?: any) => void }> = ({ navigate }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { error, success } = useToast();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('login', {
        returnTo: 'book-table',
        message: 'Please login or register to book a table.'
      });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const todayStr = useMemo(() => getTodayStr(), []);
  const tomorrowStr = useMemo(() => getTomorrowStr(), []);
  const max1MonthStr = useMemo(() => getMax1MonthStr(), []);

  // Determine initial valid date and time slot
  const initialSetup = useMemo(() => {
    const firstTodaySlot = getFirstAvailableSlot(todayStr);
    if (firstTodaySlot) {
      return { date: todayStr, slot: firstTodaySlot };
    }
    // If all today's slots have passed, default to tomorrow lunch
    return { date: tomorrowStr, slot: '12:30' };
  }, [todayStr, tomorrowStr]);

  // Reservation Parameters
  const [bookingDate, setBookingDate] = useState<string>(initialSetup.date);
  const [startTime, setStartTime] = useState<string>(initialSetup.slot);
  const [guestCount, setGuestCount] = useState<number>(4);
  const [specialRequest, setSpecialRequest] = useState<string>('');

  // Availability State
  const [tables, setTables] = useState<TableWithAvail[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableWithAvail | null>(null);
  const [loadingAvail, setLoadingAvail] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Confirmation / Success State
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<TableBooking | null>(null);

  // Check table availability
  const checkAvail = useCallback(
    async (isSilent = false) => {
      if (!bookingDate || !startTime || guestCount < 1) return;
      if (!isSilent) setLoadingAvail(true);
      else setRefreshing(true);

      try {
        const res = await BookingApi.checkAvailability({
          bookingDate,
          startTime,
          guestCount
        });
        setTables(res.tables || []);

        // If previously selected table became unavailable (e.g. booked by someone else), clear selection
        setSelectedTable((prev) => {
          if (!prev) return null;
          const updated = res.tables.find((t) => t.id === prev.id);
          return updated && updated.isAvailable ? updated : null;
        });
      } catch (err: any) {
        if (!isSilent) error(err.message || 'Failed to check table availability');
      } finally {
        setLoadingAvail(false);
        setRefreshing(false);
      }
    },
    [bookingDate, startTime, guestCount, error]
  );

  // Fetch availability when date, time slot, or guest count changes
  useEffect(() => {
    checkAvail(false);
  }, [checkAvail]);

  // Real-time background polling every 8 seconds to catch manager/staff releases or new bookings
  useEffect(() => {
    const interval = setInterval(() => {
      checkAvail(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [checkAvail]);

  // Date change handler with strict 1-month window (disallow past dates & disallow dates after 1 month)
  const handleDateChange = (newDate: string) => {
    if (!newDate) return;

    // Disallow past dates
    if (newDate < todayStr) {
      error('Cannot select past dates.');
      setBookingDate(todayStr);
      return;
    }

    // Disallow dates beyond 1 month (30 days)
    if (newDate > max1MonthStr) {
      error('Reservations can only be scheduled within 1 month (30 days) from today.');
      setBookingDate(max1MonthStr);
      return;
    }

    setBookingDate(newDate);

    // If selecting today and current slot is in the past, auto-adjust to next available slot
    if (newDate === todayStr) {
      if (isSlotInPast(todayStr, startTime)) {
        const nextSlot = getFirstAvailableSlot(todayStr);
        if (nextSlot) {
          setStartTime(nextSlot);
        } else {
          // All slots today have passed
          setBookingDate(tomorrowStr);
          setStartTime('12:30');
          error('All dining time slots for today have closed. Switched to tomorrow.');
        }
      }
    }
  };

  // Time slot change handler
  const handleSlotSelect = (slot: string) => {
    if (isSlotInPast(bookingDate, slot)) {
      error('This time slot has already passed for today.');
      return;
    }
    setStartTime(slot);
  };

  const handleSelectTable = (table: TableWithAvail) => {
    if (!table.isAvailable) return;
    setSelectedTable(table);
  };

  const handleInitiateBooking = () => {
    if (!isAuthenticated) {
      error('Please log in or create an account to reserve a table.');
      navigate('login');
      return;
    }

    if (bookingDate > max1MonthStr) {
      error('Reservations can only be made within 1 month.');
      return;
    }

    if (isSlotInPast(bookingDate, startTime)) {
      error('The selected time slot has passed. Please select an upcoming slot.');
      return;
    }

    if (!selectedTable) {
      error('Please select an available table from the floor plan.');
      return;
    }

    setConfirmModalOpen(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedTable) return;
    setSubmitting(true);

    try {
      const booking = await BookingApi.createBooking({
        tableId: selectedTable.id,
        bookingDate,
        startTime,
        guestCount,
        specialRequest: specialRequest.trim() || undefined
      });

      setConfirmedBooking(booking);
      setConfirmModalOpen(false);
      success('Your table has been reserved successfully (30-minute holding guaranteed)!');
    } catch (err: any) {
      error(err.message || 'Unable to create your booking. The table may have just been reserved.');
      // Refresh availability
      checkAvail(false);
    } finally {
      setSubmitting(false);
    }
  };

  // If Booking is confirmed, render Success Screen
  if (confirmedBooking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <div className="surface-raised !rounded-2xl p-6 sm:p-8 text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 bg-[var(--success-soft)] border border-[var(--success-border)] text-[var(--success)] rounded-full mx-auto flex items-center justify-center shadow-[var(--shadow-xs)] ring-8 ring-[var(--success-soft)]/50">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="lux-eyebrow text-[var(--brand-text)] justify-center">
              Reservation {confirmedBooking.status === 'CONFIRMED' ? 'Confirmed' : 'Submitted'}
            </span>
            <h2 className="lux-display text-[clamp(1.9rem,4vw,2.6rem)] text-stone-900">
              {confirmedBooking.status === 'CONFIRMED' ? 'Your Table is Reserved!' : 'Reservation Request Received!'}
            </h2>
            <p className="text-sm text-stone-600 max-w-md mx-auto">
              We look forward to hosting you at ABC Restaurant. Your table is reserved for a 30-minute dining holding slot.
            </p>
          </div>

          {/* Reference Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--brand-soft)] border border-[var(--brand-border)] text-left space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center border-b border-dashed border-[var(--brand-border)] pb-3">
              <div>
                <span className="label-caps !text-[var(--brand-text)]">Booking Reference</span>
                <p className="font-mono font-bold text-xl text-stone-900">
                  {confirmedBooking.bookingReference}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBookingStatusBadge(confirmedBooking.status).color}`}>
                {getBookingStatusBadge(confirmedBooking.status).label.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-stone-500 block font-medium">Date & Time Slot</span>
                <span className="font-semibold text-stone-800 text-sm mt-0.5 block">
                  {formatDate(confirmedBooking.bookingDate)} at {formatTime(confirmedBooking.startTime)} - {formatTime(confirmedBooking.endTime)}
                </span>
                <span className="text-[10px] text-amber-800 font-medium">(30-Min Table Holding)</span>
              </div>
              <div>
                <span className="text-stone-500 block font-medium">Table & Capacity</span>
                <span className="font-semibold text-stone-800 text-sm mt-0.5 block">
                  {confirmedBooking.tableName || confirmedBooking.tableNumber} ({confirmedBooking.guestCount} Guests)
                </span>
              </div>
            </div>

            {confirmedBooking.specialRequest && (
              <div className="text-xs text-stone-600 pt-2 border-t border-dashed border-[var(--brand-border)]">
                <span className="font-semibold text-stone-800">Special Notes: </span>
                {confirmedBooking.specialRequest}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('my-bookings')}
              className="lux-btn lux-btn-wine"
            >
              View My Bookings
            </button>
            <button
              onClick={() => navigate('menu')}
              className="lux-btn lux-btn-outline"
            >
              Pre-Order Food
            </button>
            <button
              onClick={() => {
                setConfirmedBooking(null);
                setSelectedTable(null);
                checkAvail(false);
              }}
              className="btn btn-ghost !min-h-12"
            >
              Book Another Table
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isToday = bookingDate === todayStr;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-10">
      {/* Header Banner */}
      <section className="lux-bleed relative overflow-hidden bg-ivory border-b border-[var(--border-subtle)]">
        <img src={luxImage(LUX_IMAGES.diningRoom, 1800)} alt="" aria-hidden="true" onError={hideOnError} className="absolute inset-0 w-full h-full object-cover lux-kenburns" />
        <div className="absolute inset-0 bg-gradient-to-r from-ivory/95 via-ivory/85 to-ivory/55 md:via-ivory/75 md:to-ivory/15" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ivory/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 lux-hairline" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl animate-[lux-rise_0.8s_var(--ease-lux)]">
              <p className="lux-eyebrow text-[var(--brand-text)]">ABC Restaurant Reservations</p>
              <h1 className="lux-display text-[clamp(2.25rem,5.5vw,4.25rem)] mt-4 text-stone-900 text-balance">
                Reserve your <em className="font-normal text-[var(--brand-text)]">dining table</em>
              </h1>
              <p className="mt-4 text-sm sm:text-base text-stone-600 leading-relaxed max-w-xl">
                Select your preferred dining date (within 1 month), meal time slot (30-minute holding), and party size. Our live conflict prevention engine guarantees instant confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="surface !rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="section-title">
                Reservation Details
              </h3>
              <button
                type="button"
                onClick={() => checkAvail(false)}
                className="p-1.5 text-stone-500 hover:text-[var(--brand-text)] rounded-lg hover:bg-[var(--brand-soft)] transition-colors cursor-pointer"
                title="Refresh Availability"
                aria-label="Refresh availability"
              >
                <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-800' : ''}`} />
              </button>
            </div>

            {/* Date Picker (Past Dates & Dates after 1 month Disabled) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-amber-700" />
                  Select Date (Within 1 Month)
                </label>
                {isToday ? (
                  <span className="badge badge-success !text-[10px] font-bold">
                    Today
                  </span>
                ) : (
                  <span className="badge !text-[10px]">
                    Max: 30 Days
                  </span>
                )}
              </div>
              <input
                type="date"
                min={todayStr}
                max={max1MonthStr}
                value={bookingDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="field !rounded-xl !min-h-11 text-sm font-medium text-stone-900 font-mono"
              />
              <p className="text-[11px] text-stone-500 flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-700 shrink-0" />
                <span>Allowed window: {formatDate(todayStr)} to {formatDate(max1MonthStr)}</span>
              </p>
            </div>

            {/* Time Slot Selector (Grouped by Lunch & Dinner with Past Time Slots Disabled) */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Select Time Slot (30-Min Holding)
                </span>
                <span className="badge badge-brand !text-[11px] font-semibold">
                  {formatTime(startTime)}
                </span>
              </label>

              {/* Lunch Service */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <Sun className="w-3 h-3 text-amber-600" />
                  <span>Lunch Service</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
                  {LUNCH_SLOTS.map((slot) => {
                    const isPast = isSlotInPast(bookingDate, slot);
                    const isSelected = startTime === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isPast}
                        onClick={() => handleSlotSelect(slot)}
                        title={isPast ? 'Time slot has passed for today' : `Book ${formatTime(slot)} (30m holding)`}
                        className={`min-h-11 py-2 px-1 text-xs rounded-xl border transition-all text-center relative ${
                          isSelected
                            ? 'bg-[var(--brand)] text-white font-bold border-[var(--brand)] shadow-[var(--shadow-xs)] ring-2 ring-[var(--brand-ring-soft)]'
                            : isPast
                            ? 'bg-[var(--surface-muted)] text-stone-400 border-dashed border-stone-200 line-through cursor-not-allowed'
                            : 'bg-white text-stone-700 font-semibold border-stone-200 hover:bg-[var(--brand-soft)] hover:border-[var(--brand-border)] hover:text-[var(--brand-text)] cursor-pointer'
                        }`}
                      >
                        {formatTime(slot)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dinner Service */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <Moon className="w-3 h-3 text-[var(--brand)]" />
                  <span>Dinner Service</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
                  {DINNER_SLOTS.map((slot) => {
                    const isPast = isSlotInPast(bookingDate, slot);
                    const isSelected = startTime === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isPast}
                        onClick={() => handleSlotSelect(slot)}
                        title={isPast ? 'Time slot has passed for today' : `Book ${formatTime(slot)} (30m holding)`}
                        className={`min-h-11 py-2 px-1 text-xs rounded-xl border transition-all text-center relative ${
                          isSelected
                            ? 'bg-[var(--brand)] text-white font-bold border-[var(--brand)] shadow-[var(--shadow-xs)] ring-2 ring-[var(--brand-ring-soft)]'
                            : isPast
                            ? 'bg-[var(--surface-muted)] text-stone-400 border-dashed border-stone-200 line-through cursor-not-allowed'
                            : 'bg-white text-stone-700 font-semibold border-stone-200 hover:bg-[var(--brand-soft)] hover:border-[var(--brand-border)] hover:text-[var(--brand-text)] cursor-pointer'
                        }`}
                      >
                        {formatTime(slot)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isToday && (
                <p className="text-[10px] text-stone-500 italic">
                  * Time slots earlier than current time are disabled for today.
                </p>
              )}
            </div>

            {/* Number of Guests */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-700" />
                Number of Guests
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[1, 2, 4, 6, 8].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setGuestCount(count)}
                    className={`min-h-10 py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      guestCount === count
                        ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-[var(--shadow-xs)] ring-2 ring-[var(--brand-ring-soft)]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-[var(--brand-soft)] hover:border-[var(--brand-border)]'
                    }`}
                  >
                    {count} {count === 1 ? 'Guest' : 'Guests'}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Request */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700">
                Special Requests / Occasion (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Enter Special Requests or Occasion Notes"
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                className="field !rounded-xl !py-2.5 text-xs text-stone-900 resize-none"
              />
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center gap-2 text-[11px] text-stone-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>30-minute table holding guarantees no double bookings.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Table Floor Plan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="surface !rounded-2xl p-4 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <span className="label-caps !text-[var(--brand-text)]">
                  Floor Plan & Availability
                </span>
                <h3 className="section-title !text-xl mt-0.5">
                  ABC Restaurant Dining Room
                </h3>
              </div>
              <div className="text-xs font-medium text-stone-600 bg-[var(--brand-soft)] border border-[var(--brand-border)] px-3 py-1.5 rounded-full flex flex-wrap items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-amber-700" />
                <span>{formatDate(bookingDate)}</span>
                <span>•</span>
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span className="font-bold text-stone-900">{formatTime(startTime)}</span>
                <span className="text-[10px] text-stone-500">(30m)</span>
              </div>
            </div>

            {loadingAvail ? (
              <Spinner text="Verifying real-time table availability..." />
            ) : (
              <TableFloorPlan
                tables={tables}
                selectedTableId={selectedTable?.id || null}
                onSelectTable={handleSelectTable}
                guestCount={guestCount}
              />
            )}

            {/* Selected Table Summary Strip & Submit CTA */}
            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                {selectedTable ? (
                  <div>
                    <span className="label-caps">Selected</span>
                    <p className="font-bold text-sm text-stone-900">
                      {selectedTable.tableNumber} — {selectedTable.location} ({selectedTable.capacity} Seats)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--brand-text)] font-medium">
                    Please select an available table above to proceed.
                  </p>
                )}
              </div>

              <button
                disabled={!selectedTable || submitting || isSlotInPast(bookingDate, startTime) || bookingDate > max1MonthStr}
                onClick={handleInitiateBooking}
                className="lux-btn lux-btn-wine disabled:opacity-50 disabled:pointer-events-none"
              >
                Proceed to Reservation
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Table Reservation"
        maxWidth="max-w-lg"
      >
        <div className="space-y-5">
          <p className="text-sm text-stone-600 leading-relaxed">
            Please review your dining reservation details before confirming:
          </p>

          <div className="p-4 rounded-2xl bg-[var(--brand-soft)] border border-[var(--brand-border)] space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Restaurant:</span>
              <span className="font-semibold text-stone-900">ABC Restaurant & Fine Dining</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Date & Time:</span>
              <span className="font-semibold text-stone-900">
                {formatDate(bookingDate)} at {formatTime(startTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Holding Duration:</span>
              <span className="font-semibold text-[var(--brand-text)]">30 Minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Party Size:</span>
              <span className="font-semibold text-stone-900">{guestCount} Guests</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Table:</span>
              <span className="font-semibold text-stone-900">
                {selectedTable?.tableNumber} ({selectedTable?.location})
              </span>
            </div>
            {specialRequest && (
              <div className="flex justify-between gap-3 border-t border-dashed border-[var(--brand-border)] pt-2">
                <span className="text-stone-500">Special Request:</span>
                <span className="font-medium text-stone-800 text-right max-w-[240px]">
                  {specialRequest}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              onClick={() => setConfirmModalOpen(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={handleConfirmReservation}
              className="btn btn-primary"
            >
              {submitting ? 'Confirming Reservation...' : 'Confirm & Reserve Table (30m Holding)'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
