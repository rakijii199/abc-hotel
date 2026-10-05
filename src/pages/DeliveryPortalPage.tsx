/**
 * Delivery Staff Dedicated Portal
 * Simple, intuitive, and mobile-friendly UI for delivery riders.
 * Filter tabs: "New Orders", "Accepted", "Delivered"
 * Actions:
 *   - New Order: Accept Food (-> DELIVERY_ACCEPTED)
 *   - Accepted: Update Out for Delivery (-> OUT_FOR_DELIVERY) -> Update Delivered (-> DELIVERED)
 *   - Delivered: Summary of completed deliveries
 */
import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  LogOut,
  Navigation,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { AdminApi } from '../api/index.ts';
import { Order, OrderStatus } from '../types/index.ts';
import { formatCurrency, formatTime } from '../utils/formatters.ts';

type DeliveryTab = 'NEW_ORDERS' | 'ACCEPTED' | 'DELIVERED';

export const DeliveryPortalPage: React.FC<{
  navigate: (route: string, state?: any) => void;
}> = ({ navigate }) => {
  const { user, logout } = useAuth();
  const { error, success } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DeliveryTab>('NEW_ORDERS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const fetchDeliveryOrders = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // Fetch all delivery orders using the AdminApi endpoint
      const allOrders = await AdminApi.getAllOrders({ orderType: 'Delivery' });
      // Sort newest first
      const sorted = (allOrders || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
    } catch (err: any) {
      error(err.message || 'Failed to load delivery orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveryOrders();
    // Auto-refresh delivery orders every 10 seconds to catch new kitchen-ready tickets
    const interval = setInterval(() => fetchDeliveryOrders(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus, successMessage?: string) => {
    setUpdatingOrderId(orderId);
    try {
      await AdminApi.updateOrderStatus(orderId, nextStatus);
      success(successMessage || `✓ Order updated to ${nextStatus.replace(/_/g, ' ')}!`);
      await fetchDeliveryOrders(true);
      // Auto-switch tabs to show the updated order where appropriate
      if (nextStatus === 'DELIVERY_ACCEPTED') {
        setActiveTab('ACCEPTED');
      } else if (nextStatus === 'DELIVERED') {
        setActiveTab('DELIVERED');
      }
    } catch (err: any) {
      error(err.message || 'Failed to update delivery status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Categorize orders into the 3 simple filters:
  // 1. New Orders: Orders ready for dispatch or awaiting rider acceptance
  const newOrders = orders.filter((o) =>
    ['READY', 'DELIVERY_ASSIGNED', 'PLACED', 'CONFIRMED', 'PREPARING'].includes(o.status)
  );

  // 2. Accepted: Orders claimed and currently in progress by delivery staff
  const acceptedOrders = orders.filter((o) =>
    ['DELIVERY_ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status)
  );

  // 3. Delivered: Completed delivery orders
  const deliveredOrders = orders.filter((o) =>
    ['DELIVERED', 'COMPLETED'].includes(o.status)
  );

  // Filter current active tab items by search query
  const getTabOrders = () => {
    let list: Order[] = [];
    if (activeTab === 'NEW_ORDERS') list = newOrders;
    else if (activeTab === 'ACCEPTED') list = acceptedOrders;
    else if (activeTab === 'DELIVERED') list = deliveredOrders;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q))
    );
  };

  const currentTabOrders = getTabOrders();

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200/90 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-stone-900 leading-tight">Delivery Portal</h1>
              <p className="text-xs text-stone-500 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Rider: <span className="font-semibold text-stone-800">{user?.firstName || 'Delivery Staff'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDeliveryOrders(true)}
              disabled={refreshing}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer border border-stone-200"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
            </button>

            <button
              onClick={() => {
                logout();
                navigate('staff-login');
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3 Main Filter Tabs: New Order, Accepted, Delivered */}
      <div className="bg-white border-b border-stone-200 sticky top-[65px] z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="grid grid-cols-3 gap-2 bg-stone-100 p-1.5 rounded-2xl">
            {/* Tab 1: New Order */}
            <button
              onClick={() => setActiveTab('NEW_ORDERS')}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'NEW_ORDERS'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>New Order</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'NEW_ORDERS'
                    ? 'bg-amber-800/50 text-white'
                    : newOrders.length > 0
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {newOrders.length}
              </span>
            </button>

            {/* Tab 2: Accepted */}
            <button
              onClick={() => setActiveTab('ACCEPTED')}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'ACCEPTED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span>Accepted</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'ACCEPTED'
                    ? 'bg-blue-800/50 text-white'
                    : acceptedOrders.length > 0
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {acceptedOrders.length}
              </span>
            </button>

            {/* Tab 3: Delivered */}
            <button
              onClick={() => setActiveTab('DELIVERED')}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'DELIVERED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Delivered</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'DELIVERED'
                    ? 'bg-emerald-800/50 text-white'
                    : deliveredOrders.length > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {deliveredOrders.length}
              </span>
            </button>
          </div>

          {/* Quick Search Bar */}
          <div className="mt-2.5 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, customer name, phone, or address..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Order Cards Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
            <p className="text-stone-500 text-xs font-bold uppercase tracking-wider">
              Loading Delivery Orders...
            </p>
          </div>
        ) : currentTabOrders.length === 0 ? (
          /* Clean, friendly empty state */
          <div className="bg-white rounded-3xl border border-stone-200/90 p-10 text-center space-y-3 my-6">
            <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto text-stone-400">
              {activeTab === 'NEW_ORDERS' && <Package className="w-7 h-7 text-amber-500" />}
              {activeTab === 'ACCEPTED' && <Navigation className="w-7 h-7 text-blue-500" />}
              {activeTab === 'DELIVERED' && <CheckCircle2 className="w-7 h-7 text-emerald-500" />}
            </div>

            <h3 className="font-bold text-base text-stone-800">
              {searchQuery
                ? 'No matching orders found'
                : activeTab === 'NEW_ORDERS'
                ? 'No New Orders Waiting'
                : activeTab === 'ACCEPTED'
                ? 'No Orders In Progress'
                : 'No Delivered Orders Yet'}
            </h3>

            <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? `No orders matching "${searchQuery}". Try a different keyword.`
                : activeTab === 'NEW_ORDERS'
                ? 'When the kitchen finishes preparing food and marks it ready, new orders will automatically show up here for you to accept.'
                : activeTab === 'ACCEPTED'
                ? 'Go to "New Orders" tab and click "Accept Food" to start a delivery.'
                : 'Completed deliveries will appear here as a delivery history record.'}
            </p>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Reset Search
              </button>
            )}
          </div>
        ) : (
          /* Cards List */
          <div className="space-y-4">
            {currentTabOrders.map((order) => {
              const isUpdating = updatingOrderId === order.id;
              const isKitchenReady = order.status === 'READY' || order.status === 'DELIVERY_ASSIGNED';
              const isKitchenPreparing = ['PLACED', 'CONFIRMED', 'PREPARING'].includes(order.status);
              const isAccepted = order.status === 'DELIVERY_ACCEPTED' || order.status === 'PICKED_UP';
              const isOutForDelivery = order.status === 'OUT_FOR_DELIVERY';
              const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Order Card Header */}
                  <div className="bg-stone-50 px-4 py-3 border-b border-stone-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-stone-900 text-sm sm:text-base">
                        #{order.orderNumber}
                      </span>
                      <span className="text-stone-400">•</span>
                      <span className="text-xs text-stone-500 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        {formatTime(order.createdAt)}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isKitchenReady && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                          Ready for Pickup
                        </span>
                      )}
                      {isKitchenPreparing && (
                        <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-900 text-xs font-semibold border border-orange-200">
                          🍳 Kitchen Cooking
                        </span>
                      )}
                      {isAccepted && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold border border-blue-200">
                          🛵 Order Accepted
                        </span>
                      )}
                      {isOutForDelivery && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 animate-pulse">
                          ⚡ Out for Delivery
                        </span>
                      )}
                      {isDelivered && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-700" />
                          Delivered
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Details Body */}
                  <div className="p-4 space-y-3.5">
                    {/* Customer & Contact Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/80 p-3 rounded-xl border border-stone-150">
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                          Customer
                        </span>
                        <p className="font-bold text-stone-900 text-sm">{order.customerName}</p>
                      </div>

                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-stone-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition-colors shadow-2xs w-fit"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Call: {order.customerPhone}</span>
                        </a>
                      )}
                    </div>

                    {/* Delivery Address with Quick Maps Link */}
                    {order.deliveryAddress && (
                      <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/70 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-700" /> Delivery Address
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              order.deliveryAddress
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1"
                          >
                            <span>Open Map</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-xs text-stone-800 font-medium leading-relaxed">
                          {order.deliveryAddress}
                        </p>
                      </div>
                    )}

                    {/* Order Notes / Instructions */}
                    {order.notes && (
                      <div className="bg-amber-100/50 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <p>
                          <strong className="font-semibold">Instructions:</strong> {order.notes}
                        </p>
                      </div>
                    )}

                    {/* Order Items & Total */}
                    <div className="border border-stone-150 rounded-xl p-3 bg-white space-y-2">
                      <div className="flex items-center justify-between text-xs text-stone-500 font-bold uppercase tracking-wider border-b border-stone-100 pb-1.5">
                        <span>Items ({order.items.length})</span>
                        <span>Amount</span>
                      </div>

                      <div className="divide-y divide-stone-100 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="py-1 flex items-center justify-between">
                            <span className="font-medium text-stone-800">
                              <span className="font-bold text-amber-700 mr-1.5">{item.quantity}×</span>
                              {item.name}
                            </span>
                            <span className="text-stone-500 font-mono">
                              {formatCurrency(item.totalPrice || item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-stone-200/80 pt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-500 font-semibold">Payment:</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              order.paymentStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {order.paymentMethod || 'Cash'} • {order.paymentStatus}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-stone-400 mr-1.5">Total:</span>
                          <span className="text-sm font-extrabold text-stone-900 font-mono">
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ACTION BUTTONS (Clean, User-Friendly) */}
                    <div className="pt-1">
                      {/* NEW ORDERS TAB ACTIONS */}
                      {activeTab === 'NEW_ORDERS' && (
                        <div>
                          {isKitchenReady ? (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  order.id,
                                  'DELIVERY_ACCEPTED',
                                  `✓ Order #${order.orderNumber} accepted for delivery!`
                                )
                              }
                              disabled={isUpdating}
                              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <Truck className="w-4 h-4 text-amber-100" />
                              <span>{isUpdating ? 'Accepting...' : 'Accept Food & Start Delivery'}</span>
                              <ChevronRight className="w-4 h-4 ml-auto" />
                            </button>
                          ) : (
                            <div className="py-2.5 px-3 bg-orange-50 border border-orange-200 text-orange-900 text-xs rounded-xl flex items-center justify-between">
                              <span className="font-semibold">🍳 Kitchen is still cooking this order</span>
                              <span className="text-[11px] text-orange-700">Ready button will unlock once food is prepared</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ACCEPTED TAB ACTIONS */}
                      {activeTab === 'ACCEPTED' && (
                        <div className="space-y-2">
                          {isAccepted && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  order.id,
                                  'OUT_FOR_DELIVERY',
                                  `🛵 Order #${order.orderNumber} is now Out for Delivery!`
                                )
                              }
                              disabled={isUpdating}
                              className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-sm transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <Navigation className="w-4 h-4 text-purple-200 animate-pulse" />
                              <span>{isUpdating ? 'Updating...' : 'Update: Out for Delivery 🛵'}</span>
                              <ChevronRight className="w-4 h-4 ml-auto" />
                            </button>
                          )}

                          {isOutForDelivery && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  order.id,
                                  'DELIVERED',
                                  `🎉 Order #${order.orderNumber} marked as Delivered to customer!`
                                )
                              }
                              disabled={isUpdating}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                              <span>{isUpdating ? 'Updating...' : 'Update: Mark as Delivered ✅'}</span>
                              <ChevronRight className="w-4 h-4 ml-auto" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* DELIVERED TAB ACTIONS */}
                      {activeTab === 'DELIVERED' && (
                        <div className="py-2.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Successfully Delivered to Customer
                          </span>
                          <span className="text-[11px] text-emerald-700 font-mono">
                            {formatTime(order.updatedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
