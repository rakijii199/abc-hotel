/**
 * Customer Personalized Dashboard
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ShoppingBag,
  Clock,
  Sparkles,
  ArrowRight,
  UtensilsCrossed,
  Award,
  ChevronRight
} from 'lucide-react';
import { TableBooking, Order, MenuItem } from '../types/index.ts';
import { BookingApi, OrderApi, MenuApi } from '../api/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { formatCurrency, formatDate, formatTime, getOrderStatusBadge } from '../utils/formatters.ts';
import { Spinner } from '../components/common/Footer.tsx';
import { LUX_IMAGES, luxImage, hideOnError } from '../components/customer/Reveal.tsx';

export const CustomerDashboardPage: React.FC<{
  navigate: (route: string, state?: any) => void;
}> = ({ navigate }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [upcomingBooking, setUpcomingBooking] = useState<TableBooking | null>(null);
  const [recentOrder, setRecentOrder] = useState<Order | null>(null);
  const [recommendations, setRecommendations] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('login');
      return;
    }

    async function loadDashboard() {
      try {
        const [bookings, orders, menuItems] = await Promise.all([
          BookingApi.getMyBookings(),
          OrderApi.getMyOrders(),
          MenuApi.getItems({ sortBy: 'popular' })
        ]);

        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = bookings.find(
          (b) =>
            (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'SEATED') &&
            b.bookingDate >= todayStr
        );
        setUpcomingBooking(upcoming || null);

        if (orders.length > 0) {
          setRecentOrder(orders[0]);
        }

        setRecommendations(menuItems.slice(0, 3));
      } catch (err) {
        console.error('Failed to load customer dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [isAuthenticated, isLoading]);

  if (isLoading || loading) {
    return <Spinner text="Loading your guest portal..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-10">
      {/* Welcome Banner */}
      <section className="lux-bleed relative overflow-hidden bg-ivory border-b border-[var(--border-subtle)]">
        <img src={luxImage(LUX_IMAGES.hotel, 1800)} alt="" aria-hidden="true" onError={hideOnError} className="absolute inset-0 w-full h-full object-cover lux-kenburns" />
        <div className="absolute inset-0 bg-gradient-to-r from-ivory/95 via-ivory/85 to-ivory/55 md:via-ivory/75 md:to-ivory/15" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ivory/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 lux-hairline" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl animate-[lux-rise_0.8s_var(--ease-lux)]">
              <p className="lux-eyebrow text-[var(--brand-text)]">Guest Privilege Portal</p>
              <h1 className="lux-display text-[clamp(2.25rem,5.5vw,4.25rem)] mt-4 text-stone-900 text-balance">
                Welcome back, <em className="font-normal text-[var(--brand-text)]">{user?.firstName}</em>
              </h1>
              <p className="mt-4 text-sm sm:text-base text-stone-600 leading-relaxed max-w-xl">
                Manage your fine dining reservations, order gourmet delicacies, and review past experiences with ABC Hotel.
              </p>
            </div>
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 shrink-0 animate-[lux-rise_0.9s_var(--ease-lux)]">
              <button onClick={() => navigate('book-table')} className="lux-btn lux-btn-wine">
                <Calendar className="w-4 h-4" />
                Book a Table
              </button>
              <button onClick={() => navigate('menu')} className="lux-btn lux-btn-outline bg-white/70">
                <UtensilsCrossed className="w-4 h-4 text-[var(--brand)]" />
                Order Food
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Widget 1: Upcoming Booking */}
        <div className="surface lift !rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="label-caps !text-[var(--brand-text)] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[var(--brand)]" /> Upcoming Booking
              </span>
              {upcomingBooking && (
                <span className="text-[11px] font-mono font-semibold text-stone-500">
                  {upcomingBooking.bookingReference}
                </span>
              )}
            </div>

            {upcomingBooking ? (
              <div className="py-4 space-y-3">
                <h3 className="section-title !text-xl">
                  {upcomingBooking.tableName || upcomingBooking.tableNumber}
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 block font-medium">Date</span>
                    <span className="font-semibold text-stone-800 text-sm mt-0.5 block">
                      {formatDate(upcomingBooking.bookingDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block font-medium">Time & Party</span>
                    <span className="font-semibold text-stone-800 text-sm mt-0.5 block">
                      {formatTime(upcomingBooking.startTime)} • {upcomingBooking.guestCount} Guests
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[var(--success-soft)] rounded-xl border border-[var(--success-border)] text-xs text-[var(--success)] font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Your table is confirmed & locked
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-500 space-y-2">
                <p>You have no active table reservations for today.</p>
                <button
                  onClick={() => navigate('book-table')}
                  className="text-xs font-bold text-[var(--brand-text)] hover:underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer"
                >
                  Reserve a table for tonight <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              onClick={() => navigate('my-bookings')}
              className="text-xs font-bold text-stone-700 hover:text-[var(--brand-text)] flex items-center gap-1 transition-colors cursor-pointer"
            >
              View all bookings <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Widget 2: Recent Order Live Status */}
        <div className="surface lift !rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="label-caps !text-[var(--brand-text)] flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-[var(--brand)]" /> Recent Order
              </span>
              {recentOrder && (
                <span className="text-[11px] font-mono font-bold text-stone-900">
                  {recentOrder.orderNumber}
                </span>
              )}
            </div>

            {recentOrder ? (
              <div className="py-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="section-title !text-lg">
                    {recentOrder.orderType}
                    {recentOrder.tableNumber ? ` (${recentOrder.tableNumber})` : ''}
                  </h3>
                  {(() => {
                    const badge = getOrderStatusBadge(recentOrder.status);
                    return (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="space-y-1 text-xs text-stone-600">
                  <p className="truncate">
                    {recentOrder.items.map((i) => `${i.quantity}x ${i.name}${i.portionLabel ? ` (${i.portionLabel})` : ''}`).join(', ')}
                  </p>
                  <p className="font-bold text-[var(--brand-text)] font-mono text-sm pt-1">
                    Total: {formatCurrency(recentOrder.total)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-500 space-y-2">
                <p>You haven't placed any food orders yet.</p>
                <button
                  onClick={() => navigate('menu')}
                  className="text-xs font-bold text-[var(--brand-text)] hover:underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer"
                >
                  Explore dining menu <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              onClick={() => {
                if (recentOrder) {
                  navigate('order-status', { orderId: recentOrder.id });
                } else {
                  navigate('my-orders');
                }
              }}
              className="text-xs font-bold text-stone-700 hover:text-[var(--brand-text)] flex items-center gap-1 transition-colors cursor-pointer"
            >
              {recentOrder ? 'Track this order' : 'View order history'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recommended for You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title !text-2xl">
            Recommended by the Master Chef
          </h3>
          <button
            onClick={() => navigate('menu')}
            className="text-xs font-bold text-[var(--brand-text)] hover:underline underline-offset-2 cursor-pointer"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {recommendations.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate('menu')}
              className="surface lift !rounded-2xl p-4 cursor-pointer flex items-center gap-4 group lux-zoom overflow-hidden"
            >
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-16 h-16 rounded-xl object-cover bg-stone-100 shrink-0 shadow-[var(--shadow-xs)]"
              />
              <div className="space-y-1">
                <h4 className="font-display font-bold text-base text-stone-900 group-hover:text-[var(--brand-text)] transition-colors">
                  {item.name}
                </h4>
                <p className="font-mono text-xs font-bold text-[var(--brand-text)]">
                  {formatCurrency(item.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
