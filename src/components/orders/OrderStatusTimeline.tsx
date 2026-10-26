/**
 * Order Status Stepper & Enhanced Order Card Components
 * Reflects Staff & Kitchen Lifecycle:
 * - Order Placed -> Order Received -> Cooking Started -> Waiting to Serve -> Served -> Payment Completed
 */
import React from 'react';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  BellRing,
  PackageCheck,
  XCircle,
  CreditCard,
  DollarSign,
  Truck,
  Utensils,
  BedDouble,
  ShoppingBag,
  MapPin,
  ArrowRight,
  ReceiptText,
  Calendar
} from 'lucide-react';
import { Order, OrderStatus, OrderType } from '../../types/index.ts';
import { formatCurrency, formatDate, getOrderStatusBadge, formatOrderDateTime } from '../../utils/formatters.ts';

const STATUS_STEPS: Array<{ key: OrderStatus; label: string; icon: any; description: string }> = [
  { key: 'PLACED', label: 'Order Placed', icon: CheckCircle2, description: 'Order has been placed by the customer' },
  { key: 'CONFIRMED', label: 'Order Received', icon: Clock, description: 'Kitchen has received the order' },
  { key: 'PREPARING', label: 'Cooking Started', icon: ChefHat, description: 'Kitchen has started preparing the order' },
  { key: 'READY', label: 'Waiting to Serve', icon: BellRing, description: 'Order is ready and waiting to be served' },
  { key: 'SERVED', label: 'Served', icon: PackageCheck, description: 'Order has been served to the customer' },
  { key: 'COMPLETED', label: 'Done', icon: DollarSign, description: 'Payment completed & order closed' }
];

const DELIVERY_STATUS_STEPS: Array<{ key: string; label: string; icon: any; description: string }> = [
  { key: 'PLACED', label: 'Order Placed', icon: CheckCircle2, description: 'Delivery order placed successfully' },
  { key: 'PREPARING', label: 'Kitchen Preparing', icon: ChefHat, description: 'Chef is preparing your gourmet meal' },
  { key: 'READY', label: 'Food Prepared', icon: BellRing, description: 'Food prepared & assigned to rider' },
  { key: 'PICKED_UP', label: 'Picked Up', icon: PackageCheck, description: 'Rider picked up order from kitchen' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck, description: 'Rider is on the way to your address' },
  { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2, description: 'Order successfully delivered' }
];

export const OrderStatusTimeline: React.FC<{ status: OrderStatus; orderType?: OrderType }> = ({ status, orderType }) => {
  if (status === 'CANCELLED') {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800">
        <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
        <div>
          <h4 className="font-bold text-sm">Order Cancelled</h4>
          <p className="text-xs text-rose-600">This order was cancelled.</p>
        </div>
      </div>
    );
  }

  const isDelivery = orderType === 'Delivery';
  const steps = isDelivery ? DELIVERY_STATUS_STEPS : STATUS_STEPS;

  let effectiveStatus = status as string;
  if (isDelivery) {
    if (status === 'CONFIRMED') effectiveStatus = 'PLACED';
    if (status === 'DELIVERY_ASSIGNED') effectiveStatus = 'READY';
    if (status === 'DELIVERY_ACCEPTED') effectiveStatus = 'READY';
    if (status === 'COMPLETED') effectiveStatus = 'DELIVERED';
  } else {
    if (status === 'WAITING_FOR_PAYMENT') effectiveStatus = 'SERVED';
  }

  const currentIdx = steps.findIndex((s) => s.key === effectiveStatus);

  return (
    <div className="py-2 sm:py-4">
      <div className="relative flex items-center justify-between">
        {/* Horizontal Connecting Progress Line */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 rounded-full bg-stone-200/80 z-0" />
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-brand-400 to-[var(--brand)] transition-all duration-700 z-0"
          style={{
            width: `calc(${(Math.max(0, currentIdx) / (steps.length - 1)) * 100}% - 2rem)`
          }}
        />

        {steps.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? 'bg-[var(--brand)] text-white shadow-[var(--shadow-xs)]'
                    : isCurrent
                    ? 'bg-[var(--brand)] text-white ring-4 ring-[var(--brand-ring-soft)] shadow-[var(--shadow-raised)] scale-110'
                    : 'bg-white text-stone-400 border-2 border-stone-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] mt-1.5 font-bold text-center hidden sm:block ${
                  isCurrent ? 'text-[var(--brand-text)] font-bold' : isDone ? 'text-stone-700' : 'text-stone-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile Current Step Label */}
      <div className="mt-3 text-center sm:hidden">
        <span className="label-caps !text-[10px] !text-[var(--brand-text)] block">
          Current State
        </span>
        <p className="font-bold text-xs text-stone-900">
          {steps[currentIdx]?.label || status}
        </p>
        <p className="text-[11px] text-stone-500">
          {steps[currentIdx]?.description}
        </p>
      </div>
    </div>
  );
};

export const OrderCard: React.FC<{
  order: Order;
  onViewDetails?: (id: string) => void;
  onClick?: () => void;
}> = ({ order, onViewDetails, onClick }) => {
  const badge = getOrderStatusBadge(order.status);
  const isPaid = order.paymentStatus === 'PAID';

  const handleAction = () => {
    if (onClick) onClick();
    else if (onViewDetails) onViewDetails(order.id);
  };

  return (
    <div
      onClick={handleAction}
      className="surface lift !rounded-2xl p-5 flex flex-col justify-between space-y-4 cursor-pointer group"
    >
      {/* 1. Header: Order Number + Status Pill */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] px-2.5 py-1 rounded-lg border border-[var(--brand-border)]">
              #{order.orderNumber}
            </span>
            {/* Dining / Delivery Type Badge */}
            <span className="badge">
              {order.orderType === 'Dine-in' ? (
                <>
                  <Utensils className="w-3 h-3 text-amber-700" />
                  <span>Dine-in {order.tableNumber ? `(${order.tableNumber})` : ''}</span>
                </>
              ) : order.orderType === 'Room Service' ? (
                <>
                  <BedDouble className="w-3 h-3 text-amber-700" />
                  <span>Room {order.roomNumber || ''}</span>
                </>
              ) : order.orderType === 'Delivery' ? (
                <>
                  <Truck className="w-3 h-3 text-rose-600" />
                  <span>Delivery</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3 h-3 text-amber-700" />
                  <span>Takeaway</span>
                </>
              )}
            </span>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* 2. Order Metadata & Date */}
        <div className="pt-3 pb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{formatOrderDateTime(order.createdAt)}</span>
          </span>

          <span
            className={`badge !text-[10px] font-bold ${
              isPaid
                ? 'badge-success'
                : 'badge-warning'
            }`}
          >
            {isPaid ? '✓ Paid' : '⏳ Payment Pending'}
          </span>
        </div>

        {/* 3. Items Ordered List (Clear & Readable) */}
        <div className="bg-[var(--surface-muted)] rounded-xl p-3 border border-[var(--border-subtle)] space-y-1.5 mt-1">
          <span className="label-caps block">
            Ordered Items ({order.items.reduce((sum, item) => sum + item.quantity, 0)})
          </span>
          <div className="space-y-1 divide-y divide-stone-200/50">
            {order.items.map((item, idx) => (
              <div key={idx} className="pt-1 first:pt-0 flex items-center justify-between text-xs">
                <span className="text-stone-800 font-medium truncate max-w-[240px]">
                  <span className="font-bold text-stone-900 mr-1.5">{item.quantity}×</span>
                  {item.name}
                </span>
                <span className="font-mono text-stone-600 shrink-0 ml-2">
                  {formatCurrency(item.totalPrice ?? (item.unitPrice ? item.unitPrice * item.quantity : 0))}
                </span>
              </div>
            ))}
          </div>

          {/* Delivery Address (if Delivery order) */}
          {order.orderType === 'Delivery' && order.deliveryAddress && (
            <div className="pt-2 border-t border-stone-200/60 text-[11px] text-stone-600 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{order.deliveryAddress}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Footer: Total Amount & Action Button */}
      <div className="border-t border-stone-100 pt-3 flex items-center justify-between gap-3">
        <div>
          <span className="label-caps !text-[10px] block">
            Total Bill
          </span>
          <span className="font-display font-bold text-xl text-[var(--brand-text)]">
            {formatCurrency(order.total)}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAction();
          }}
          className="btn btn-primary shrink-0"
        >
          <span>Track Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
