/**
 * Customer Order History Page
 * Enhanced, clear luxury dining & delivery order cards with real-time tracking
 */
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, RefreshCw, Search, UtensilsCrossed, Flame } from 'lucide-react';
import { Order } from '../types/index.ts';
import { OrderApi } from '../api/index.ts';
import { OrderCard } from '../components/orders/OrderStatusTimeline.tsx';
import { Spinner, EmptyState } from '../components/common/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export type MyOrdersTab = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export const MyOrdersPage: React.FC<{
  navigate: (route: string, state?: any) => void;
}> = ({ navigate }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { error } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MyOrdersTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await OrderApi.getMyOrders();
      const sorted = (data || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
    } catch (err: any) {
      error(err.message || 'Failed to load orders');
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
    loadOrders();
  }, [isAuthenticated, isLoading]);

  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'PLACED' ||
        o.status === 'CONFIRMED' ||
        o.status === 'PREPARING' ||
        o.status === 'READY' ||
        o.status === 'DELIVERY_ASSIGNED' ||
        o.status === 'DELIVERY_ACCEPTED' ||
        o.status === 'PICKED_UP' ||
        o.status === 'OUT_FOR_DELIVERY' ||
        o.status === 'SERVED' ||
        o.status === 'WAITING_FOR_PAYMENT'
    );
  }, [orders]);

  const completedOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED');
  }, [orders]);

  const cancelledOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'CANCELLED');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (activeTab === 'ACTIVE') list = activeOrders;
    else if (activeTab === 'COMPLETED') list = completedOrders;
    else if (activeTab === 'CANCELLED') list = cancelledOrders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((order) => {
        const matchNum = order.orderNumber?.toLowerCase().includes(q);
        const matchType = order.orderType?.toLowerCase().includes(q);
        const matchTable = order.tableNumber?.toLowerCase().includes(q);
        const matchItem = order.items?.some((i) => i.name.toLowerCase().includes(q));
        return matchNum || matchType || matchTable || matchItem;
      });
    }

    return list;
  }, [activeTab, activeOrders, completedOrders, cancelledOrders, orders, searchQuery]);

  if (isLoading || loading) {
    return <Spinner text="Loading your dining history..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <span className="lux-eyebrow text-[var(--brand-text)]">
            Account Activity
          </span>
          <h1 className="lux-display text-[clamp(2rem,4vw,2.75rem)] text-stone-900 mt-2">
            My Dining Orders ({orders.length})
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1.5">
            Real-time kitchen preparation updates, delivery dispatch tracking, and dining history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadOrders()}
            disabled={refreshing}
            className="btn btn-secondary !px-2.5"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[var(--brand)]' : ''}`} />
          </button>

          <button
            onClick={() => navigate('menu')}
            className="btn btn-primary"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Order New Meal</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tabs with Counts */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none text-xs -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
          {/* Tab 1: All */}
          <button
            onClick={() => setActiveTab('ALL')}
            className={`min-h-10 px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'ALL'
                ? 'bg-[var(--brand)] border-[var(--brand)] text-white shadow-[var(--shadow-xs)]'
                : 'bg-white border-stone-200 text-stone-600 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
            }`}
          >
            <span>All Orders</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {orders.length}
            </span>
          </button>

          {/* Tab 2: Active */}
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`min-h-10 px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'ACTIVE'
                ? 'bg-[var(--brand)] border-[var(--brand)] text-white shadow-[var(--shadow-xs)]'
                : 'bg-white border-stone-200 text-stone-600 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
            }`}
          >
            <span className="flex items-center gap-1">
              <Flame className={`w-3.5 h-3.5 ${activeTab === 'ACTIVE' ? 'text-white' : 'text-[var(--brand)]'}`} />
              <span>Active in Kitchen</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'ACTIVE'
                  ? 'bg-white/20 text-white'
                  : activeOrders.length > 0
                  ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {activeOrders.length}
            </span>
          </button>

          {/* Tab 3: Completed */}
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`min-h-10 px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'COMPLETED'
                ? 'bg-[var(--brand)] border-[var(--brand)] text-white shadow-[var(--shadow-xs)]'
                : 'bg-white border-stone-200 text-stone-600 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
            }`}
          >
            <span>Completed & Served</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'COMPLETED'
                  ? 'bg-white/20 text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {completedOrders.length}
            </span>
          </button>

          {/* Tab 4: Cancelled */}
          <button
            onClick={() => setActiveTab('CANCELLED')}
            className={`min-h-10 px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'CANCELLED'
                ? 'bg-[var(--brand)] border-[var(--brand)] text-white shadow-[var(--shadow-xs)]'
                : 'bg-white border-stone-200 text-stone-600 hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
            }`}
          >
            <span>Cancelled</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'CANCELLED'
                  ? 'bg-white/20 text-white'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {cancelledOrders.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-white px-3.5 min-h-10 rounded-full border border-[var(--border-subtle)] shadow-[var(--shadow-xs)] text-xs sm:w-64 focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand-ring-soft)]">
          <Search className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <input
            type="text"
            placeholder="Search dish, order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent focus:outline-hidden text-stone-900"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-stone-500 hover:text-stone-800 font-bold cursor-pointer"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Orders Grid */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8" />}
          title="No Orders Found"
          description={
            searchQuery
              ? `No orders match your search "${searchQuery}".`
              : activeTab === 'ACTIVE'
              ? 'No active orders currently in the kitchen.'
              : 'You do not have any orders in this section.'
          }
          actionText="Explore Gourmet Menu"
          onAction={() => navigate('menu')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => navigate('order-status', { orderId: order.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
};
