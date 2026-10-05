/**
 * Admin Food Orders Management Component
 * Features:
 * - Rich Cards View & Compact Table View with seamless toggle
 * - Elegant, scrollbar-free filter chips with live counts
 * - Multi-criteria filters (Status, Service Type, Payment Status, Channel)
 * - Complete order lifecycle actions, dish additions, payment collection & inspection
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  Eye,
  CheckCircle2,
  ChefHat,
  PackageCheck,
  XCircle,
  CreditCard,
  Banknote,
  Utensils,
  PlusCircle,
  Trash2,
  Flame,
  Plus,
  LayoutGrid,
  List,
  Globe,
  Store,
  Clock,
  Phone,
  BedDouble,
  DollarSign,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Filter,
  RotateCcw,
  Truck,
  BellRing,
  X,
  MapPin,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import { Order, OrderStatus, MenuItem, OrderType, Invoice } from '../../types/index.ts';
import { AdminApi, PaymentApi, BillingApi, ManagerApi } from '../../api/index.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDisplayDate,
  formatOrderDateTime,
  getPast30DaysRange,
  getOrderStatusBadge,
  getStaffWorkflowBadge
} from '../../utils/formatters.ts';
import { Modal } from '../common/Footer.tsx';
import { OrderStatusTimeline } from '../orders/OrderStatusTimeline.tsx';
import { InvoiceViewModal } from '../billing/InvoiceViewModal.tsx';

const AVAILABLE_RIDERS = [
  { id: 'rider-staff-01', name: 'Delivery Staff Rider', phone: '+91 98765 43210', status: 'Active', vehicle: 'ABC Hotel Delivery Partner' }
];

interface AdminOrdersViewProps {
  orders: Order[];
  menuItems?: MenuItem[];
  onUpdateStatus: (
    orderId: string,
    status: OrderStatus,
    riderInfo?: { deliveryRiderId?: string; deliveryRiderName?: string; deliveryRiderPhone?: string }
  ) => Promise<void>;
  onRefresh: () => void;
}

interface StagedDishItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({
  orders,
  menuItems = [],
  onUpdateStatus,
  onRefresh
}) => {
  const { error, success } = useToast();
  const { user, isAdmin, isManager } = useAuth();
  const canViewAllOrders = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canAcceptOrder = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'STAFF' || user?.role === 'KITCHEN';
  const canMarkReady = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'KITCHEN';
  const canMarkServed = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // 1-Month Date Range (Default all or selected date, can go back up to 30 days)
  const { today: todayStr, yesterday: yesterdayStr, minDate: minDateStr } = useMemo(() => getPast30DaysRange(), []);
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [dateFilterOpen, setDateFilterOpen] = useState<boolean>(false);
  const [presetSelection, setPresetSelection] = useState<'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM'>('ALL');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const dateFilterRef = useRef<HTMLDivElement>(null);

  // Close date filter popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setDateFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Enforce role authorization: default to NEW_ORDER if not authorized for ALL
  useEffect(() => {
    if (user && !canViewAllOrders) {
      setStatusFilter('NEW_ORDER');
    }
  }, [user, canViewAllOrders]);

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination & Archival State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [showArchiveModal, setShowArchiveModal] = useState<boolean>(false);
  const [archiveSearch, setArchiveSearch] = useState<string>('');
  const [archiveOrdersList, setArchiveOrdersList] = useState<Order[]>([]);
  const [loadingArchive, setLoadingArchive] = useState<boolean>(false);

  // Modals State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [invoiceModalData, setInvoiceModalData] = useState<Invoice | null>(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);

  // Delivery Rider Assignment Modal State & ABC Hotel Delivery Users
  const [deliveryPartners, setDeliveryPartners] = useState<Array<{ id: string; name: string; phone: string; status: string; vehicle: string }>>(AVAILABLE_RIDERS);
  const [assigningRiderOrder, setAssigningRiderOrder] = useState<Order | null>(null);
  const [selectedRider, setSelectedRider] = useState<typeof AVAILABLE_RIDERS[0] | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Load ABC Hotel registered delivery partners dynamically
  useEffect(() => {
    ManagerApi.getEmployees({ role: 'DELIVERY' })
      .then((employees) => {
        if (employees && employees.length > 0) {
          const formatted = employees.map((emp) => ({
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`.trim(),
            phone: emp.phone || '+91 98765 43210',
            status: emp.status === 'ACTIVE' ? 'ABC Hotel Staff' : 'Inactive',
            vehicle: 'Registered ABC Hotel Delivery Partner'
          }));
          const combined = [...formatted];
          AVAILABLE_RIDERS.forEach((r) => {
            if (!combined.some((c) => c.id === r.id || c.name === r.name)) {
              combined.push(r);
            }
          });
          setDeliveryPartners(combined);
        }
      })
      .catch(() => {
        // Fallback to default ABC Hotel delivery staff
      });
  }, []);

  const handleConfirmRiderAssignment = async () => {
    if (!assigningRiderOrder || !selectedRider) {
      error('Please select a delivery rider.');
      return;
    }
    setIsAssigning(true);
    try {
      await onUpdateStatus(assigningRiderOrder.id, 'DELIVERY_ASSIGNED', {
        deliveryRiderId: selectedRider.id,
        deliveryRiderName: selectedRider.name,
        deliveryRiderPhone: selectedRider.phone
      });
      success(`✓ Order #${assigningRiderOrder.orderNumber} assigned to ${selectedRider.name} (${selectedRider.phone})!`);
      setAssigningRiderOrder(null);
      setSelectedRider(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to assign delivery rider.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenBillingInvoice = async (order: Order) => {
    setGeneratingInvoiceId(order.id);
    try {
      const res = await BillingApi.generateInvoice(order.id);
      if (res && res.invoice) {
        setInvoiceModalData(res.invoice);
      } else {
        const inv = await BillingApi.getInvoice(order.id);
        if (inv) {
          setInvoiceModalData(inv);
        } else {
          error('Could not load invoice data.');
        }
      }
      onRefresh();
    } catch (err: any) {
      // If invoice generation returned error, attempt lookup
      try {
        const inv = await BillingApi.getInvoice(order.id);
        if (inv) {
          setInvoiceModalData(inv);
          onRefresh();
          return;
        }
      } catch {
        // ignore fallback error
      }
      error(err.message || 'Failed to generate invoice.');
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  // Add Items State
  const [stagedItems, setStagedItems] = useState<StagedDishItem[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [dishQuantity, setDishQuantity] = useState<number>(1);
  const [dishInstructions, setDishInstructions] = useState<string>('');
  const [dishSearch, setDishSearch] = useState<string>('');
  const [submittingAddItems, setSubmittingAddItems] = useState<boolean>(false);

  // Payment Collection State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);
  const [sendingRequestOrderId, setSendingRequestOrderId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  const handleSendPaymentRequest = async (order: Order) => {
    setSendingRequestOrderId(order.id);
    try {
      await PaymentApi.sendPaymentRequestAdmin(
        order.id,
        `Payment request of ${formatCurrency(order.total)} for Order #${order.orderNumber}`
      );
      success(`Payment Request sent to ${order.customerName} (${order.customerPhone})!`);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to send payment request.');
    } finally {
      setSendingRequestOrderId(null);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('Are you sure you want to clear all test orders, bookings, and payments?')) return;
    try {
      await AdminApi.clearAllData();
      success('All test orders and bookings cleared successfully!');
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to clear data.');
    }
  };

  // Filter computation
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status Filter
      if (statusFilter === 'NEW_ORDER') {
        if (o.status !== 'PLACED') return false;
      } else if (statusFilter === 'CONFIRMED') {
        if (o.status !== 'CONFIRMED' && o.status !== 'PREPARING') return false;
      } else if (statusFilter === 'READY') {
        if (o.status !== 'READY') return false;
      } else if (statusFilter === 'DISPATCHED_DELIVERY') {
        if (o.status !== 'DELIVERY_ASSIGNED' && o.status !== 'DELIVERY_ACCEPTED' && o.status !== 'PICKED_UP') return false;
      } else if (statusFilter === 'OUT_FOR_DELIVERY') {
        if (o.status !== 'OUT_FOR_DELIVERY') return false;
      } else if (statusFilter === 'SERVED') {
        if (o.status !== 'SERVED' && o.status !== 'WAITING_FOR_PAYMENT') return false;
      } else if (statusFilter === 'DELIVERED') {
        if (o.status !== 'DELIVERED') return false;
      } else if (statusFilter === 'PAID') {
        if (o.paymentStatus !== 'PAID' && o.status !== 'COMPLETED') return false;
      } else if (statusFilter === 'CANCELLED') {
        if (o.status !== 'CANCELLED') return false;
      } else if (statusFilter !== 'ALL') {
        if (o.status !== statusFilter) return false;
      }

      // Service Type Filter
      if (typeFilter !== 'ALL' && o.orderType !== typeFilter) return false;

      // Date Filter (up to 30 days back, supporting presets & ranges)
      if (dateFilter !== 'ALL') {
        const oDate = (o.createdAt || '').split('T')[0];
        if (dateFilter === todayStr || dateFilter === 'TODAY') {
          if (oDate !== todayStr) return false;
        } else if (dateFilter === 'LAST_7_DAYS') {
          const d = new Date();
          d.setDate(d.getDate() - 6);
          const fromDate = d.toISOString().split('T')[0];
          if (oDate < fromDate || oDate > todayStr) return false;
        } else if (dateFilter === 'LAST_30_DAYS') {
          const d = new Date();
          d.setDate(d.getDate() - 29);
          const fromDate = d.toISOString().split('T')[0];
          if (oDate < fromDate || oDate > todayStr) return false;
        } else if (dateFilter === 'CUSTOM') {
          if (customFrom && oDate < customFrom) return false;
          if (customTo && oDate > customTo) return false;
        } else {
          if (oDate !== dateFilter) return false;
        }
      }

      // Payment Filter
      if (paymentFilter === 'PAID' && o.paymentStatus !== 'PAID') return false;
      if (paymentFilter === 'UNPAID' && o.paymentStatus === 'PAID') return false;

      // Channel Filter
      const isOnline = o.userId !== 'usr-staff' && o.userId !== 'usr-admin-001' && o.userId !== 'admin';
      if (channelFilter === 'ONLINE' && !isOnline) return false;
      if (channelFilter === 'POS' && isOnline) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = o.orderNumber.toLowerCase().includes(q);
        const matchCust = o.customerName.toLowerCase().includes(q) || o.customerPhone.toLowerCase().includes(q);
        const matchRoom = o.roomNumber?.toLowerCase().includes(q) || o.tableNumber?.toLowerCase().includes(q) || o.deliveryAddress?.toLowerCase().includes(q);
        const matchItem = o.items.some((i) => i.name.toLowerCase().includes(q));
        const matchRider = o.deliveryRiderName && o.deliveryRiderName.toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchRoom && !matchItem && !matchRider) return false;
      }

      return true;
    });
  }, [orders, statusFilter, typeFilter, paymentFilter, channelFilter, searchQuery, dateFilter, customFrom, customTo]);

  // Reset page whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, paymentFilter, channelFilter, searchQuery, dateFilter]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleSearchArchive = async () => {
    setLoadingArchive(true);
    try {
      const res = await AdminApi.getArchivedOrders({
        search: archiveSearch.trim() || undefined,
        pageSize: 50
      });
      setArchiveOrdersList(res.items || []);
    } catch (err: any) {
      error(err.message || 'Failed to search archive.');
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleExecuteStatus = async (orderId: string, status: OrderStatus) => {
    setProcessing(true);
    try {
      await onUpdateStatus(orderId, status);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }
      onRefresh();
    } finally {
      setProcessing(false);
    }
  };

  // Open Edit/Add Items Modal
  const handleOpenAddItemsModal = (order: Order) => {
    setEditingOrder(order);
    setStagedItems([]);
    setSelectedDishId('');
    setDishQuantity(1);
    setDishInstructions('');
    setDishSearch('');
  };

  // Stage dish for order
  const handleStageDish = () => {
    if (!selectedDishId) return;
    const item = menuItems.find((m) => m.id === selectedDishId);
    if (!item) return;

    const existingIdx = stagedItems.findIndex((s) => s.menuItemId === item.id);
    if (existingIdx >= 0) {
      const copy = [...stagedItems];
      copy[existingIdx].quantity += dishQuantity;
      if (dishInstructions.trim()) {
        copy[existingIdx].specialInstructions = dishInstructions.trim();
      }
      setStagedItems(copy);
    } else {
      setStagedItems([
        ...stagedItems,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: dishQuantity,
          specialInstructions: dishInstructions.trim() || undefined
        }
      ]);
    }

    setSelectedDishId('');
    setDishQuantity(1);
    setDishInstructions('');
  };

  const handleRemoveStagedDish = (menuItemId: string) => {
    setStagedItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  // Save additional dishes to order
  const handleSaveAdditionalDishes = async () => {
    if (!editingOrder || stagedItems.length === 0) return;
    setSubmittingAddItems(true);
    try {
      await AdminApi.addItemsToOrder(editingOrder.id, stagedItems);
      success(`Added ${stagedItems.length} new dish(es) to Order #${editingOrder.orderNumber}!`);
      setEditingOrder(null);
      setStagedItems([]);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to add items to order.');
    } finally {
      setSubmittingAddItems(false);
    }
  };

  // Open Payment Collection Modal
  const handleOpenPaymentModal = (order: Order) => {
    setPaymentModalOrder(order);
    setSelectedPaymentMethod('Cash');
  };

  // Submit payment status
  const handleSavePaymentStatus = async () => {
    if (!paymentModalOrder) return;
    setSubmittingPayment(true);
    try {
      await AdminApi.updatePaymentStatus(paymentModalOrder.id, 'PAID', selectedPaymentMethod);
      success(`Payment for Order #${paymentModalOrder.orderNumber} marked as PAID via ${selectedPaymentMethod}!`);
      setPaymentModalOrder(null);
      onRefresh();
    } catch (err: any) {
      error(err.message || 'Failed to update payment status.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredMenuItems = menuItems.filter((m) => {
    if (!m.available) return false;
    if (dishSearch.trim()) {
      return (
        m.name.toLowerCase().includes(dishSearch.toLowerCase()) ||
        m.description?.toLowerCase().includes(dishSearch.toLowerCase())
      );
    }
    return true;
  });

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      NEW_ORDER: 0,
      CONFIRMED: 0,
      READY: 0,
      DISPATCHED_DELIVERY: 0,
      OUT_FOR_DELIVERY: 0,
      SERVED: 0,
      DELIVERED: 0,
      PAID: 0,
      CANCELLED: 0
    };
    orders.forEach((o) => {
      if (o.status === 'PLACED') {
        counts.NEW_ORDER++;
      }
      if (o.status === 'CONFIRMED' || o.status === 'PREPARING') {
        counts.CONFIRMED++;
      }
      if (o.status === 'READY') {
        counts.READY++;
      }
      if (o.status === 'DELIVERY_ASSIGNED' || o.status === 'DELIVERY_ACCEPTED' || o.status === 'PICKED_UP') {
        counts.DISPATCHED_DELIVERY++;
      }
      if (o.status === 'OUT_FOR_DELIVERY') {
        counts.OUT_FOR_DELIVERY++;
      }
      if (o.status === 'SERVED' || o.status === 'WAITING_FOR_PAYMENT') {
        counts.SERVED++;
      }
      if (o.status === 'DELIVERED') {
        counts.DELIVERED++;
      }
      if (o.paymentStatus === 'PAID' || o.status === 'COMPLETED') {
        counts.PAID++;
      }
      if (o.status === 'CANCELLED') {
        counts.CANCELLED++;
      }
    });
    return counts;
  }, [orders]);

  // Quick navigation counts for Dine In, Takeaway, Room Service, and Online
  const quickNavCounts = useMemo(() => {
    const counts = {
      ALL: orders.length,
      DINE_IN: 0,
      TAKEAWAY: 0,
      ROOM: 0,
      ONLINE: 0
    };
    orders.forEach((o) => {
      if (o.orderType === 'Dine-in') counts.DINE_IN++;
      if (o.orderType === 'Takeaway') counts.TAKEAWAY++;
      if (o.orderType === 'Room Service') counts.ROOM++;
      const isOnline = o.userId !== 'usr-staff' && o.userId !== 'usr-admin-001' && o.userId !== 'admin';
      if (isOnline) counts.ONLINE++;
    });
    return counts;
  }, [orders]);

  const activeFiltersCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0) +
    (dateFilter !== 'ALL' ? 1 : 0) +
    (paymentFilter !== 'ALL' ? 1 : 0) +
    (channelFilter !== 'ALL' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const resetAllFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setDateFilter('ALL');
    setPaymentFilter('ALL');
    setChannelFilter('ALL');
    setSearchQuery('');
    setPresetSelection('ALL');
    setCustomFrom('');
    setCustomTo('');
  };

  const getDateFilterLabel = () => {
    if (presetSelection === 'ALL') return 'All Dates';
    if (presetSelection === 'TODAY') return 'Today';
    if (presetSelection === 'LAST_7_DAYS') return 'Last 7 Days';
    if (presetSelection === 'LAST_30_DAYS') return 'Last 30 Days';
    if (presetSelection === 'CUSTOM') {
      if (customFrom && customTo) {
        return `${formatDisplayDate(customFrom)} – ${formatDisplayDate(customTo)}`;
      }
      if (customFrom) return `From ${formatDisplayDate(customFrom)}`;
      if (customTo) return `To ${formatDisplayDate(customTo)}`;
      return 'Custom Range';
    }
    return 'Select Date';
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Primary View Toggle */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">
              Kitchen & Dining Orders Log
            </h1>
          </div>
        </div>

        {/* 2. Elegant Status Filter Chips (Cleanly aligned single-row with smooth scroll) */}
        <div className="pt-2 border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            ...(canViewAllOrders ? [{ id: 'ALL', label: 'All Orders', count: statusCounts.ALL }] : []),
            { id: 'NEW_ORDER', label: 'New Order', count: statusCounts.NEW_ORDER },
            { id: 'CONFIRMED', label: 'Order Accepted', count: statusCounts.CONFIRMED },
            { id: 'READY', label: 'Order Ready', count: statusCounts.READY },
            { id: 'DISPATCHED_DELIVERY', label: 'Dispatched to Delivery', count: statusCounts.DISPATCHED_DELIVERY },
            { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', count: statusCounts.OUT_FOR_DELIVERY },
            { id: 'SERVED', label: 'Served', count: statusCounts.SERVED },
            { id: 'DELIVERED', label: 'Delivered', count: statusCounts.DELIVERED },
            { id: 'PAID', label: 'Paid', count: statusCounts.PAID },
            { id: 'CANCELLED', label: 'Cancelled', count: statusCounts.CANCELLED }
          ].map((item) => {
            const isSelected = statusFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-800 text-white font-bold shadow-2xs'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200/80'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200/70 text-stone-700'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>



        {/* 3. Secondary Filters: Search, Date Filter, Service Type, Payment & Channel */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-stone-100">
          {/* Search Box (3 cols) */}
          <div className="sm:col-span-3 flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="Search order, phone, table..."
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

          {/* Date Filter Module with Filter Icon similar to Dashboard (3 cols) */}
          <div className="sm:col-span-3 relative" ref={dateFilterRef}>
            <button
              type="button"
              onClick={() => setDateFilterOpen(!dateFilterOpen)}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                dateFilterOpen || presetSelection !== 'ALL'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold shadow-2xs'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Filter className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">{getDateFilterLabel()}</span>
                {presetSelection !== 'ALL' && (
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
              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <span className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-amber-700" />
                    <span>Date Filter</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDateFilterOpen(false)}
                    className="p-1 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* From & To Date Pickers */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Custom Date Range
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-500">From</label>
                      <input
                        type="date"
                        value={customFrom}
                        max={todayStr}
                        min={minDateStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomFrom(val);
                          setPresetSelection('CUSTOM');
                          setDateFilter('CUSTOM');
                        }}
                        className="w-full px-2 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 text-stone-800 focus:outline-hidden focus:border-amber-700 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-stone-500">To</label>
                      <input
                        type="date"
                        value={customTo}
                        max={todayStr}
                        min={minDateStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomTo(val);
                          setPresetSelection('CUSTOM');
                          setDateFilter('CUSTOM');
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
                    { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
                    { id: 'LAST_30_DAYS', label: 'Last 30 Days' }
                  ].map((item) => (
                    <label
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'ALL') {
                          setPresetSelection('ALL');
                          setDateFilter('ALL');
                          setCustomFrom('');
                          setCustomTo('');
                        } else if (item.id === 'TODAY') {
                          setPresetSelection('TODAY');
                          setDateFilter('TODAY');
                          setCustomFrom(todayStr);
                          setCustomTo(todayStr);
                        } else if (item.id === 'LAST_7_DAYS') {
                          setPresetSelection('LAST_7_DAYS');
                          setDateFilter('LAST_7_DAYS');
                          const d = new Date();
                          d.setDate(d.getDate() - 6);
                          setCustomFrom(d.toISOString().split('T')[0]);
                          setCustomTo(todayStr);
                        } else if (item.id === 'LAST_30_DAYS') {
                          setPresetSelection('LAST_30_DAYS');
                          setDateFilter('LAST_30_DAYS');
                          const d = new Date();
                          d.setDate(d.getDate() - 29);
                          setCustomFrom(d.toISOString().split('T')[0]);
                          setCustomTo(todayStr);
                        }
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        presetSelection === item.id
                          ? 'bg-amber-50 text-amber-900 font-semibold'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="orderTimePreset"
                        checked={presetSelection === item.id}
                        onChange={() => {}}
                        className="text-amber-700 focus:ring-amber-600 h-3 w-3 cursor-pointer"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* Bottom Actions: Clear & Apply */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPresetSelection('ALL');
                      setDateFilter('ALL');
                      setCustomFrom('');
                      setCustomTo('');
                      setDateFilterOpen(false);
                    }}
                    className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilterOpen(false)}
                    className="px-3.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Service Type (2 cols) */}
          <div className="sm:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-hidden focus:border-amber-600 cursor-pointer"
            >
              <option value="ALL">All Service Types</option>
              <option value="Dine-in">🍽️ Dine-in</option>
              <option value="Room Service">🛏️ Room Service</option>
              <option value="Delivery">🏡 Delivery</option>
              <option value="Takeaway">📦 Takeaway</option>
            </select>
          </div>

          {/* Payment Status Filter (2 cols) */}
          <div className="sm:col-span-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-hidden focus:border-amber-600 cursor-pointer"
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">✅ Paid Only</option>
              <option value="UNPAID">⏳ Unpaid / Due</option>
            </select>
          </div>

          {/* Channel Filter (2 cols) */}
          <div className="sm:col-span-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-hidden focus:border-amber-600 cursor-pointer"
            >
              <option value="ALL">All Channels</option>
              <option value="ONLINE">🌐 Online Guest</option>
              <option value="POS">🏬 Staff POS</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Active Filter Indicator */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
            <span>
              Showing <strong>{filteredOrders.length}</strong> of {orders.length} orders
            </span>
            <button
              onClick={resetAllFilters}
              className="text-amber-800 hover:text-amber-900 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          </div>
        )}
      </div>



      {/* 4. ORDERS DISPLAY: CARDS VIEW OR TABLE VIEW */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900">
              No Orders Found
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
              No culinary orders match your search criteria or selected filters. Try changing or clearing filters.
            </p>
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        /* --- RICH CARDS GRID VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedOrders.map((order) => {
            const badge = getStaffWorkflowBadge(order.status);
            const isPaid = order.paymentStatus === 'PAID';
            const isOnline =
              order.userId !== 'usr-staff' && order.userId !== 'usr-admin-001' && order.userId !== 'admin';
            const isDue = !isPaid;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top: Order Number, Channel & Status */}
                <div className="p-4 border-b border-stone-100 bg-[#fdfcfb]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="font-mono font-bold text-sm text-stone-900 block">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono block">
                          {formatOrderDateTime(order.createdAt)}
                        </span>
                      </div>
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                          <Globe className="w-2.5 h-2.5 text-blue-600" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                          <Store className="w-2.5 h-2.5 text-amber-700" /> POS
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Customer & Location */}
                  <div className="flex items-center justify-between mt-2.5">
                    <div>
                      <p className="font-bold text-xs text-stone-900 leading-tight">
                        {order.customerName}
                      </p>
                      <p className="text-[10px] text-stone-400 font-mono mt-0.5 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-stone-400" />
                        {order.customerPhone}
                      </p>
                    </div>

                    {/* Service Type Tag */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-100 text-stone-800 font-semibold text-xs shrink-0">
                      {order.orderType === 'Dine-in' ? (
                        <>
                          <Utensils className="w-3.5 h-3.5 text-amber-800" />
                          <span>{order.tableNumber || 'Table Dining'}</span>
                        </>
                      ) : order.orderType === 'Room Service' ? (
                        <>
                          <BedDouble className="w-3.5 h-3.5 text-amber-800" />
                          <span>{order.roomNumber || 'Room Service'}</span>
                        </>
                      ) : order.orderType === 'Delivery' ? (
                        <span className="flex items-center gap-1 text-rose-900 bg-rose-100/90 px-2.5 py-0.5 rounded-lg font-bold border border-rose-200">
                          <Truck className="w-3.5 h-3.5 text-rose-700" />
                          <span>Home Delivery</span>
                        </span>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5 text-amber-800" />
                          <span>Takeaway Parcel</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Home Delivery Address Banner if Delivery */}
                  {order.orderType === 'Delivery' && order.deliveryAddress && (
                    <div className="mt-2.5 p-2 rounded-xl bg-rose-50/80 border border-rose-200/90 text-[11px] space-y-0.5">
                      <p className="font-bold text-rose-950 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                        <Truck className="w-3 h-3 text-rose-700 shrink-0" />
                        <span>Delivery Address:</span>
                      </p>
                      <p className="text-stone-800 leading-tight font-medium text-[11px] line-clamp-2">
                        {order.deliveryAddress}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Middle: Dish Items Breakdown */}
                <div className="p-4 flex-1 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-stone-400 pb-1 border-b border-stone-100">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-500">
                      Dishes Ordered ({order.items.length})
                    </span>
                    <span className="font-mono text-[10px]">
                      {formatTime(order.createdAt?.substring(11, 16))} • {formatDate(order.createdAt?.substring(0, 10))}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {order.items.map((item, idx) => (
                      <div key={item.id || idx} className="text-xs flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-stone-800">
                            {item.quantity}× {item.name}
                          </span>
                          {item.specialInstructions && (
                            <p className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded-sm inline-block mt-0.5">
                              Note: {item.specialInstructions}
                            </p>
                          )}
                        </div>
                        <span className="font-mono font-medium text-stone-600 text-xs shrink-0">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/70 text-[10px] text-stone-600">
                      <strong className="text-stone-800">Ticket Note: </strong>
                      {order.notes}
                    </div>
                  )}
                </div>

                {/* Card Pricing & Payment Ribbon */}
                <div className="px-4 py-2.5 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block leading-tight">
                      Order Total
                    </span>
                    <span className="font-serif font-bold text-base text-stone-900">
                      {formatCurrency(order.total)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-stone-600">
                      {order.paymentMethod}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                      }`}
                    >
                      {isPaid ? 'PAID' : 'DUE'}
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 border-t border-stone-200 bg-white space-y-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* View Details Modal */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Inspect full details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Add Dish */}
                    <button
                      type="button"
                      onClick={() => handleOpenAddItemsModal(order)}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Add more dishes to this order"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Dish</span>
                    </button>

                    {/* Billing & Invoice Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenBillingInvoice(order)}
                      disabled={generatingInvoiceId === order.id}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                        order.status === 'BILLING_PENDING' || order.customerStatus === 'DONE'
                          ? 'bg-amber-500 text-amber-950 border-amber-600 animate-pulse font-extrabold'
                          : 'bg-stone-900 hover:bg-black text-amber-300 border-stone-800'
                      }`}
                      title="Generate, Print, or View Tax Invoice"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        {generatingInvoiceId === order.id
                          ? 'Generating...'
                          : order.status === 'BILLING_PENDING' || order.customerStatus === 'DONE'
                          ? '🔔 Bill Requested'
                          : 'Bill'}
                      </span>
                    </button>

                    {/* Payment Action */}
                    {isDue && (
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(order)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-800" />
                        <span>Collect</span>
                      </button>
                    )}
                  </div>

                    {/* Primary Status Advancement Button */}
                    <div className="w-full pt-0.5 space-y-2">
                      {order.orderType === 'Delivery' ? (
                        /* Special Delivery Order Advancement workflow */
                        <>
                          {/* Display Assigned Rider Info Banner if rider is assigned */}
                          {order.deliveryRiderName && (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="font-bold text-amber-950 text-[11px] truncate flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                                  <span>Rider: {order.deliveryRiderName}</span>
                                </p>
                                <p className="text-[10px] text-stone-600 font-mono">{order.deliveryRiderPhone}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningRiderOrder(order);
                                  setSelectedRider(null);
                                }}
                                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
                              >
                                Change
                              </button>
                            </div>
                          )}

                          {order.status === 'PLACED' && (
                            canAcceptOrder ? (
                              <button
                                type="button"
                                disabled={processing}
                                onClick={() => handleExecuteStatus(order.id, 'CONFIRMED')}
                                className="w-full py-2.5 px-3 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                                <span>Accept Order</span>
                              </button>
                            ) : (
                              <div className="w-full py-2 px-3 bg-stone-100 text-stone-600 rounded-xl text-xs font-semibold text-center">
                                Awaiting Staff Acceptance
                              </div>
                            )
                          )}
                          {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && (
                            canMarkReady ? (
                              <button
                                type="button"
                                disabled={processing}
                                onClick={() => handleExecuteStatus(order.id, 'READY')}
                                className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <ChefHat className="w-4 h-4 text-emerald-200" />
                                <span>Order Ready 🍽️</span>
                              </button>
                            ) : (
                              <div className="w-full py-2 px-3 bg-orange-50 text-orange-900 border border-orange-200 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-orange-600 animate-spin" />
                                <span>Order Accepted (Cooking in Kitchen)</span>
                              </div>
                            )
                          )}
                          {order.status === 'READY' && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssigningRiderOrder(order);
                                setSelectedRider(null);
                              }}
                              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <Truck className="w-4 h-4 text-indigo-200 animate-bounce" />
                              <span>2. 🚴 Assign Delivery Rider</span>
                            </button>
                          )}
                          {order.status === 'DELIVERY_ASSIGNED' && (
                            <div className="space-y-2">
                              <div className="p-2.5 bg-amber-50 border border-amber-200/90 rounded-xl text-center space-y-1">
                                <p className="text-xs font-bold text-amber-950 flex items-center justify-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block shrink-0" />
                                  <span>Request Dispatched to {order.deliveryRiderName || 'Rider'}</span>
                                </p>
                                <p className="text-[10px] text-amber-800 font-medium">
                                  Awaiting acceptance on Delivery Boy Portal...
                                </p>
                              </div>

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningRiderOrder(order);
                                    setSelectedRider(null);
                                  }}
                                  className="flex-1 py-1.5 px-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center"
                                >
                                  Re-assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onUpdateStatus(order.id, 'DELIVERY_ACCEPTED').then(() => onRefresh())}
                                  className="flex-1 py-1.5 px-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200" />
                                  <span>Manual Accept</span>
                                </button>
                              </div>
                            </div>
                          )}
                        {order.status === 'DELIVERY_ACCEPTED' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(order.id, 'PICKED_UP').then(() => onRefresh())}
                            className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <PackageCheck className="w-4 h-4 text-purple-200" />
                            <span>4. Picked Up from Kitchen</span>
                          </button>
                        )}
                        {order.status === 'PICKED_UP' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(order.id, 'OUT_FOR_DELIVERY').then(() => onRefresh())}
                            className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Truck className="w-4 h-4 text-purple-200 animate-pulse" />
                            <span>5. Out for Delivery</span>
                          </button>
                        )}
                        {order.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(order.id, 'DELIVERED').then(() => onRefresh())}
                            className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <CheckCircle2 className="w-4 h-4 text-teal-200" />
                            <span>6. Rider Confirms Delivery</span>
                          </button>
                        )}
                        {order.status === 'DELIVERED' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(order.id, 'COMPLETED').then(() => onRefresh())}
                            className="w-full py-2 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <PackageCheck className="w-4 h-4 text-teal-200" />
                            <span>7. Complete & Close Order</span>
                          </button>
                        )}
                        {order.status === 'COMPLETED' && (
                          <span className="w-full py-2 px-3 bg-teal-50 text-teal-900 border border-teal-200 rounded-xl text-xs font-bold block text-center">
                            Delivered & Completed ✅
                          </span>
                        )}
                        {order.status === 'CANCELLED' && (
                          <span className="w-full py-2 px-3 bg-stone-100 text-stone-500 rounded-xl text-xs font-bold block text-center">
                            Cancelled
                          </span>
                        )}
                      </>
                    ) : (
                      /* Standard Dine-In / Takeaway / Room Service workflow */
                      <>
                        {order.status === 'PLACED' && (
                          canAcceptOrder ? (
                            <button
                              type="button"
                              disabled={processing}
                              onClick={() => handleExecuteStatus(order.id, 'CONFIRMED')}
                              className="w-full py-2.5 px-3 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <CheckCircle2 className="w-4 h-4 text-amber-200" />
                              <span>Accept Order</span>
                            </button>
                          ) : (
                            <div className="w-full py-2 px-3 bg-stone-100 text-stone-600 rounded-xl text-xs font-semibold text-center">
                              Awaiting Staff Acceptance
                            </div>
                          )
                        )}
                        {(order.status === 'CONFIRMED' || order.status === 'PREPARING') && (
                          canMarkReady ? (
                            <button
                              type="button"
                              disabled={processing}
                              onClick={() => handleExecuteStatus(order.id, 'READY')}
                              className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <ChefHat className="w-4 h-4 text-emerald-200" />
                              <span>Order Ready 🍽️</span>
                            </button>
                          ) : (
                            <div className="w-full py-2 px-3 bg-orange-50 text-orange-900 border border-orange-200 rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-orange-600 animate-spin" />
                              <span>Order Accepted (Cooking in Kitchen)</span>
                            </div>
                          )
                        )}
                        {order.status === 'READY' && (
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => handleExecuteStatus(order.id, 'SERVED')}
                            className="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Utensils className="w-4 h-4 text-indigo-200" />
                            <span>Mark Served to Customer</span>
                          </button>
                        )}
                        {(order.status === 'SERVED' || order.status === 'WAITING_FOR_PAYMENT') && (
                          <button
                            type="button"
                            onClick={() => handleExecuteStatus(order.id, 'COMPLETED')}
                            className="w-full py-2 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <PackageCheck className="w-4 h-4 text-teal-200" />
                            <span>Complete Payment</span>
                          </button>
                        )}
                        {order.status === 'COMPLETED' && (
                          <span className="w-full py-2 px-3 bg-teal-50 text-teal-900 border border-teal-200 rounded-xl text-xs font-bold block text-center">
                            Payment Completed ✅
                          </span>
                        )}
                        {order.status === 'CANCELLED' && (
                          <span className="w-full py-2 px-3 bg-stone-100 text-stone-500 rounded-xl text-xs font-bold block text-center">
                            Cancelled
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredOrders.length > 0 && (
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredOrders.length)}</strong> to{' '}
              <strong>{Math.min(currentPage * pageSize, filteredOrders.length)}</strong> of <strong>{filteredOrders.length}</strong> operational orders
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-stone-500 font-medium">Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 text-xs font-bold text-stone-800">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Order Details & Full Inspection */}
      {selectedOrder && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          title={`Order #${selectedOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            {/* Status Timeline */}
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
              <span className="text-[10px] uppercase font-bold text-stone-400 block mb-2">
                Order Fulfillment Progress
              </span>
              <OrderStatusTimeline status={selectedOrder.status} orderType={selectedOrder.orderType} />
            </div>

            {/* Customer & Service Info */}
            <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Customer</span>
                <p className="font-bold text-stone-900">{selectedOrder.customerName}</p>
                <p className="text-[10px] text-stone-500 font-mono">{selectedOrder.customerPhone}</p>
                <p className="text-[10px] text-stone-400">{selectedOrder.customerEmail}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Service Mode</span>
                <p className="font-bold text-stone-900">{selectedOrder.orderType}</p>
                {selectedOrder.tableNumber && (
                  <p className="text-[11px] text-amber-800 font-semibold">{selectedOrder.tableNumber}</p>
                )}
                {selectedOrder.roomNumber && (
                  <p className="text-[11px] text-amber-800 font-semibold">{selectedOrder.roomNumber}</p>
                )}
                {selectedOrder.deliveryAddress && (
                  <div className="mt-1">
                    <span className="text-[8px] uppercase font-bold text-amber-900 block">Delivery Address:</span>
                    <p className="text-[10px] text-stone-700 leading-tight font-medium bg-amber-50 p-1 border border-amber-200 rounded-md">{selectedOrder.deliveryAddress}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dishes Breakdown */}
            <div className="space-y-2 border border-stone-200 rounded-2xl p-3 bg-white">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Dishes ({selectedOrder.items.length})
              </span>
              <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                {selectedOrder.items.map((item, idx) => (
                  <div key={item.id || idx} className="py-1.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-stone-900">
                        {item.quantity}× {item.name}
                      </p>
                      {item.specialInstructions && (
                        <p className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-stone-900">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Tax (GST 5%):</span>
                <span>{formatCurrency(selectedOrder.tax)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Service Fee:</span>
                <span>{formatCurrency(selectedOrder.serviceCharge)}</span>
              </div>
              <div className="flex justify-between text-stone-900 font-bold border-t border-stone-200 pt-1 text-xs">
                <span>Total:</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. MODAL: Add Dishes to Order */}
      {editingOrder && (
        <Modal
          isOpen={true}
          onClose={() => setEditingOrder(null)}
          title={`Add Dishes to #${editingOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-500">
              Select dishes from the catalog to add to this active order. Kitchen will be updated automatically.
            </p>

            {/* Search dishes */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search dish name..."
                value={dishSearch}
                onChange={(e) => setDishSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-stone-200 rounded-xl p-2">
                {filteredMenuItems.map((dish) => (
                  <button
                    key={dish.id}
                    type="button"
                    onClick={() => setSelectedDishId(dish.id)}
                    className={`p-2 rounded-lg text-left text-xs transition-colors cursor-pointer border ${
                      selectedDishId === dish.id
                        ? 'bg-amber-100 border-amber-400 font-bold'
                        : 'bg-stone-50 hover:bg-stone-100 border-stone-200'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="truncate">{dish.name}</span>
                      <span className="font-mono">{formatCurrency(dish.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity and special instruction */}
            {selectedDishId && (
              <div className="space-y-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-stone-700">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDishQuantity(Math.max(1, dishQuantity - 1))}
                      className="px-2 py-0.5 bg-white border border-stone-200 rounded-lg font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold font-mono">{dishQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setDishQuantity(dishQuantity + 1)}
                      className="px-2 py-0.5 bg-white border border-stone-200 rounded-lg font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Special instructions for kitchen (optional)..."
                  value={dishInstructions}
                  onChange={(e) => setDishInstructions(e.target.value)}
                  className="w-full px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs"
                />

                <button
                  type="button"
                  onClick={handleStageDish}
                  className="w-full py-1.5 bg-amber-800 text-white font-bold rounded-lg text-xs cursor-pointer hover:bg-amber-900"
                >
                  + Stage Dish to Order
                </button>
              </div>
            )}

            {/* Staged Dishes List */}
            {stagedItems.length > 0 && (
              <div className="space-y-2 border border-stone-200 rounded-xl p-3 bg-white">
                <span className="font-bold text-stone-800 block text-xs">
                  Staged Items to Dispatch ({stagedItems.length})
                </span>
                <div className="divide-y divide-stone-100">
                  {stagedItems.map((item) => (
                    <div key={item.menuItemId} className="py-1 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-stone-800">
                          {item.quantity}× {item.name}
                        </span>
                        {item.specialInstructions && (
                          <span className="text-[10px] text-stone-500 block">
                            Note: {item.specialInstructions}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedDish(item.menuItemId)}
                          className="text-stone-400 hover:text-rose-600 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stagedItems.length === 0 || submittingAddItems}
                onClick={handleSaveAdditionalDishes}
                className="px-4 py-1.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold rounded-lg text-xs"
              >
                {submittingAddItems ? 'Saving...' : 'Confirm & Dispatch to Kitchen'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. MODAL: Payment Collection */}
      {paymentModalOrder && (
        <Modal
          isOpen={true}
          onClose={() => setPaymentModalOrder(null)}
          title={`Collect Payment #${paymentModalOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div className="flex justify-between items-center">
                <span className="text-stone-600 font-medium">Guest Name:</span>
                <span className="font-bold text-stone-900">{paymentModalOrder.customerName}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-stone-600 font-medium">Outstanding Bill:</span>
                <span className="font-serif font-bold text-base text-amber-800">
                  {formatCurrency(paymentModalOrder.total)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-stone-700 block">Payment Method Received</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Cash', 'Card', 'UPI'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      selectedPaymentMethod === method
                        ? 'bg-amber-800 text-white border-amber-800 shadow-2xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {method === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                    {method === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                    {method === 'UPI' && <DollarSign className="w-3.5 h-3.5" />}
                    <span>{method}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOrder(null)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingPayment}
                onClick={handleSavePaymentStatus}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs"
              >
                {submittingPayment ? 'Recording...' : `Mark as PAID (${formatCurrency(paymentModalOrder.total)})`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. MODAL: Billing Tax Invoice & Print/Share */}
      {invoiceModalData && (
        <InvoiceViewModal
          invoice={invoiceModalData}
          isOpen={true}
          onClose={() => setInvoiceModalData(null)}
          onPaymentSuccess={() => {
            onRefresh();
          }}
          isStaffOrAdmin={true}
        />
      )}

      {/* 9. MODAL: Assign Delivery Rider Popup */}
      {assigningRiderOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-amber-900 to-amber-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                  <Truck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Assign Delivery Rider</h3>
                  <p className="text-xs text-amber-200 font-mono">Order #{assigningRiderOrder.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningRiderOrder(null)}
                className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Summary context */}
            <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-900 text-sm">
                  Customer: {assigningRiderOrder.customerName}
                </span>
                <span className="font-mono font-bold text-amber-900">{assigningRiderOrder.customerPhone}</span>
              </div>
              {assigningRiderOrder.deliveryAddress && (
                <p className="text-stone-700 flex items-start gap-1 font-medium text-[11px] leading-tight pt-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{assigningRiderOrder.deliveryAddress}</span>
                </p>
              )}
            </div>

            {/* Delivery Rider Selection Cards */}
            <div className="p-5 space-y-2.5 max-h-72 overflow-y-auto">
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Select Available ABC Hotel Delivery Personnel:
              </p>
              {deliveryPartners.map((rider) => {
                const isSelected = selectedRider?.id === rider.id;
                return (
                  <div
                    key={rider.id}
                    onClick={() => setSelectedRider(rider)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-50 border-amber-800 ring-2 ring-amber-800/20 shadow-xs'
                        : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-stone-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'}`}>
                        🚴
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-stone-900 text-xs truncate">{rider.name}</h4>
                        <p className="text-[10px] text-stone-500 font-mono truncate">{rider.phone} • {rider.vehicle}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {rider.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssigningRiderOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRider || isAssigning}
                onClick={handleConfirmRiderAssignment}
                className="px-5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                <span>{isAssigning ? 'Dispatching...' : 'Assign & Dispatch to Rider'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Archive Lookup Modal */}
      <Modal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title="Historical Orders Archive (> 30 Days)"
      >
        <div className="space-y-4 text-xs text-stone-700">
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-stone-600 text-xs">
            <p>
              Search and inspect archived transactional records. These records were archived by the automated data retention job after passing full financial reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search archived order #, customer phone or name..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchArchive();
                }}
                className="w-full pl-8 pr-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:outline-hidden focus:border-amber-700"
              />
            </div>
            <button
              onClick={handleSearchArchive}
              disabled={loadingArchive}
              className="px-4 py-2 bg-amber-800 text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-amber-900 disabled:opacity-50"
            >
              {loadingArchive ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                  <th className="py-2 px-3">Order #</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {archiveOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-400">
                      {loadingArchive ? 'Loading archive records...' : 'No archived orders matching your query.'}
                    </td>
                  </tr>
                ) : (
                  archiveOrdersList.map((ao) => (
                    <tr key={ao.id} className="hover:bg-stone-50">
                      <td className="py-2 px-3 font-mono font-bold text-stone-900">#{ao.orderNumber}</td>
                      <td className="py-2 px-3 text-stone-500 font-mono">{formatDate(ao.createdAt)}</td>
                      <td className="py-2 px-3 font-semibold text-stone-800">{ao.customerName}</td>
                      <td className="py-2 px-3 font-serif font-bold text-stone-900">{formatCurrency(ao.total)}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-stone-100 text-stone-700 border border-stone-200">
                          {ao.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => setSelectedOrder(ao)}
                          className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded text-[10px] font-bold cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};
