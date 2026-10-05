/**
 * Kitchen Display System (KDS) & Order Dispatch Board
 * Standardized 5-Tab Workflow:
 * 1. 📋 All Orders       – Complete tickets across all workflow stages.
 * 2. 📦 New Order        – Fresh incoming tickets awaiting kitchen acceptance.
 * 3. 🍳 Order Accepted   – Kitchen accepted ticket & cooking in progress.
 * 4. 🍽️ Order Ready      – Food preparation completed; hot on pass for dispatch.
 * 5. 🚀 Dispatched       – Dispatched to dining table, room, or delivery rider.
 *
 * Includes Manager-style Filter System:
 * - Period badge & Filter button with Popover
 * - Presets: Today, Last 7 Days, Last 30 Days (1 Month)
 * - Calendar Date Range: From & To date pickers
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  AlertCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  Utensils,
  BedDouble,
  ShoppingBag,
  Globe,
  Store,
  Search,
  Send,
  PackageCheck,
  Truck,
  Calendar,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  Layers
} from 'lucide-react';
import { Order, OrderStatus } from '../../types/index.ts';
import { KitchenApi } from '../../api/index.ts';
import {
  getKitchenWorkflowBadge,
  formatOrderDateTime
} from '../../utils/formatters.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Spinner } from '../common/Footer.tsx';

export type KitchenFilterTab = 'ALL' | 'NEW_ORDER' | 'ACCEPTED' | 'READY' | 'DISPATCHED';
export type KitchenTimePreset = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

interface KitchenKdsViewProps {
  onBackToAdmin?: () => void;
  onNavigateToPos?: () => void;
}

export const KitchenKdsView: React.FC<KitchenKdsViewProps> = ({ onBackToAdmin, onNavigateToPos }) => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const { error, success } = useToast();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const minPast1MonthStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  // Filter State (Manager Dashboard Style)
  const [selectedPreset, setSelectedPreset] = useState<KitchenTimePreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [timePeriodExpanded, setTimePeriodExpanded] = useState<boolean>(true);
  const filterRef = useRef<HTMLDivElement>(null);

  // Active Applied Dates
  const [appliedStartDate, setAppliedStartDate] = useState<string>(todayStr);
  const [appliedEndDate, setAppliedEndDate] = useState<string>(todayStr);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<KitchenFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isTodayActive = appliedStartDate === todayStr && appliedEndDate === todayStr;

  // Close filter popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchKitchenData = async (
    isBackground = false,
    start: string = appliedStartDate,
    end: string = appliedEndDate
  ) => {
    if (!isBackground) setRefreshing(true);
    try {
      const orderList = await KitchenApi.getOrders({
        startDate: start,
        endDate: end
      });
      setOrders(orderList || []);
    } catch (err: any) {
      if (!isBackground) error(err.message || 'Failed to refresh kitchen orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-fetch when applied date range changes
  useEffect(() => {
    fetchKitchenData(false, appliedStartDate, appliedEndDate);
  }, [appliedStartDate, appliedEndDate]);

  // Live polling (every 5 seconds when viewing Today)
  useEffect(() => {
    if (!isTodayActive) return;
    const interval = setInterval(() => {
      fetchKitchenData(true, todayStr, todayStr);
    }, 5000);
    return () => clearInterval(interval);
  }, [isTodayActive, todayStr]);

  // Handle Quick Presets
  const handleSelectPreset = (preset: KitchenTimePreset) => {
    setSelectedPreset(preset);
    const now = new Date();
    if (preset === 'TODAY') {
      setCustomStartDate(todayStr);
      setCustomEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 6);
      setCustomStartDate(past7.toISOString().split('T')[0]);
      setCustomEndDate(todayStr);
    } else if (preset === 'LAST_30_DAYS') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 29);
      setCustomStartDate(past30.toISOString().split('T')[0]);
      setCustomEndDate(todayStr);
    }
  };

  // Handle Custom Date Change with 1-month boundary clamping
  const handleCustomDateChange = (start: string, end: string) => {
    let validStart = start;
    let validEnd = end;
    if (validStart && validStart < minPast1MonthStr) validStart = minPast1MonthStr;
    if (validStart && validStart > todayStr) validStart = todayStr;
    if (validEnd && validEnd < minPast1MonthStr) validEnd = minPast1MonthStr;
    if (validEnd && validEnd > todayStr) validEnd = todayStr;

    setCustomStartDate(validStart);
    setCustomEndDate(validEnd);
    setSelectedPreset('CUSTOM');
  };

  // Apply Filter
  const handleApplyFilter = () => {
    let start = customStartDate || todayStr;
    let end = customEndDate || todayStr;
    if (start < minPast1MonthStr) start = minPast1MonthStr;
    if (start > todayStr) start = todayStr;
    if (end < minPast1MonthStr) end = minPast1MonthStr;
    if (end > todayStr) end = todayStr;
    if (start > end) start = end;

    setAppliedStartDate(start);
    setAppliedEndDate(end);
    setCustomStartDate(start);
    setCustomEndDate(end);
    setFilterOpen(false);
    success('Date filter applied to Kitchen Display.');
  };

  // Clear Filter
  const handleClearFilter = () => {
    setSelectedPreset('TODAY');
    setCustomStartDate(todayStr);
    setCustomEndDate(todayStr);
    setAppliedStartDate(todayStr);
    setAppliedEndDate(todayStr);
    setFilterOpen(false);
  };

  // Helper for Period badge label
  const getPeriodBadgeLabel = () => {
    if (isTodayActive) {
      const dateObj = new Date(todayStr + 'T00:00:00');
      return `Today (${dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    if (selectedPreset === 'LAST_7_DAYS' && appliedEndDate === todayStr) {
      return 'Last 7 Days';
    }
    if (selectedPreset === 'LAST_30_DAYS' && appliedEndDate === todayStr) {
      return 'Last 30 Days (1 Month)';
    }
    return `${appliedStartDate} to ${appliedEndDate}`;
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      // Optimistically update status in-place to ensure the card stays in the exact same place
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() }
            : o
        )
      );

      await KitchenApi.updateStatus(orderId, nextStatus);
      const friendlyName =
        nextStatus === 'PREPARING'
          ? 'Order Accepted (Cooking Started)'
          : nextStatus === 'READY'
          ? 'Order Marked Ready'
          : nextStatus === 'SERVED' || nextStatus === 'COMPLETED'
          ? 'Order Dispatched'
          : nextStatus.replace('_', ' ');

      success(`Kitchen Ticket updated: ${friendlyName}!`);
      fetchKitchenData(true);
    } catch (err: any) {
      error(err.message || 'Failed to update order status.');
      fetchKitchenData(true);
    } finally {
      setUpdatingId(null);
    }
  };

  // Workflow Category Counts
  const totalAllCount = orders.length;
  const newOrderCount = orders.filter((o) => o.status === 'PLACED').length;
  const orderAcceptedCount = orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PREPARING').length;
  const orderReadyCount = orders.filter(
    (o) =>
      o.status === 'READY' ||
      o.status === 'DELIVERY_ASSIGNED' ||
      o.status === 'DELIVERY_ACCEPTED' ||
      o.status === 'PICKED_UP'
  ).length;
  const dispatchedCount = orders.filter(
    (o) =>
      o.status === 'SERVED' ||
      o.status === 'OUT_FOR_DELIVERY' ||
      o.status === 'DELIVERED' ||
      o.status === 'COMPLETED'
  ).length;

  // Filter orders by active tab & search
  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      // Filter tab
      if (activeFilter === 'NEW_ORDER') {
        if (order.status !== 'PLACED') return false;
      } else if (activeFilter === 'ACCEPTED') {
        if (order.status !== 'CONFIRMED' && order.status !== 'PREPARING') return false;
      } else if (activeFilter === 'READY') {
        if (
          order.status !== 'READY' &&
          order.status !== 'DELIVERY_ASSIGNED' &&
          order.status !== 'DELIVERY_ACCEPTED' &&
          order.status !== 'PICKED_UP'
        )
          return false;
      } else if (activeFilter === 'DISPATCHED') {
        if (
          order.status !== 'SERVED' &&
          order.status !== 'OUT_FOR_DELIVERY' &&
          order.status !== 'DELIVERED' &&
          order.status !== 'COMPLETED'
        )
          return false;
      }
      // 'ALL' tab includes all order cards!

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = order.orderNumber?.toLowerCase().includes(q);
        const matchName = order.customerName?.toLowerCase().includes(q);
        const matchTable = order.tableNumber?.toLowerCase().includes(q);
        const matchRoom = order.roomNumber?.toLowerCase().includes(q);
        const matchDish = order.items?.some((i) => i.name.toLowerCase().includes(q));
        if (!matchNum && !matchName && !matchTable && !matchRoom && !matchDish) return false;
      }

      return true;
    });
  }, [orders, activeFilter, searchQuery]);

  // Elapsed minutes since order creation
  const getElapsedMinutes = (dateString: string) => {
    const elapsedMs = Date.now() - new Date(dateString).getTime();
    return Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
  };

  if (loading) {
    return <Spinner text="Connecting to Kitchen Department KDS..." />;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Header & Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Title Area */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-800 text-amber-100 flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
              <ChefHat className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  🍳 KITCHEN DISPLAY SYSTEM (KDS)
                </span>
                {isTodayActive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Station (Today)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                    <Calendar className="w-3 h-3 text-amber-700" />
                    Archive Window
                  </span>
                )}
              </div>
              <h1 className="font-serif font-bold text-xl sm:text-2xl text-stone-900 mt-0.5">
                Kitchen Order Board
              </h1>
            </div>
          </div>

          {/* Action buttons & Manager-Style Filter */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Audio Chime Button */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-stone-50 text-stone-400 border-stone-200'
              }`}
              title="Toggle audio chime"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-700" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline text-xs font-bold">{soundEnabled ? 'Chime ON' : 'Muted'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchKitchenData()}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-800' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Period Badge Display */}
            <div className="flex items-center gap-1.5 text-xs text-stone-700 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 whitespace-nowrap shrink-0">
              <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="hidden sm:inline font-medium text-stone-500">Period:</span>
              <span className="font-semibold text-stone-900">
                {getPeriodBadgeLabel()}
              </span>
            </div>

            {/* Filters Button with Popover (Same design as Manager Dashboard) */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterOpen || !isTodayActive
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5 text-amber-700" />
                <span>Filters</span>
                {!isTodayActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                )}
                {filterOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-stone-500 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500 ml-0.5" />
                )}
              </button>

              {/* Filter Popover Dropdown */}
              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                    <span className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-amber-700" />
                      Filters
                    </span>
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="p-1 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Time Period Accordion */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setTimePeriodExpanded(!timePeriodExpanded)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-stone-800 hover:text-amber-800 transition-colors cursor-pointer py-1"
                    >
                      <span>Time Period</span>
                      {timePeriodExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </button>

                    {timePeriodExpanded && (
                      <div className="space-y-2 pt-1">
                        {/* From & To Date Pickers */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                              From
                            </label>
                            <input
                              type="date"
                              min={minPast1MonthStr}
                              max={todayStr}
                              value={customStartDate}
                              onChange={(e) => {
                                const fromVal = e.target.value;
                                handleCustomDateChange(fromVal, customEndDate || fromVal);
                              }}
                              className="w-full px-2 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 text-stone-800 focus:outline-hidden focus:border-amber-700 font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                              To
                            </label>
                            <input
                              type="date"
                              min={customStartDate || minPast1MonthStr}
                              max={todayStr}
                              value={customEndDate}
                              onChange={(e) => {
                                const toVal = e.target.value;
                                handleCustomDateChange(customStartDate || toVal, toVal);
                              }}
                              className="w-full px-2 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 text-stone-800 focus:outline-hidden focus:border-amber-700 font-mono"
                            />
                          </div>
                        </div>

                        {/* Quick Presets (Radio list) */}
                        <div className="pt-1.5 border-t border-stone-100 space-y-1 max-h-48 overflow-y-auto">
                          {[
                            { id: 'TODAY', label: 'Today' },
                            { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
                            { id: 'LAST_30_DAYS', label: 'Last 30 Days' }
                          ].map((item) => (
                            <label
                              key={item.id}
                              onClick={() => handleSelectPreset(item.id as any)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                selectedPreset === item.id
                                  ? 'bg-amber-50 text-amber-900 font-semibold'
                                  : 'text-stone-700 hover:bg-stone-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="kitchenTimePreset"
                                checked={selectedPreset === item.id}
                                onChange={() => {}}
                                className="text-amber-700 focus:ring-amber-600 h-3.5 w-3.5 cursor-pointer"
                              />
                              <span>{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions: Clear & Apply */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleClearFilter}
                      className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyFilter}
                      className="px-4 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {onNavigateToPos && (
              <button
                onClick={onNavigateToPos}
                className="px-3 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Take POS Order</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Summary Cards: ALL ORDERS + 4 Workflow Categories */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {/* Card 1: ALL ORDERS (Includes all order cards) */}
          <div
            onClick={() => setActiveFilter('ALL')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              activeFilter === 'ALL'
                ? 'bg-blue-100/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                📋 All Orders
              </span>
              <p className="font-serif font-bold text-2xl sm:text-3xl text-blue-950 mt-0.5">
                {totalAllCount}
              </p>
              <span className="text-[10px] text-blue-700 font-medium">All tickets combined</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-200 text-blue-900 flex items-center justify-center font-bold shrink-0">
              <Layers className="w-5 h-5 text-blue-800" />
            </div>
          </div>

          {/* Card 2: NEW ORDER */}
          <div
            onClick={() => setActiveFilter('NEW_ORDER')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              activeFilter === 'NEW_ORDER'
                ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                📦 New Order
              </span>
              <p className="font-serif font-bold text-2xl sm:text-3xl text-amber-950 mt-0.5">
                {newOrderCount}
              </p>
              <span className="text-[10px] text-amber-700 font-medium">Awaiting acceptance</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-bold shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-800" />
            </div>
          </div>

          {/* Card 3: ORDER ACCEPTED */}
          <div
            onClick={() => setActiveFilter('ACCEPTED')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              activeFilter === 'ACCEPTED'
                ? 'bg-orange-100/90 border-orange-400 ring-2 ring-orange-500/20 shadow-xs'
                : 'bg-orange-50/50 border-orange-200 hover:bg-orange-50'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-900 block">
                🍳 Order Accepted
              </span>
              <p className="font-serif font-bold text-2xl sm:text-3xl text-orange-950 mt-0.5">
                {orderAcceptedCount}
              </p>
              <span className="text-[10px] text-orange-700 font-medium">Cooking on stove/prep</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-200 text-orange-900 flex items-center justify-center font-bold shrink-0">
              <Flame className="w-5 h-5 text-orange-800" />
            </div>
          </div>

          {/* Card 4: ORDER READY */}
          <div
            onClick={() => setActiveFilter('READY')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              activeFilter === 'READY'
                ? 'bg-emerald-100/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                🍽️ Order Ready
              </span>
              <p className="font-serif font-bold text-2xl sm:text-3xl text-emerald-950 mt-0.5">
                {orderReadyCount}
              </p>
              <span className="text-[10px] text-emerald-700 font-medium">Ready for dispatch</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-200 text-emerald-900 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-800" />
            </div>
          </div>

          {/* Card 5: DISPATCHED */}
          <div
            onClick={() => setActiveFilter('DISPATCHED')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              activeFilter === 'DISPATCHED'
                ? 'bg-stone-200 border-stone-400 ring-2 ring-stone-400/20 shadow-xs'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 block">
                🚀 Dispatched
              </span>
              <p className="font-serif font-bold text-2xl sm:text-3xl text-stone-900 mt-0.5">
                {dispatchedCount}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Handed over</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center font-bold shrink-0">
              <PackageCheck className="w-5 h-5 text-stone-800" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter Status & Search Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-stone-600 font-semibold">
          <span>
            {activeFilter === 'ALL'
              ? `All Orders (${totalAllCount})`
              : activeFilter === 'NEW_ORDER'
              ? `New Incoming Orders (${newOrderCount})`
              : activeFilter === 'ACCEPTED'
              ? `In Preparation (${orderAcceptedCount})`
              : activeFilter === 'READY'
              ? `Ready for Dispatch (${orderReadyCount})`
              : `Dispatched Orders (${dispatchedCount})`}
          </span>
          {searchQuery && (
            <span className="text-[10px] text-stone-400 font-normal ml-1">• Filtered by search</span>
          )}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200 sm:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <input
            type="text"
            placeholder="Search #ticket, table, room, dish..."
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
      </div>

      {/* 3. Live Tickets Grid */}
      {visibleOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900">
              {activeFilter === 'ALL'
                ? 'No Orders in Selected Period'
                : activeFilter === 'NEW_ORDER'
                ? 'No New Incoming Orders'
                : activeFilter === 'ACCEPTED'
                ? 'No Orders In Preparation'
                : activeFilter === 'READY'
                ? 'No Orders Waiting for Dispatch'
                : 'No Dispatched Orders Found'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
              {activeFilter === 'NEW_ORDER'
                ? 'All new dining tickets have been accepted by the kitchen staff. New tickets will appear here with a live chime.'
                : `Currently no orders match the selected filter.`}
            </p>
          </div>
          {onNavigateToPos && (
            <button
              type="button"
              onClick={onNavigateToPos}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Take POS Order
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.createdAt);
            const isUrgent =
              elapsed > 20 &&
              order.status !== 'READY' &&
              order.status !== 'COMPLETED' &&
              order.status !== 'SERVED';
            const isOnline = order.userId !== 'usr-staff' && order.userId !== 'usr-admin-001' && order.userId !== 'admin';
            const badge = getKitchenWorkflowBadge(order.status);

            const isNew = order.status === 'PLACED';
            const isAccepted = order.status === 'CONFIRMED' || order.status === 'PREPARING';
            const isReady =
              order.status === 'READY' ||
              order.status === 'DELIVERY_ASSIGNED' ||
              order.status === 'DELIVERY_ACCEPTED' ||
              order.status === 'PICKED_UP';
            const isDispatched =
              order.status === 'SERVED' ||
              order.status === 'OUT_FOR_DELIVERY' ||
              order.status === 'DELIVERED' ||
              order.status === 'COMPLETED';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-xs transition-all ${
                  isUrgent
                    ? 'border-rose-400 ring-2 ring-rose-500/20'
                    : isReady
                    ? 'border-emerald-300 ring-1 ring-emerald-400/30'
                    : isAccepted
                    ? 'border-orange-300 ring-1 ring-orange-400/30'
                    : isNew
                    ? 'border-amber-300 ring-1 ring-amber-400/30'
                    : 'border-stone-200'
                }`}
              >
                {/* Ticket Top Header */}
                <div
                  className={`p-3.5 border-b ${
                    isReady
                      ? 'bg-emerald-50/80 border-emerald-200'
                      : isAccepted
                      ? 'bg-orange-50/80 border-orange-200'
                      : isNew
                      ? 'bg-amber-50/80 border-amber-200'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-stone-900">
                        #{order.orderNumber}
                      </span>
                      {/* Channel Badge */}
                      {isOnline ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full bg-blue-100 text-blue-900 border border-blue-200 text-[9px] font-bold">
                          <Globe className="w-2.5 h-2.5 text-blue-700" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full bg-amber-100 text-amber-950 border border-amber-200 text-[9px] font-bold">
                          <Store className="w-2.5 h-2.5 text-amber-800" /> POS
                        </span>
                      )}
                    </div>

                    {/* Exact Workflow Status Pill */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Destination & Elapsed Timer */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-stone-900">
                      {order.orderType === 'Dine-in' ? (
                        <>
                          <Utensils className="w-4 h-4 text-amber-800" />
                          <span>{order.tableNumber || 'Table Dining'}</span>
                        </>
                      ) : order.orderType === 'Room Service' ? (
                        <>
                          <BedDouble className="w-4 h-4 text-amber-800" />
                          <span>{order.roomNumber || 'Room Service'}</span>
                        </>
                      ) : order.orderType === 'Delivery' ? (
                        <span className="flex items-center gap-1.5 text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-rose-300">
                          <Truck className="w-4 h-4 text-rose-700" />
                          <span>Home Delivery</span>
                        </span>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4 text-amber-800" />
                          <span>Takeaway Parcel</span>
                        </>
                      )}
                    </div>

                    {/* Timer Badge */}
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                        isUrgent
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-white text-stone-700 border border-stone-200'
                      }`}
                    >
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{elapsed}m ago</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-stone-500 mt-1">
                    <span className="truncate font-semibold">Guest: {order.customerName}</span>
                    <span className="font-mono font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                      📅 {formatOrderDateTime(order.createdAt)}
                    </span>
                  </div>

                  {order.orderType === 'Delivery' && order.deliveryAddress && (
                    <div className="mt-1.5 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-stone-800">
                      <span className="font-bold text-rose-950 block">📍 Delivery Address:</span>
                      <p className="line-clamp-2 leading-tight mt-0.5">{order.deliveryAddress}</p>
                    </div>
                  )}
                </div>

                {/* Items & Dishes List */}
                <div className="p-3.5 flex-1 space-y-2.5 divide-y divide-stone-100 max-h-[260px] overflow-y-auto">
                  {order.items.map((item, idx) => (
                    <div key={item.id || idx} className="pt-2 first:pt-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-md bg-stone-900 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                            {item.quantity}×
                          </span>
                          <span className="font-bold text-xs text-stone-900 leading-snug">
                            {item.name}
                          </span>
                        </div>
                      </div>

                      {/* Special Chef Instructions */}
                      {item.specialInstructions && (
                        <div className="ml-7 p-1 rounded-md bg-amber-50 border border-amber-200 text-amber-950 font-medium text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Note: "{item.specialInstructions}"</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* General Ticket Note */}
                  {order.notes && (
                    <div className="pt-2 text-[11px] text-amber-950 bg-amber-50/80 p-2 rounded-xl border border-amber-200/70">
                      <span className="font-bold text-amber-900">Overall Note: </span>
                      {order.notes}
                    </div>
                  )}
                </div>

                {/* Kitchen Step-by-Step Action Workflow */}
                <div className="p-3 bg-stone-50 border-t border-stone-200 space-y-2">
                  {isReadOnly ? (
                    <div className="py-2.5 px-3 text-center text-xs font-semibold text-stone-600 bg-stone-100 rounded-xl border border-stone-200/80 flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>View Only Access ({user?.role === 'MANAGER' ? 'Manager' : 'Admin'})</span>
                    </div>
                  ) : (
                    <>
                      {/* STEP 1: NEW ORDER -> ACCEPT (COOKING) */}
                      {isNew && (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            disabled={updatingId === order.id}
                            onClick={() => handleUpdateStatus(order.id, 'CONFIRMED')}
                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Flame className="w-4 h-4 text-amber-200" />
                            <span>Accept Order (Start Cooking 🍳)</span>
                          </button>

                          <button
                            type="button"
                            disabled={updatingId === order.id}
                            onClick={() => handleUpdateStatus(order.id, 'READY')}
                            className="w-full py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Fast Track: Mark Ready 🍽️</span>
                          </button>
                        </div>
                      )}

                      {/* STEP 2: ORDER ACCEPTED -> MARK READY */}
                      {isAccepted && (
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => handleUpdateStatus(order.id, 'READY')}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>Mark Order Ready 🍽️</span>
                        </button>
                      )}

                      {/* STEP 3: ORDER READY -> MARK DISPATCHED */}
                      {isReady && (
                        <div className="space-y-1.5">
                          <div className="py-1 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-center font-bold text-[11px] flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Food Ready on Hot Pass — Awaiting Dispatch</span>
                          </div>
                          <button
                            type="button"
                            disabled={updatingId === order.id}
                            onClick={() => handleUpdateStatus(order.id, 'SERVED')}
                            className="w-full py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <PackageCheck className="w-4 h-4 text-stone-300" />
                            <span>Mark as Dispatched 🚀</span>
                          </button>
                        </div>
                      )}

                      {/* STEP 4: DISPATCHED */}
                      {isDispatched && (
                        <div className="py-2 px-3 text-center text-xs font-bold text-stone-700 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>✓ Dispatched & Handed Over</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
