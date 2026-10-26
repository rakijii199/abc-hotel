/**
 * Table Reservation Components (Floor Plan, Availability Cards, Booking Cards)
 * Fully responsive for mobile, tablet, and desktop
 */
import React from 'react';
import { Users, MapPin, CheckCircle2, XCircle, Clock, Calendar, Ban, Armchair, ShieldCheck } from 'lucide-react';
import { DiningTable, TableBooking } from '../../types/index.ts';
import { formatDate, formatTime, getBookingStatusBadge } from '../../utils/formatters.ts';

interface TableWithAvail extends DiningTable {
  isAvailable: boolean;
  reason?: string;
}

export const TableFloorPlan: React.FC<{
  tables: TableWithAvail[];
  selectedTableId: string | null;
  onSelectTable: (table: TableWithAvail) => void;
  guestCount: number;
}> = ({ tables, selectedTableId, onSelectTable, guestCount }) => {
  const availableCount = tables.filter((t) => t.isAvailable).length;

  return (
    <div className="space-y-4">
      {/* Header Bar with Count & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-muted)] p-3 rounded-xl border border-[var(--border-subtle)]">
        <h4 className="section-title !text-base flex flex-wrap items-center gap-2">
          <span>Dining Floor Plan</span>
          <span className="badge badge-success font-lux !text-[11px] sm:!text-xs !whitespace-normal">
            {availableCount} {availableCount === 1 ? 'Table' : 'Tables'} Available ({guestCount} {guestCount === 1 ? 'guest' : 'guests'})
          </span>
        </h4>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs font-medium">
          <span className="flex items-center gap-1.5 text-emerald-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" /> Available
          </span>
          <span className="flex items-center gap-1.5 text-[var(--brand-text)]" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" /> Selected
          </span>
          <span className="flex items-center gap-1.5 text-stone-500">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-stone-400 bg-stone-200" /> Booked / Blocked
          </span>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tables.map((table) => {
          const isSelected = selectedTableId === table.id;
          const isCapacityIssue = !table.isAvailable && table.reason?.includes('capacity');

          return (
            <button
              key={table.id}
              type="button"
              disabled={!table.isAvailable}
              onClick={() => onSelectTable(table)}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[130px] ${
                isSelected
                  ? 'bg-[var(--brand-soft)] border-[var(--brand)] ring-2 ring-[var(--brand-ring-soft)] shadow-[var(--shadow-raised)] -translate-y-0.5'
                  : table.isAvailable
                  ? 'bg-white border-stone-200 shadow-[var(--shadow-xs)] hover:border-[var(--brand-border)] hover:shadow-[var(--shadow-raised)] hover:-translate-y-0.5 cursor-pointer'
                  : 'bg-[var(--surface-muted)] border-dashed border-stone-300 opacity-80 cursor-not-allowed'
              }`}
            >
              <div className="space-y-2">
                {/* Row 1: Table Number */}
                <div className="flex items-center gap-1.5">
                  <Armchair className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[var(--brand)]' : table.isAvailable ? 'text-[var(--brand)]' : 'text-stone-400'}`} />
                  <span className="font-display font-bold text-lg text-stone-900 whitespace-nowrap leading-none">
                    {table.tableNumber}
                  </span>
                </div>

                {/* Row 2: Location & Capacity */}
                <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium text-stone-500 pt-0.5">
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    <MapPin className="w-3 h-3 text-amber-700 shrink-0" />
                    <span className="truncate">{table.location}</span>
                  </span>

                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      table.capacity >= guestCount
                        ? 'bg-stone-100 text-stone-800 border border-stone-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <Users className="w-3 h-3 text-stone-500" />
                    <span className="whitespace-nowrap">{table.capacity} Seats</span>
                  </span>
                </div>
              </div>

              {/* Row 3: Availability Status */}
              <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between gap-2 mt-2">
                {table.isAvailable ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${isSelected ? 'text-[var(--brand-text)]' : 'text-emerald-700'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="whitespace-nowrap">{isSelected ? 'Selected Table' : 'Available'}</span>
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold truncate ${
                      isCapacityIssue ? 'text-rose-600' : 'text-stone-500'
                    }`}
                    title={table.reason || 'Unavailable'}
                  >
                    {isCapacityIssue ? (
                      <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                    <span className="truncate">{table.reason || 'Booked'}</span>
                  </span>
                )}

                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const BookingCard: React.FC<{
  booking: TableBooking;
  onCancel?: (bookingId: string) => void;
  canCancel?: boolean;
}> = ({ booking, onCancel, canCancel = true }) => {
  const badge = getBookingStatusBadge(booking.status);
  const isEligibleForCancel = canCancel && (booking.status === 'CONFIRMED' || booking.status === 'PENDING');

  return (
    <div className="surface lift !rounded-2xl p-5 flex flex-col justify-between space-y-4">
      {/* Top Row: Reference + Status Badge */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <span className="text-xs font-mono font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] px-2.5 py-1 rounded-lg border border-[var(--brand-border)]">
            {booking.bookingReference}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${badge.color}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Table Name & Seating */}
        <div className="pt-3">
          <h4 className="section-title !text-lg flex items-center gap-1.5">
            <Armchair className="w-4 h-4 text-[var(--brand)] shrink-0" />
            <span>{booking.tableName || booking.tableNumber || 'Dining Table'}</span>
          </h4>
        </div>
      </div>

      {/* Structured Details with Full Visibility (No Truncation) */}
      <div className="bg-[var(--surface-muted)] p-3.5 rounded-xl border border-[var(--border-subtle)] space-y-2.5 text-xs">
        {/* Date Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-stone-500 font-medium flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Date:</span>
          </span>
          <span className="font-bold text-stone-900 text-right">
            {formatDate(booking.bookingDate)}
          </span>
        </div>

        {/* Time Slot Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-stone-500 font-medium flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Time Slot:</span>
          </span>
          <div className="text-right">
            <span className="font-bold text-stone-900">
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            </span>
            <span className="text-[10px] text-amber-800 font-semibold block">
              (30-Min Table Holding)
            </span>
          </div>
        </div>

        {/* Party Size Row */}
        <div className="flex items-center justify-between gap-2 border-t border-stone-200/50 pt-2">
          <span className="text-stone-500 font-medium flex items-center gap-1.5 shrink-0">
            <Users className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Party Size:</span>
          </span>
          <span className="font-bold text-stone-900">
            {booking.guestCount} {booking.guestCount === 1 ? 'Guest' : 'Guests'}
          </span>
        </div>
      </div>

      {/* Special Notes */}
      {booking.specialRequest && (
        <div className="p-2.5 bg-[var(--brand-soft)] rounded-xl text-xs text-stone-800 border border-[var(--brand-border)]">
          <span className="font-bold text-[var(--brand-text)]">Special Request: </span>
          <span>{booking.specialRequest}</span>
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-stone-500 font-medium">
          {booking.status === 'CONFIRMED'
            ? '✓ Table Locked'
            : booking.status === 'CANCELLED'
            ? 'Cancelled'
            : 'Pending Confirmation'}
        </span>

        {isEligibleForCancel && onCancel ? (
          <button
            onClick={() => onCancel(booking.id)}
            className="btn btn-secondary !text-rose-700 hover:!bg-rose-50 hover:!border-rose-200"
          >
            Cancel Reservation
          </button>
        ) : null}
      </div>
    </div>
  );
};
