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
import { PageHero, LUX_IMAGES, luxImage } from '../components/customer/Reveal.tsx';

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
      <PageHero
        eyebrow="Guest Privilege Portal"
        title={
          <>
            Welcome back, <em className="font-normal text-champagne">{user?.firstName}</em>
          </>
        }
        description="Manage your fine dining reservations, order gourmet delicacies, and review past experiences with ABC Hotel."
      >
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('book-table')} className="lux-btn lux-btn-gold">
            <Calendar className="w-4 h-4" />
            Book a Table
          </button>
          <button onClick={() => navigate('menu')} className="lux-btn lux-btn-ghost">
            <UtensilsCrossed className="w-4 h-4 text-champagne" />
            Order Food
          </button>
        </div>
      </PageHero>

      {/* Main Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Widget 1: Upcoming Booking */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" /> Upcoming Booking
              </span>
              {upcomingBooking && (
                <span className="text-[11px] font-mono font-semibold text-stone-500">
                  {upcomingBooking.bookingReference}
                </span>
              )}
            </div>

            {upcomingBooking ? (
              <div className="py-4 space-y-3">
                <h3 className="font-serif font-bold text-xl text-stone-900">
                  {upcomingBooking.tableName || upcomingBooking.tableNumber}
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 block font-medium">Date</span>
                    <span className="font-semibold text-stone-800 text-sm mt-0.5 block">
                      {formatDate(upcomingBooking.bookingDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block font-medium">Time & Party</span>
                    <span className="font-semibold text-stone-800 text-sm mt-0.5 block">
                      {formatTime(upcomingBooking.startTime)} • {upcomingBooking.guestCount} Guests
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Your table is confirmed & locked
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-500 space-y-2">
                <p>You have no active table reservations for today.</p>
                <button
                  onClick={() => navigate('book-table')}
                  className="text-xs font-bold text-amber-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Reserve a table for tonight <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end">
            <button
              onClick={() => navigate('my-bookings')}
              className="text-xs font-bold text-stone-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              View all bookings <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Widget 2: Recent Order Live Status */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-800 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-600" /> Recent Order
              </span>
              {recentOrder && (
                <span className="text-[11px] font-mono font-bold text-stone-900">
                  {recentOrder.orderNumber}
                </span>
              )}
            </div>

            {recentOrder ? (
              <div className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-lg text-stone-900">
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
                    {recentOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>
                  <p className="font-bold text-stone-900 font-mono text-sm pt-1">
                    Total: {formatCurrency(recentOrder.total)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-500 space-y-2">
                <p>You haven't placed any food orders yet.</p>
                <button
                  onClick={() => navigate('menu')}
                  className="text-xs font-bold text-amber-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
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
              className="text-xs font-bold text-stone-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              {recentOrder ? 'Track this order' : 'View order history'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recommended for You */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-xl text-stone-900">
            Recommended by the Master Chef
          </h3>
          <button
            onClick={() => navigate('menu')}
            className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
          >
            See all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {recommendations.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate('menu')}
              className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
            >
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-16 h-16 rounded-xl object-cover bg-stone-100 shrink-0"
              />
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-sm text-stone-900 group-hover:text-amber-800 transition-colors">
                  {item.name}
                </h4>
                <p className="font-mono text-xs font-bold text-stone-900">
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
