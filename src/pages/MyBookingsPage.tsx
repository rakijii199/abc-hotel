/**
 * Customer Table Bookings Page
 * Clear, spacious cards with full data visibility (Date, 30-min Holding Time Slot, Party Size, Table).
 * Clean Tabs: Upcoming Reservations, Cancelled / Declined, All Bookings.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Clock, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { TableBooking } from '../types/index.ts';
import { BookingApi } from '../api/index.ts';
import { BookingCard } from '../components/booking/TableFloorPlan.tsx';
import { Spinner, EmptyState, Modal } from '../components/common/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export type MyBookingsTab = 'UPCOMING' | 'CANCELLED' | 'ALL';

export const MyBookingsPage: React.FC<{ navigate: (route: string) => void }> = ({
  navigate
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { error, success } = useToast();
  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MyBookingsTab>('UPCOMING');

  // Cancel Confirmation Modal
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<boolean>(false);

  const loadBookings = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await BookingApi.getMyBookings();
      const sorted = (data || []).sort(
        (a, b) => new Date(b.bookingDate + 'T' + (b.startTime || '00:00')).getTime() -
                  new Date(a.bookingDate + 'T' + (a.startTime || '00:00')).getTime()
      );
      setBookings(sorted);
    } catch (err: any) {
      error(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('login');
      return;
    }
    loadBookings();
  }, [isAuthenticated, isLoading]);

  const handleConfirmCancel = async () => {
    if (!cancelTargetId) return;
    setCancelling(true);
    try {
      await BookingApi.cancelBooking(cancelTargetId);
      success('Reservation cancelled successfully.');
      setCancelTargetId(null);
      loadBookings(true);
    } catch (err: any) {
      error(err.message || 'Failed to cancel reservation.');
    } finally {
      setCancelling(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Category filters
  const upcomingBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'SEATED') &&
        b.bookingDate >= todayStr
    );
  }, [bookings, todayStr]);

  const cancelledBookings = useMemo(() => {
    return bookings.filter(
      (b) => b.status === 'CANCELLED' || b.status === 'REJECTED' || (b.status as string) === 'NO_SHOW'
    );
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (activeTab === 'UPCOMING') return upcomingBookings;
    if (activeTab === 'CANCELLED') return cancelledBookings;
    return bookings;
  }, [activeTab, upcomingBookings, cancelledBookings, bookings]);

  if (isLoading || loading) {
    return <Spinner text="Fetching your reservations..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Dining Reservations
          </span>
          <h1 className="font-serif text-3xl font-bold text-stone-900 mt-0.5">
            My Table Bookings ({bookings.length})
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Track your upcoming dining table reservations or reserve a new table.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadBookings()}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-all cursor-pointer"
            title="Refresh Bookings"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-700' : ''}`} />
          </button>

          <button
            onClick={() => navigate('book-table')}
            className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Reserve New Table</span>
          </button>
        </div>
      </div>

      {/* 3 Clean Interactive Filter Tabs (Past Reservations Removed) */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto text-xs">
        {/* Tab 1: Upcoming */}
        <button
          onClick={() => setActiveTab('UPCOMING')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'UPCOMING'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span>Upcoming Reservations</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'UPCOMING'
                ? 'bg-amber-900/50 text-white'
                : upcomingBookings.length > 0
                ? 'bg-amber-100 text-amber-900'
                : 'bg-stone-200 text-stone-600'
            }`}
          >
            {upcomingBookings.length}
          </span>
        </button>

        {/* Tab 2: Cancelled / Declined */}
        <button
          onClick={() => setActiveTab('CANCELLED')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'CANCELLED'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span>Cancelled / Declined</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'CANCELLED'
                ? 'bg-amber-900/50 text-white'
                : cancelledBookings.length > 0
                ? 'bg-rose-100 text-rose-800'
                : 'bg-stone-200 text-stone-600'
            }`}
          >
            {cancelledBookings.length}
          </span>
        </button>

        {/* Tab 3: All Bookings */}
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'ALL'
              ? 'bg-stone-800 text-white shadow-xs'
              : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          <span>All Bookings ({bookings.length})</span>
        </button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8" />}
          title={
            activeTab === 'UPCOMING'
              ? 'No Upcoming Reservations'
              : activeTab === 'CANCELLED'
              ? 'No Cancelled Reservations'
              : 'No Reservations Found'
          }
          description={
            activeTab === 'UPCOMING'
              ? 'You do not have any pending or confirmed reservations scheduled for upcoming dates.'
              : 'You do not have any reservations in this section.'
          }
          actionText="Book a Table"
          onAction={() => navigate('book-table')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={(id) => setCancelTargetId(id)}
              canCancel={booking.status === 'PENDING' || booking.status === 'CONFIRMED'}
            />
          ))}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={!!cancelTargetId}
        onClose={() => setCancelTargetId(null)}
        title="Cancel Table Reservation"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-stone-600">
          <p>
            Are you sure you want to cancel this reservation? The reserved table will be released and made available for other guests.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              onClick={() => setCancelTargetId(null)}
              className="px-4 py-2 font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Keep Booking
            </button>
            <button
              disabled={cancelling}
              onClick={handleConfirmCancel}
              className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
