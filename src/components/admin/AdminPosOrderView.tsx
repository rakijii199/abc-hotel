/**
 * Staff POS & Order Entry Module (Enhanced with Date Navigation & Day Order Log)
 * Ergonomic POS Station for fast table-side, room-service, and takeaway ordering
 * Features:
 * - Default current date selected with ability to go back up to 1 month (30 days)
 * - Seamless toggle between "Take New Order" and "View Day's Orders"
 * - Clear human-readable date format (e.g. "Wed, 30 Sep 2026")
 * - Direct table, room-service, and counter order terminal with instant dispatch to KDS
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Utensils,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  Printer,
  ShoppingBag,
  BedDouble,
  CreditCard,
  Banknote,
  ChefHat,
  MessageSquare,
  X,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Eye,
  RotateCcw,
  Truck,
  Phone,
  Clock
} from 'lucide-react';
import { MenuItem, MenuCategory, DiningTable, Order, OrderType, PaymentMethod } from '../../types/index.ts';
import { AdminApi } from '../../api/index.ts';
import {
  formatCurrency,
  formatDisplayDate,
  formatOrderDateTime,
  getPast30DaysRange,
  getOrderStatusBadge,
  getStaffWorkflowBadge
} from '../../utils/formatters.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { DietaryBadge, Modal } from '../common/Footer.tsx';
import { RestaurantImage } from '../common/RestaurantImage.tsx';
import { ItemCustomizerModal } from '../menu/ItemCustomizer.tsx';
import { ItemSelection, describeSelection, hasCustomization, resolveItemConfiguration, selectionKey, startingPrice } from '../../../shared/menuConfig.ts';
import { OrderLineChoices } from '../orders/OrderLineChoices.tsx';
import { Portal } from '../common/Portal.tsx';

interface AdminPosOrderViewProps {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  tables: DiningTable[];
  onOrderCreated: (order: Order) => void;
  onNavigateToOrders?: () => void;
  onNavigateToKds?: () => void;
}

interface PosCartItem {
  /** Item + chosen portion/add-ons (one dish can be on the ticket with different choices). */
  lineId: string;
  menuItem: MenuItem;
  quantity: number;
  specialInstructions: string;
  selection: ItemSelection;
}

/** Unit price from the item's configuration (the server re-prices on submit). */
function posUnitPrice(item: PosCartItem): number {
  try {
    return resolveItemConfiguration(item.menuItem, item.selection).unitPrice;
  } catch {
    return item.menuItem.price;
  }
}

export const AdminPosOrderView: React.FC<AdminPosOrderViewProps> = ({
  menuItems,
  categories,
  tables,
  onOrderCreated,
  onNavigateToOrders,
  onNavigateToKds
}) => {
  const navigateOrders = onNavigateToOrders || onNavigateToKds;
  const { error, success } = useToast();

  // 1-Month Date Range (Current date selected by default, can go back up to 30 days)
  const { today: todayStr, yesterday: yesterdayStr, minDate: minDateStr } = useMemo(() => getPast30DaysRange(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // View Mode: Take New Order vs. View Orders for Selected Date
  const [posViewMode, setPosViewMode] = useState<'TAKE_ORDER' | 'VIEW_ORDERS'>('TAKE_ORDER');

  // Day Orders State
  const [dayOrders, setDayOrders] = useState<Order[]>([]);
  const [loadingDayOrders, setLoadingDayOrders] = useState<boolean>(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  // Order Parameters
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [selectedTable, setSelectedTable] = useState<string>(tables[0]?.tableNumber || 'Table 01');
  const [roomNumber, setRoomNumber] = useState<string>('Suite 201');
  const [customerName, setCustomerName] = useState<string>('Walk-in Guest');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('guest@abchotel.com');
  const [notes, setNotes] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);

  // Payment Defaults (Pending until food is served and bill settled)
  const paymentMethod: PaymentMethod = 'Cash';
  const paymentStatus: 'PENDING' | 'PAID' = 'PENDING';

  // Dish Catalog Filters
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vegFilter, setVegFilter] = useState<boolean>(false);

  // POS Cart Items
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customizingDish, setCustomizingDish] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dispatchedOrder, setDispatchedOrder] = useState<Order | null>(null);

  const isToday = selectedDate === todayStr;

  // Fetch orders for selected date
  const fetchDayOrders = async (targetDate: string = selectedDate) => {
    setLoadingDayOrders(true);
    try {
      const res = await AdminApi.getAllOrders({
        startDate: targetDate,
        endDate: targetDate,
        pageSize: 100
      });
      setDayOrders(res || []);
    } catch {
      // Fallback
    } finally {
      setLoadingDayOrders(false);
    }
  };

  useEffect(() => {
    fetchDayOrders(selectedDate);
  }, [selectedDate]);

  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const nextStr = current.toISOString().split('T')[0];
    if (nextStr < minDateStr || nextStr > todayStr) return;
    setSelectedDate(nextStr);
  };

  // Filtered dishes in catalog
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCatId !== 'all' && item.categoryId !== selectedCatId) return false;
      if (vegFilter && !item.vegetarian) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, selectedCatId, vegFilter, searchQuery]);

  // Filtered day orders
  const filteredDayOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return dayOrders;
    const q = orderSearchQuery.toLowerCase().trim();
    return dayOrders.filter((o) => {
      const matchNum = o.orderNumber?.toLowerCase().includes(q);
      const matchCust = o.customerName?.toLowerCase().includes(q) || o.customerPhone?.toLowerCase().includes(q);
      const matchLoc = o.tableNumber?.toLowerCase().includes(q) || o.roomNumber?.toLowerCase().includes(q) || o.deliveryAddress?.toLowerCase().includes(q);
      const matchItem = o.items?.some((i) => i.name.toLowerCase().includes(q));
      return matchNum || matchCust || matchLoc || matchItem;
    });
  }, [dayOrders, orderSearchQuery]);

  // Add Item to Ticket
  const handleAddItem = (dish: MenuItem, selection?: ItemSelection, qty = 1) => {
    if (!dish.available) {
      error(`"${dish.name}" is currently marked unavailable.`);
      return;
    }
    // Dishes with portions/add-ons are configured first.
    if (!selection && hasCustomization(dish)) {
      setCustomizingDish(dish);
      return;
    }

    const chosen = selection || {};
    const lineId = selectionKey(dish.id, chosen);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.lineId === lineId);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...prev, { lineId, menuItem: dish, quantity: qty, specialInstructions: '', selection: chosen }];
    });
  };

  /** Dish-grid stepper: "+" adds (or opens the customizer), "-" reduces the latest line of that dish. */
  const handleDishStep = (dish: MenuItem, delta: number) => {
    if (delta > 0) {
      handleAddItem(dish);
      return;
    }
    const lines = cart.filter((i) => i.menuItem.id === dish.id);
    const last = lines[lines.length - 1];
    if (last) handleUpdateQty(last.lineId, -1);
  };

  const handleUpdateQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.lineId === lineId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as PosCartItem[];
    });
  };

  const handleUpdateInstruction = (lineId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.lineId === lineId ? { ...item, specialInstructions: instructions } : item
      )
    );
  };

  const handleRemoveItem = (lineId: string) => {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const handleClearTicket = () => {
    setCart([]);
    setNotes('');
  };

  // Re-order / Load items from historical order into current cart
  const handleLoadOrderIntoCart = (historicalOrder: Order) => {
    const newCartItems: PosCartItem[] = [];
    historicalOrder.items.forEach((item) => {
      const foundDish = menuItems.find((m) => m.id === item.menuItemId || m.name === item.name);
      if (foundDish) {
        const selection: ItemSelection = {
          ...(item.portionId ? { portionId: item.portionId } : {}),
          ...(item.addons && item.addons.length ? { addonIds: item.addons.map((a) => a.addonId) } : {})
        };
        // Skip lines whose options are no longer offered; staff can re-add them.
        try {
          resolveItemConfiguration(foundDish, selection);
        } catch {
          return;
        }
        newCartItems.push({
          lineId: selectionKey(foundDish.id, selection),
          menuItem: foundDish,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || '',
          selection
        });
      }
    });

    if (newCartItems.length === 0) {
      error('Could not find available dishes from this order in the current catalog.');
      return;
    }

    setCart(newCartItems);
    if (historicalOrder.customerName) setCustomerName(historicalOrder.customerName);
    if (historicalOrder.customerPhone) setCustomerPhone(historicalOrder.customerPhone);
    if (historicalOrder.orderType) setOrderType(historicalOrder.orderType);
    if (historicalOrder.tableNumber) setSelectedTable(historicalOrder.tableNumber);
    if (historicalOrder.roomNumber) setRoomNumber(historicalOrder.roomNumber);

    setPosViewMode('TAKE_ORDER');
    success(`Loaded ${newCartItems.length} items from #${historicalOrder.orderNumber} into active POS ticket!`);
  };

  // Calculations
  const totalItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const subtotal = cart.reduce((acc, curr) => acc + posUnitPrice(curr) * curr.quantity, 0);
  const discountAmount = discountCode.trim().toUpperCase() === 'WELCOME10' ? Math.round(subtotal * 0.1) : 0;
  const taxable = Math.max(0, subtotal - discountAmount);
  const tax = Math.round(taxable * 0.05); // 5% GST
  const serviceCharge = orderType === 'Takeaway' ? 0 : 40;
  const grandTotal = taxable + tax + serviceCharge;

  // Submit & Dispatch to Kitchen
  const handleDispatchToKitchen = async () => {
    if (cart.length === 0) {
      error('Please add at least one dish to the order ticket.');
      return;
    }

    const finalCustomerName = customerName.trim() || 'Walk-in Guest';
    const finalCustomerPhone = customerPhone.trim() || '—';

    setSubmitting(true);
    try {
      const payload = {
        orderType,
        tableNumber: orderType === 'Dine-in' ? selectedTable : undefined,
        roomNumber: orderType === 'Room Service' ? roomNumber : undefined,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        customerEmail: customerEmail.trim() || 'guest@abchotel.com',
        paymentMethod,
        paymentStatus,
        initialStatus: 'PLACED', // Dispatched directly as New Order to kitchen queue
        discountCode: discountCode.trim() || undefined,
        notes: notes.trim() || undefined,
        orderDate: !isToday ? selectedDate : undefined,
        items: cart.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions.trim() || undefined,
          ...(i.selection.portionId ? { portionId: i.selection.portionId } : {}),
          ...(i.selection.addonIds && i.selection.addonIds.length ? { addonIds: i.selection.addonIds } : {})
        }))
      };

      const order = await AdminApi.createStaffOrder(payload);
      setDispatchedOrder(order);
      onOrderCreated(order);
      success(`Order #${order.orderNumber} successfully sent to Kitchen Department!`);
      setCart([]);
      fetchDayOrders(selectedDate);
    } catch (err: any) {
      error(err.message || 'Failed to dispatch order to kitchen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5 font-['Poppins',sans-serif]">
      {/* 2. MODE: VIEW ORDERS FOR SELECTED DATE */}
      {posViewMode === 'VIEW_ORDERS' ? (
        <div className="space-y-3">
          {/* Header Card for Day's Orders */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-[var(--shadow-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--brand-soft)] text-amber-800 border border-[var(--brand-border)] flex items-center justify-center font-bold text-xs shrink-0">
                POS
              </div>
              <div>
                <h1 className="section-title text-lg leading-tight">
                  Staff Order Terminal — Orders List
                </h1>
                <p className="text-[11px] text-stone-500">
                  Logged orders for {formatDisplayDate(selectedDate)}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search order #, guest..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs w-48 focus:outline-hidden focus:border-amber-700"
                />
              </div>

              <button
                onClick={() => fetchDayOrders(selectedDate)}
                disabled={loadingDayOrders}
                className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] text-stone-700 cursor-pointer transition-colors"
                title="Refresh orders list"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingDayOrders ? 'animate-spin text-amber-800' : ''}`} />
              </button>

              <button
                onClick={() => setPosViewMode('TAKE_ORDER')}
                className="px-3 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Take Order</span>
              </button>

              {navigateOrders && (
                <button
                  type="button"
                  onClick={navigateOrders}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                  <span>View Orders →</span>
                </button>
              )}
            </div>
          </div>

          {/* Orders List / Cards */}
          {loadingDayOrders ? (
            <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center text-xs text-stone-500">
              Loading orders for {formatDisplayDate(selectedDate)}...
            </div>
          ) : filteredDayOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-12 text-center space-y-3 shadow-[var(--shadow-card)]">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="section-title text-base">
                  No Orders Found for {formatDisplayDate(selectedDate)}
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
                  No orders were placed on this date. You can select another date from the past 30 days or take a new order.
                </p>
              </div>
              <button
                onClick={() => setPosViewMode('TAKE_ORDER')}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Take Order for {selectedDate}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDayOrders.map((order) => {
                const badge = getStaffWorkflowBadge(order.status);
                const isPaid = order.paymentStatus === 'PAID';

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-stone-200/80 shadow-[var(--shadow-card)] lift p-4 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Top: Order # & Status */}
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <div>
                          <span className="font-mono font-bold text-sm text-stone-900">
                            #{order.orderNumber}
                          </span>
                          <p className="text-[10px] text-stone-500 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{formatOrderDateTime(order.createdAt)}</span>
                          </p>
                        </div>

                        <span className={`badge ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Guest & Service Type */}
                      <div className="flex items-center justify-between mt-2.5 text-xs">
                        <div>
                          <p className="font-bold text-stone-900">{order.customerName}</p>
                          <p className="text-[10px] text-stone-500 font-mono">{order.customerPhone}</p>
                        </div>

                        <span className="px-2.5 py-1 rounded-xl bg-stone-100 text-stone-800 font-semibold text-xs flex items-center gap-1">
                          {order.orderType === 'Dine-in' ? (
                            <>
                              <Utensils className="w-3 h-3 text-amber-800" />
                              <span>{order.tableNumber || 'Table'}</span>
                            </>
                          ) : order.orderType === 'Room Service' ? (
                            <>
                              <BedDouble className="w-3 h-3 text-amber-800" />
                              <span>{order.roomNumber || 'Room'}</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3 h-3 text-amber-800" />
                              <span>Takeaway</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Dishes summary */}
                      <div className="mt-3 p-2 rounded-xl bg-stone-50 border border-stone-100 text-[11px] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-stone-500 block">
                          Dishes ({order.items.length} items):
                        </span>
                        <div className="space-y-0.5 max-h-20 overflow-y-auto">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-stone-700">
                              <span>{it.quantity}× {it.name}<OrderLineChoices item={it} /></span>
                              <span className="font-mono text-stone-500">{formatCurrency(it.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Total & Actions */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-stone-500 block">Total Amount:</span>
                        <span className="font-serif font-bold text-sm text-stone-900 tabular-nums">
                          {formatCurrency(order.total)}
                        </span>
                        <span
                          className={`badge ml-1.5 !text-[9px] !px-1.5 !py-0 ${
                            isPaid
                              ? 'badge-success'
                              : 'badge-warning'
                          }`}
                        >
                          {isPaid ? 'PAID' : 'DUE'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInspectingOrder(order)}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                          title="Inspect Order Details"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => handleLoadOrderIntoCart(order)}
                          className="px-2.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                          title="Load dishes into current POS ticket"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Load to POS</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 3. MODE: TAKE NEW ORDER (POS STATION) */
        <div className="space-y-2.5">
          {/* Combined Staff Order Terminal & Service Parameters Card */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-[var(--shadow-card)] space-y-2">
            {/* Header Row: POS Icon, Title, Inline Order Channel, & KDS Link */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-7 h-7 rounded-lg bg-[var(--brand-soft)] text-amber-800 border border-[var(--brand-border)] flex items-center justify-center font-bold text-xs shrink-0">
                  POS
                </div>
                <h1 className="section-title text-lg leading-tight">
                  Staff Order Terminal
                </h1>

                {/* Integrated Order Channel Selector */}
                <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                  <span className="text-xs font-bold text-stone-600 hidden sm:inline">Order Channel:</span>
                  <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setOrderType('Dine-in')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs ${
                        orderType === 'Dine-in'
                          ? 'bg-amber-800 text-white font-bold shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <Utensils className="w-3.5 h-3.5" /> Dine-in
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('Room Service')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs ${
                        orderType === 'Room Service'
                          ? 'bg-amber-800 text-white font-bold shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <BedDouble className="w-3.5 h-3.5" /> Room
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('Takeaway')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs ${
                        orderType === 'Takeaway'
                          ? 'bg-amber-800 text-white font-bold shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Takeaway
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isToday && (
                  <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg font-medium">
                    For {formatDisplayDate(selectedDate)}
                  </div>
                )}

                {navigateOrders && (
                  <button
                    type="button"
                    onClick={navigateOrders}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                    <span>View Orders →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Form Fields: Table / Room & Guest details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="label-caps block mb-0.5">
                  {orderType === 'Dine-in' ? 'Dining Table' : orderType === 'Room Service' ? 'Room / Suite #' : 'Order Mode'}
                </label>
                {orderType === 'Dine-in' ? (
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-hidden focus:border-amber-600"
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.tableNumber}>
                        {t.tableNumber} • {t.location} ({t.capacity} Seats)
                      </option>
                    ))}
                  </select>
                ) : orderType === 'Room Service' ? (
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. Suite 305"
                    className="w-full px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-hidden focus:border-amber-600"
                  />
                ) : (
                  <div className="px-2.5 py-1 bg-amber-50/70 border border-amber-200 rounded-lg text-xs font-bold text-amber-900">
                    📦 Parcel Counter Pickup
                  </div>
                )}
              </div>

              <div>
                <label className="label-caps block mb-0.5">
                  Guest Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Guest Name"
                  className="w-full px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 font-semibold focus:outline-hidden focus:border-amber-600"
                />
              </div>

              <div>
                <label className="label-caps block mb-0.5">
                  Guest Mobile #
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 font-semibold focus:outline-hidden focus:border-amber-600"
                />
              </div>
            </div>
          </div>

          {/* POS Workspace: Dish Menu & Pinned KOT Ticket */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Dish Catalog (7-8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-3">
              {/* Category Pills & Search Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-[var(--shadow-card)] space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search dish by name, ingredient, or spice..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:border-amber-600"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setVegFilter(!vegFilter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
                      vegFilter
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                        : 'bg-white text-stone-600 hover:bg-stone-50 border-stone-200'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Pure Veg</span>
                  </button>
                </div>

                {/* Category Pills Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSelectedCatId('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedCatId === 'all'
                        ? 'bg-amber-800 text-white shadow-2xs border border-amber-800'
                        : 'bg-white hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] text-stone-700 border border-stone-200'
                    }`}
                  >
                    All Dishes ({menuItems.length})
                  </button>
                  {categories.map((c) => {
                    const count = menuItems.filter((i) => i.categoryId === c.id).length;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCatId(c.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          selectedCatId === c.id
                            ? 'bg-amber-800 text-white shadow-2xs border border-amber-800'
                            : 'bg-white hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] text-stone-700 border border-stone-200'
                        }`}
                      >
                        {c.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dish Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredItems.map((dish) => {
                  const dishQty = cart.filter((i) => i.menuItem.id === dish.id).reduce((sum, i) => sum + i.quantity, 0);
                  const inCart = dishQty > 0 ? { quantity: dishQty } : null;
                  const isAvailable = dish.available;

                  return (
                    <div
                      key={dish.id}
                      className={`bg-white rounded-2xl border p-2.5 flex flex-col justify-between transition-all group ${
                        inCart
                          ? 'border-amber-400 ring-2 ring-amber-500/10 shadow-xs'
                          : 'border-stone-200/80 hover:border-[var(--brand-border)] hover:shadow-[var(--shadow-raised)] shadow-[var(--shadow-xs)]'
                      } ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div>
                        {/* Dish Image */}
                        <div className="w-full h-24 rounded-xl overflow-hidden bg-stone-100 mb-2 relative border border-stone-100/80">
                          <RestaurantImage
                            src={dish.imageUrl}
                            alt={dish.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {!isAvailable && (
                            <span className="absolute inset-0 bg-black/55 text-white font-bold text-[10px] uppercase flex items-center justify-center tracking-wider">
                              Sold Out
                            </span>
                          )}
                        </div>

                        {/* Top: Name & Veg Badge */}
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-bold text-xs text-stone-900 leading-tight">
                            {dish.name}
                          </h4>
                          <span
                            className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 ${
                              dish.vegetarian
                                ? 'border-emerald-600 bg-emerald-50'
                                : 'border-rose-600 bg-rose-50'
                            }`}
                            title={dish.vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                dish.vegetarian ? 'bg-emerald-600' : 'bg-rose-600'
                              }`}
                            />
                          </span>
                        </div>

                        {/* Description */}
                        {dish.description && (
                          <p className="text-[11px] text-stone-500 line-clamp-1 mt-1 leading-snug">
                            {dish.description}
                          </p>
                        )}
                      </div>

                      {/* Bottom Row: Price & Quantity Controller */}
                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-stone-100">
                        <span className="font-serif font-bold text-sm text-stone-900 tabular-nums">
                          {hasCustomization(dish) ? `From ${formatCurrency(startingPrice(dish))}` : formatCurrency(dish.price)}
                        </span>

                        {inCart ? (
                          <div className="flex items-center bg-amber-50 border border-amber-300 rounded-xl p-0.5">
                            <button
                              type="button"
                              onClick={() => handleDishStep(dish, -1)}
                              className="p-1 hover:bg-amber-200/70 rounded-lg text-amber-900 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 font-mono font-bold text-xs text-amber-950">
                              {inCart.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDishStep(dish, 1)}
                              className="p-1 hover:bg-amber-200/70 rounded-lg text-amber-900 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => handleAddItem(dish)}
                            className="px-3 py-1 bg-[var(--brand-soft)] border border-[var(--brand-border)] hover:bg-amber-800 hover:border-amber-800 hover:text-white text-[var(--brand-text)] font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Pinned Sticky Live Order Ticket (KOT) */}
            <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4">
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs flex flex-col max-h-[calc(100vh-5rem)]">
                {/* Ticket Header with Formatted Date */}
                <div className="p-4 border-b border-stone-100 bg-stone-50 rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                        Kitchen Order Ticket (KOT)
                      </span>
                      <h3 className="section-title text-base">
                        {orderType === 'Dine-in'
                          ? selectedTable
                          : orderType === 'Room Service'
                          ? roomNumber
                          : 'Takeaway Order'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-mono text-[11px] font-bold">
                        {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                      </span>
                      {cart.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearTicket}
                          className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Clear Ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ticket Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-stone-100 min-h-[160px] max-h-[280px]">
                  {cart.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-stone-800">Ticket is Empty</p>
                      <p className="text-[11px] text-stone-400 max-w-[200px] mx-auto">
                        Click any dish from the menu catalog on the left to add items to this KOT.
                      </p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.lineId} className="pt-2 first:pt-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-stone-900 truncate">
                              {item.menuItem.name}
                            </p>
                            {(item.selection.portionId || item.selection.addonIds?.length) ? (
                              <p className="text-[10.5px] text-stone-600 truncate">
                                {describeSelection(resolveItemConfiguration(item.menuItem, item.selection))}
                              </p>
                            ) : null}
                            <p className="text-[10px] text-stone-500 font-mono">
                              {formatCurrency(posUnitPrice(item))} × {item.quantity} ={' '}
                              <strong className="text-stone-800 font-bold">
                                {formatCurrency(posUnitPrice(item) * item.quantity)}
                              </strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <div className="flex items-center bg-stone-50 border border-stone-200 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.lineId, -1)}
                                className="p-1 hover:bg-stone-200 rounded text-stone-700 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-1.5 font-mono font-bold text-xs text-stone-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.lineId, 1)}
                                className="p-1 hover:bg-stone-200 rounded text-stone-700 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setActiveNoteItemId(
                                  activeNoteItemId === item.lineId ? null : item.lineId
                                )
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                item.specialInstructions
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-stone-50 text-stone-400 hover:text-stone-700 border-stone-200'
                              }`}
                              title="Kitchen Instructions"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.lineId)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {activeNoteItemId === item.lineId && (
                          <div className="pt-1">
                            <input
                              type="text"
                              placeholder="Kitchen instructions (e.g. Less spicy, Extra butter)..."
                              value={item.specialInstructions}
                              onChange={(e) => handleUpdateInstruction(item.lineId, e.target.value)}
                              className="w-full px-2.5 py-1 text-[11px] bg-amber-50/50 border border-amber-200 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Ticket Notes */}
                {cart.length > 0 && (
                  <div className="p-3 border-t border-stone-100 bg-stone-50/50 space-y-2">
                    <input
                      type="text"
                      placeholder="Order Notes / Kitchen Special Request..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs focus:outline-hidden focus:border-amber-600"
                    />
                  </div>
                )}

                {/* Bill Summary & Dispatch Actions */}
                <div className="p-4 border-t border-stone-100 bg-stone-50 rounded-b-2xl space-y-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount (WELCOME10)</span>
                        <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-stone-600 text-[11px]">
                      <span>GST (5%)</span>
                      <span className="font-mono">{formatCurrency(tax)}</span>
                    </div>
                    {serviceCharge > 0 && (
                      <div className="flex justify-between text-stone-600 text-[11px]">
                        <span>Service Fee</span>
                        <span className="font-mono">{formatCurrency(serviceCharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-stone-900 pt-1 border-t border-stone-200">
                      <span>Grand Total</span>
                      <span className="font-mono text-base text-amber-800">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Big Dispatch Button */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || submitting}
                    onClick={handleDispatchToKitchen}
                    className="w-full py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <span>Dispatching to Kitchen...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-amber-200" />
                        Dispatch KOT ({formatCurrency(grandTotal)})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatched Confirmation Modal */}
      {dispatchedOrder && (
        <Portal>
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-[var(--shadow-float)] border border-stone-200 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                Dispatched to Kitchen
              </span>
              <h3 className="page-title mt-1">
                Order #{dispatchedOrder.orderNumber}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                KOT ticket successfully received by the kitchen. Chefs are alerted to begin cooking.
              </p>
            </div>

            {/* Quick KOT Slip (Poppins font, 12px text size, premium layout) */}
            <div className="bg-[var(--brand-soft)] border border-[var(--brand-border)] rounded-2xl p-4 text-left font-['Poppins',sans-serif] text-[12px] space-y-2.5 shadow-xs">
              <div className="flex justify-between border-b border-amber-200/80 pb-2 text-stone-900 font-bold text-[12px]">
                <span className="tracking-wide">
                  {dispatchedOrder.orderType.toUpperCase()} - {dispatchedOrder.tableNumber || dispatchedOrder.roomNumber || 'Takeaway'}
                </span>
                <span className="text-amber-900">{formatCurrency(dispatchedOrder.total)}</span>
              </div>
              <div className="text-[11px] text-stone-500 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span>Date: {formatOrderDateTime(dispatchedOrder.createdAt)}</span>
              </div>
              <div className="space-y-1.5 text-stone-800 max-h-36 overflow-y-auto text-[12px]">
                {dispatchedOrder.items.map((i) => (
                  <div key={i.id} className="flex justify-between items-center py-0.5 border-b border-amber-100/30 last:border-b-0">
                    <span className="font-medium">{i.quantity}× {i.name}<OrderLineChoices item={i} /></span>
                    <span className="text-stone-600 font-semibold">{formatCurrency(i.totalPrice)}</span>
                  </div>
                ))}
              </div>
              {dispatchedOrder.notes && (
                <div className="text-[11px] text-amber-900 border-t border-amber-200/80 pt-2 leading-relaxed">
                  <span className="font-bold">Instructions: </span>
                  <span className="italic">{dispatchedOrder.notes}</span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchedOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                Take Next Order
              </button>
              {navigateOrders && (
                <button
                  type="button"
                  onClick={() => {
                    setDispatchedOrder(null);
                    navigateOrders();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> View Orders
                </button>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Inspect Historical Order Modal */}
      {inspectingOrder && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingOrder(null)}
          title={`Order #${inspectingOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Placed:</span>
                <span className="font-mono font-bold text-stone-900">
                  {formatOrderDateTime(inspectingOrder.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-bold text-stone-900">{inspectingOrder.customerName} ({inspectingOrder.customerPhone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Order Channel:</span>
                <span className="font-bold text-stone-900">{inspectingOrder.orderType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Status:</span>
                <span className="font-bold text-stone-900">{inspectingOrder.paymentStatus} ({inspectingOrder.paymentMethod})</span>
              </div>
            </div>

            {/* Dishes list */}
            <div>
              <h4 className="font-bold text-stone-900 mb-2">Order Items ({inspectingOrder.items.length})</h4>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                {inspectingOrder.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center bg-white">
                    <div>
                      <p className="font-bold text-stone-900">{it.quantity}× {it.name}<OrderLineChoices item={it} /></p>
                      {it.specialInstructions && (
                        <p className="text-[10px] text-amber-800 italic">{it.specialInstructions}</p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-stone-900">{formatCurrency(it.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 font-mono text-xs space-y-1">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(inspectingOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Tax (GST 5%):</span>
                <span>{formatCurrency(inspectingOrder.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-stone-900 pt-1 border-t border-stone-200">
                <span>Total:</span>
                <span className="text-amber-800">{formatCurrency(inspectingOrder.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setInspectingOrder(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const o = inspectingOrder;
                  setInspectingOrder(null);
                  handleLoadOrderIntoCart(o);
                }}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Load Dishes to POS</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {customizingDish && (
        <ItemCustomizerModal
          isOpen={!!customizingDish}
          onClose={() => setCustomizingDish(null)}
          item={customizingDish}
          maxQuantity={50}
          confirmLabel="Add to Ticket"
          onConfirm={(selection, qty) => {
            handleAddItem(customizingDish, selection, qty);
            setCustomizingDish(null);
          }}
        />
      )}
    </div>
  );
};
