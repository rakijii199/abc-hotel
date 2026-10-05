/**
 * Admin Table Bookings Management Component
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Eye,
  Phone,
  Mail,
  Filter,
  Check,
  Ban,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { TableBooking, BookingStatus } from '../../types/index.ts';
import { formatDate, formatTime, getBookingStatusBadge, formatDDMMYY } from '../../utils/formatters.ts';
import { Modal } from '../common/Footer.tsx';

interface AdminBookingsViewProps {
  bookings: TableBooking[];
  onUpdateStatus: (bookingId: string, status: BookingStatus) => Promise<void>;
  onRefresh: () => void;
}

type BookingDatePreset =
  | 'ALL'
  | 'TODAY'
  | 'TOMORROW'
  | 'NEXT_7_DAYS'
  | 'THIS_MONTH'
  | 'CUSTOM';

export const AdminBookingsView: React.FC<AdminBookingsViewProps> = ({
  bookings,
  onUpdateStatus
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<TableBooking | null>(null);
  const [actionConfirmModal, setActionConfirmModal] = useState<{
    booking: TableBooking;
    action: BookingStatus;
    title: string;
    message: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Date filter state
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<BookingDatePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const dateFilterRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setDateFilterOpen(false);
      }
    };
    if (dateFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dateFilterOpen]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const next7DaysStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const getDateFilterLabel = () => {
    switch (datePreset) {
      case 'TODAY':
        return `Today (${formatDDMMYY(todayStr)})`;
      case 'TOMORROW':
        return `Tomorrow (${formatDDMMYY(tomorrowStr)})`;
      case 'NEXT_7_DAYS':
        return 'Next 7 Days';
      case 'THIS_MONTH':
        return 'This Month';
      case 'CUSTOM':
        if (customStartDate && customEndDate) {
          return `${formatDDMMYY(customStartDate)} – ${formatDDMMYY(customEndDate)}`;
        }
        if (customStartDate) {
          return `From ${formatDDMMYY(customStartDate)}`;
        }
        return 'Custom Range';
      default:
        return 'All Dates';
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;

    // Date filtering
    if (datePreset === 'TODAY') {
      if (b.bookingDate !== todayStr) return false;
    } else if (datePreset === 'TOMORROW') {
      if (b.bookingDate !== tomorrowStr) return false;
    } else if (datePreset === 'NEXT_7_DAYS') {
      if (b.bookingDate < todayStr || b.bookingDate > next7DaysStr) return false;
    } else if (datePreset === 'THIS_MONTH') {
      if (!b.bookingDate.startsWith(currentMonthStr)) return false;
    } else if (datePreset === 'CUSTOM') {
      if (customStartDate && b.bookingDate < customStartDate) return false;
      if (customEndDate && b.bookingDate > customEndDate) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = b.bookingReference.toLowerCase().includes(q);
      const matchName = b.user?.firstName.toLowerCase().includes(q) || b.user?.lastName.toLowerCase().includes(q);
      const matchTable = b.tableNumber?.toLowerCase().includes(q) || b.tableName?.toLowerCase().includes(q);
      if (!matchRef && !matchName && !matchTable) return false;
    }
    return true;
  });

  const handleExecuteStatus = async (bookingId: string, status: BookingStatus) => {
    setProcessing(true);
    try {
      await onUpdateStatus(bookingId, status);
      setActionConfirmModal(null);
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header & Filter Card */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="font-serif text-lg sm:text-xl font-bold text-stone-900">
            Table Reservations
          </h1>

          {/* Status Filter Tabs (PENDING replaced with New) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { id: 'ALL', label: 'All', count: bookings.length },
              { id: 'PENDING', label: 'New', count: bookings.filter((b) => b.status === 'PENDING').length },
              { id: 'CONFIRMED', label: 'Confirmed', count: bookings.filter((b) => b.status === 'CONFIRMED').length },
              { id: 'SEATED', label: 'Seated', count: bookings.filter((b) => b.status === 'SEATED').length },
              { id: 'CANCELLED', label: 'Cancelled', count: bookings.filter((b) => b.status === 'CANCELLED').length },
              { id: 'REJECTED', label: 'Rejected', count: bookings.filter((b) => b.status === 'REJECTED').length }
            ].map((st) => {
              const isSelected = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-800 text-white font-bold shadow-2xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80'
                  }`}
                >
                  <span>{st.label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-stone-200/70 text-stone-700'
                    }`}
                  >
                    {st.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Date Filter Bar (Standard 8px gap) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-stone-100">
          {/* Search Input (sm:col-span-7) */}
          <div className="sm:col-span-7 flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by customer name, reference (BK-...), or table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-stone-400 hover:text-stone-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Filter Button with Filter Icon similar to Dashboard (sm:col-span-5) */}
          <div className="sm:col-span-5 relative" ref={dateFilterRef}>
            <button
              type="button"
              onClick={() => setDateFilterOpen(!dateFilterOpen)}
              className={`w-full px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                dateFilterOpen || datePreset !== 'ALL'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold shadow-2xs'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Filter className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">{getDateFilterLabel()}</span>
                {datePreset !== 'ALL' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0"></span>
                )}
              </div>
              {dateFilterOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-stone-500 shrink-0 ml-1" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0 ml-1" />
              )}
            </button>

            {/* Date Filters Popover Dropdown (similar to Dashboard) */}
            {dateFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <span className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-amber-700" />
                    <span>Reservation Date Filter</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDateFilterOpen(false)}
                    className="p-1 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Custom Date Range */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Custom Date Range
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-500">From</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value);
                          setDatePreset('CUSTOM');
                        }}
                        className="w-full px-2 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 text-stone-800 focus:outline-hidden focus:border-amber-700 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-500">To</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value);
                          setDatePreset('CUSTOM');
                        }}
                        className="w-full px-2 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 text-stone-800 focus:outline-hidden focus:border-amber-700 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets List */}
                <div className="pt-2 border-t border-stone-100 space-y-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Quick Presets
                  </span>
                  {[
                    { id: 'ALL', label: 'All Dates' },
                    { id: 'TODAY', label: 'Today' },
                    { id: 'TOMORROW', label: 'Tomorrow' },
                    { id: 'NEXT_7_DAYS', label: 'Next 7 Days' },
                    { id: 'THIS_MONTH', label: 'This Month' }
                  ].map((p) => (
                    <label
                      key={p.id}
                      onClick={() => {
                        setDatePreset(p.id as BookingDatePreset);
                        if (p.id !== 'CUSTOM') {
                          setCustomStartDate('');
                          setCustomEndDate('');
                          setDateFilterOpen(false);
                        }
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        datePreset === p.id
                          ? 'bg-amber-50 text-amber-900 font-bold'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="bookingDatePreset"
                        checked={datePreset === p.id}
                        onChange={() => {}}
                        className="w-3 h-3 text-amber-700 focus:ring-amber-500"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('ALL');
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setDateFilterOpen(false);
                    }}
                    className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Reset Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilterOpen(false)}
                    className="px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50/90 text-stone-500 uppercase font-bold text-[11px] border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Booking ID</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Booking Time</th>
                <th className="py-2.5 px-3">Guests</th>
                <th className="py-2.5 px-3">Table</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    No table reservations found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const badge = getBookingStatusBadge(b.status);
                  return (
                    <tr key={b.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-amber-900 text-xs">
                        {b.bookingReference}
                      </td>

                      <td className="py-2 px-3">
                        <p className="font-bold text-stone-900 text-xs">
                          {b.user ? `${b.user.firstName} ${b.user.lastName}` : 'Guest Diner'}
                        </p>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {b.user?.phone || 'No phone'}
                        </p>
                      </td>

                      <td className="py-2 px-3">
                        <p className="font-bold text-stone-800 text-xs font-mono">{formatDDMMYY(b.bookingDate)}</p>
                        <p className="text-[10px] text-stone-500 font-mono">
                          {formatTime(b.startTime)} - {formatTime(b.endTime)}
                        </p>
                      </td>

                      <td className="py-2 px-3 font-bold text-stone-800">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 font-mono text-xs">
                          {b.guestCount} {b.guestCount === 1 ? 'Guest' : 'Guests'}
                        </span>
                      </td>

                      <td className="py-2 px-3">
                        <p className="font-bold text-stone-900 text-xs">{b.tableName || b.tableNumber}</p>
                      </td>

                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedBooking(b)}
                            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
                            title="View Booking Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {b.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleExecuteStatus(b.id, 'CONFIRMED')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() =>
                                  setActionConfirmModal({
                                    booking: b,
                                    action: 'REJECTED',
                                    title: 'Reject Table Reservation',
                                    message: `Are you sure you want to reject booking ${b.bookingReference} for ${b.guestCount} guests?`
                                  })
                                }
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-lg text-[11px] cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {b.status === 'CONFIRMED' && (
                            <>
                              <button
                                onClick={() => handleExecuteStatus(b.id, 'SEATED')}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                              >
                                Seat
                              </button>
                              <button
                                onClick={() =>
                                  setActionConfirmModal({
                                    booking: b,
                                    action: 'CANCELLED',
                                    title: 'Cancel Booking',
                                    message: `Are you sure you want to cancel booking ${b.bookingReference}?`
                                  })
                                }
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-lg text-[11px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {b.status === 'SEATED' && (
                            <button
                              onClick={() => handleExecuteStatus(b.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title={`Booking Details — ${selectedBooking.bookingReference}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-5 text-xs text-stone-700">
            {/* Customer Box */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <span className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                Customer Information
              </span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-stone-400">Full Name</p>
                  <p className="font-bold text-stone-900 text-sm">
                    {selectedBooking.user ? `${selectedBooking.user.firstName} ${selectedBooking.user.lastName}` : 'Guest'}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Email Address</p>
                  <p className="font-mono text-stone-800">{selectedBooking.user?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-stone-400">Contact Phone</p>
                  <p className="font-mono text-stone-800 font-bold">{selectedBooking.user?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-stone-400">Account Role</p>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                    {selectedBooking.user?.role || 'CUSTOMER'}
                  </span>
                </div>
              </div>
            </div>

            {/* Booking Box */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <span className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                Reservation Details
              </span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="text-stone-400">Reservation Date</p>
                  <p className="font-bold text-stone-900 text-sm font-mono">{formatDDMMYY(selectedBooking.bookingDate)}</p>
                </div>
                <div>
                  <p className="text-stone-400">Time Slot</p>
                  <p className="font-mono font-bold text-stone-900">
                    {formatTime(selectedBooking.startTime)} - {formatTime(selectedBooking.endTime)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-400">Allocated Table</p>
                  <p className="font-bold text-stone-900">{selectedBooking.tableName || selectedBooking.tableNumber}</p>
                </div>
                <div>
                  <p className="text-stone-400">Party Size</p>
                  <p className="font-bold text-stone-900">{selectedBooking.guestCount} Guests</p>
                </div>
              </div>

              {selectedBooking.specialRequest && (
                <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 text-amber-900">
                  <span className="font-bold">Special Request: </span>
                  {selectedBooking.specialRequest}
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-stone-200 flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="text-stone-400 mr-2">Current Status:</span>
                <span className="font-bold text-stone-900">{selectedBooking.status}</span>
              </div>

              <div className="flex gap-2">
                {selectedBooking.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleExecuteStatus(selectedBooking.id, 'CONFIRMED')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Confirm Booking
                    </button>
                    <button
                      onClick={() => handleExecuteStatus(selectedBooking.id, 'REJECTED')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Reject Booking
                    </button>
                  </>
                )}

                {selectedBooking.status === 'CONFIRMED' && (
                  <>
                    <button
                      onClick={() => handleExecuteStatus(selectedBooking.id, 'SEATED')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Seat Guests
                    </button>
                    <button
                      onClick={() => handleExecuteStatus(selectedBooking.id, 'CANCELLED')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                    >
                      Cancel Booking
                    </button>
                  </>
                )}

                {selectedBooking.status === 'SEATED' && (
                  <button
                    onClick={() => handleExecuteStatus(selectedBooking.id, 'COMPLETED')}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Mark Completed
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Action Confirmation Modal */}
      {actionConfirmModal && (
        <Modal
          isOpen={!!actionConfirmModal}
          onClose={() => setActionConfirmModal(null)}
          title={actionConfirmModal.title}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs text-stone-600">
            <p className="text-stone-800 font-medium">{actionConfirmModal.message}</p>
            <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
              <button
                onClick={() => setActionConfirmModal(null)}
                className="px-4 py-2 font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Go Back
              </button>
              <button
                disabled={processing}
                onClick={() => handleExecuteStatus(actionConfirmModal.booking.id, actionConfirmModal.action)}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer"
              >
                {processing ? 'Updating...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
