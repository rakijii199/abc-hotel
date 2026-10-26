/**
 * Live Order Status & Details Page
 * Supports:
 * 1. Pay at Exit orders with Payment Pending badge & instant "Pay Now" billing workflow
 * 2. Add-on orders ("+ Add More Items" modal to append extra dishes to active orders)
 * 3. Separate operational order status vs payment status badges
 * 4. Itemized original & add-on dishes breakdown with full subtotal/tax/discount
 * 5. Customer dining actions ("Request Bill" / "View Invoice" / "Pay Now")
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  PackageCheck,
  Clock,
  Receipt,
  ArrowLeft,
  RotateCcw,
  XCircle,
  PhoneCall,
  CheckCircle2,
  Printer,
  CreditCard,
  Truck,
  MapPin,
  Utensils,
  BedDouble,
  ShoppingBag,
  Sparkles,
  Plus,
  AlertCircle,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { Order } from '../types/index.ts';
import { OrderApi, PaymentApi, BillingApi } from '../api/index.ts';
import { OrderStatusTimeline } from '../components/orders/OrderStatusTimeline.tsx';
import { Spinner, Modal, EmptyState } from '../components/common/Footer.tsx';
import { formatCurrency, formatDate, getOrderStatusBadge, formatOrderDateTime } from '../utils/formatters.ts';
import { useToast } from '../context/ToastContext.tsx';
import { HotelUpiQrPaymentModal, PaymentModalMode } from '../components/payment/HotelUpiQrPaymentModal.tsx';
import { InvoiceViewModal } from '../components/billing/InvoiceViewModal.tsx';
import { AddonItemsModal } from '../components/orders/AddonItemsModal.tsx';
import { Invoice } from '../types/index.ts';
import { OrderLineChoices } from '../components/orders/OrderLineChoices.tsx';

export const OrderStatusPage: React.FC<{
  orderId?: string;
  navigate: (route: string, state?: any) => void;
}> = ({ orderId, navigate }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [invoiceOpen, setInvoiceOpen] = useState<boolean>(false);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);
  const [addonModalOpen, setAddonModalOpen] = useState<boolean>(false);
  const [requestingBill, setRequestingBill] = useState<boolean>(false);
  const [retryingPayment, setRetryingPayment] = useState<boolean>(false);
  const [upiModalOpen, setUpiModalOpen] = useState<boolean>(false);
  const [upiModalData, setUpiModalData] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentModalMode>('PHONEPE');
  const { error, success } = useToast();
  const previousPaymentStatusRef = useRef<string | null>(null);

  const handleRequestBill = async () => {
    if (!order) return;
    setRequestingBill(true);
    try {
      await BillingApi.requestBill(order.id);
      success('✓ Bill requested! Hotel staff has been notified to prepare your bill.');
      fetchOrder();
    } catch (err: any) {
      error(err.message || 'Failed to request bill.');
    } finally {
      setRequestingBill(false);
    }
  };

  const handleViewInvoice = async () => {
    if (!order) return;
    try {
      const inv = await BillingApi.getInvoice(order.id);
      if (inv) {
        setInvoiceData(inv);
        setInvoiceOpen(true);
      }
    } catch {
      error('Bill is being prepared by staff. Please try in a moment.');
    }
  };

  const fetchOrder = async (isBackground = false) => {
    if (!orderId) return;
    try {
      const data = await OrderApi.getOrderById(orderId);
      
      // If status changed from UNPAID/PENDING to PAID, show notification
      if (
        previousPaymentStatusRef.current &&
        previousPaymentStatusRef.current !== 'PAID' &&
        data.paymentStatus === 'PAID'
      ) {
        success(`✓ Payment Received! Order #${data.orderNumber} is confirmed.`);
      }
      previousPaymentStatusRef.current = data.paymentStatus;
      setOrder(data);

      try {
        const payData = await PaymentApi.getPaymentStatus(orderId);
        setPaymentInfo(payData);
      } catch {
        // ignore
      }
    } catch (err: any) {
      if (!isBackground) {
        error(err.message || 'Failed to fetch order details');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Polling interval (3s if pending, 6s if paid)
    const pollTime = (!order || order.paymentStatus !== 'PAID') ? 3000 : 6000;
    const interval = setInterval(() => fetchOrder(true), pollTime);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchOrder(true);
      }
    };
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [orderId, order?.paymentStatus]);

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      const updated = await OrderApi.cancelOrder(order.id);
      setOrder(updated);
      success('Order cancelled successfully.');
    } catch (err: any) {
      error(err.message || 'Unable to cancel order.');
    }
  };

  const handleLaunchPayment = async (selectedMode: PaymentModalMode = 'PHONEPE') => {
    if (!order) return;
    setRetryingPayment(true);
    setPaymentMode(selectedMode);
    try {
      const methodParam = selectedMode === 'CARD' ? 'Card' : 'UPI';
      const pOrder = await PaymentApi.createPaymentOrder(order.id, methodParam);
      setUpiModalData(pOrder);
      setUpiModalOpen(true);
    } catch (err: any) {
      error(err.message || 'Failed to initiate payment.');
    } finally {
      setRetryingPayment(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Spinner size="lg" />
        <p className="text-stone-500 font-medium text-sm">Retrieving real-time order status...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <EmptyState
          title="Order Not Found"
          description="We could not find the requested order. It may have expired or was removed."
          actionText="Go to My Orders"
          onAction={() => navigate('my-orders')}
        />
      </div>
    );
  }

  const badge = getOrderStatusBadge(order.status);
  const isTableDining = order.orderType === 'Dine-in' || Boolean(order.tableNumber) || Boolean(order.bookingReference);
  const isPayAtExit = order.paymentMethod === 'Pay at Exit' || order.paymentMethod === 'PAY_AT_EXIT';
  const isPaymentPending = order.paymentStatus !== 'PAID';
  const canAddMoreItems = order.status !== 'CANCELLED' && order.status !== 'COMPLETED';
  const billAlreadyRequested = order.status === 'BILLING_PENDING' || order.status === 'BILL_GENERATED';

  // Group items by Original vs Add-ons
  const originalItems = order.items.filter((i) => !i.isAddon);
  const addonItems = order.items.filter((i) => i.isAddon);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Back Nav & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('my-orders')}
          className="btn btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Orders</span>
        </button>

        <div className="flex items-center gap-2">
          {canAddMoreItems && (order.orderType === 'Dine-in' || order.orderType === 'Takeaway') && (
            <button
              onClick={() => setAddonModalOpen(true)}
              className="btn btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add More Items</span>
            </button>
          )}

          <button
            onClick={() => fetchOrder()}
            className="btn btn-secondary !px-2.5"
            title="Refresh Order"
            aria-label="Refresh order"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PAY AT EXIT / PAYMENT PENDING BANNER */}
      {isPaymentPending && order.status !== 'CANCELLED' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[var(--brand-soft)] via-white to-white border border-[var(--brand-border)] shadow-[var(--shadow-card)] space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-[var(--brand)] flex items-center justify-center font-bold text-xl border border-[var(--brand-border)] shadow-[var(--shadow-xs)] shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--brand-text)]">
                    {isPayAtExit ? 'Pay at Exit • Payment Pending' : 'Payment Pending'}
                  </span>
                  <span className="badge badge-warning !text-[9px] font-bold uppercase">
                    Bill Ready
                  </span>
                </div>
                <h3 className="section-title !text-lg sm:!text-xl">
                  Payable Amount: {formatCurrency(order.total)}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canAddMoreItems && (
                <button
                  onClick={() => setAddonModalOpen(true)}
                  className="btn btn-secondary"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--brand)]" />
                  <span>Add More Items</span>
                </button>
              )}

              <button
                onClick={() => handleLaunchPayment('PHONEPE')}
                disabled={retryingPayment}
                className="lux-btn lux-btn-wine !min-h-10 !px-5 !tracking-[0.1em] disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Now ({formatCurrency(order.total)})</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            {isPayAtExit
              ? 'Your order is being prepared by the kitchen. You can order additional dishes anytime and settle your bill online or at exit.'
              : 'Payment is pending for this order. Please complete payment to confirm settlement.'}
          </p>
        </div>
      )}

      {/* Main Status Header Card */}
      <div className="surface !rounded-2xl p-5 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps !text-[var(--brand-text)]">
                Order Details & Tracking
              </span>
              {isPayAtExit && (
                <span className="badge badge-success !text-[10px] font-bold uppercase tracking-wider">
                  Pay at Exit
                </span>
              )}
            </div>
            <h1 className="lux-display text-[clamp(1.9rem,4vw,2.6rem)] text-stone-900 mt-1.5">
              Order #{order.orderNumber}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 mt-1.5">
              <span>Placed on {formatOrderDateTime(order.createdAt)}</span>
              <span>•</span>
              <span className="font-semibold text-stone-800 flex items-center gap-1">
                {order.orderType === 'Dine-in' ? (
                  <>
                    <Utensils className="w-3.5 h-3.5 text-amber-700" />
                    <span>Dine-in {order.tableNumber ? `(${order.tableNumber})` : ''}</span>
                  </>
                ) : order.orderType === 'Room Service' ? (
                  <>
                    <BedDouble className="w-3.5 h-3.5 text-amber-700" />
                    <span>Room Service {order.roomNumber ? `(${order.roomNumber})` : ''}</span>
                  </>
                ) : order.orderType === 'Delivery' ? (
                  <>
                    <Truck className="w-3.5 h-3.5 text-rose-600" />
                    <span>Home Delivery</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                    <span>Takeaway</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Dual Badges: Operational Status + Payment Status */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-2xs ${badge.color}`}
            >
              {badge.label}
            </span>

            <span
              className={`badge !px-3 !py-1 !text-xs font-bold ${
                order.paymentStatus === 'PAID'
                  ? 'badge-success'
                  : 'badge-warning'
              }`}
            >
              {order.paymentStatus === 'PAID' ? '✓ Paid' : 'Payment Pending'}
            </span>
          </div>
        </div>

        {/* Live Stepper */}
        <OrderStatusTimeline status={order.status} orderType={order.orderType} />

        {/* Delivery Partner Tracking (Only for Home Delivery orders, never for Table orders) */}
        {order.orderType === 'Delivery' && !order.tableNumber && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-[var(--brand-border)] flex items-center justify-center shadow-[var(--shadow-xs)] shrink-0">
                  <Truck className="w-5 h-5 text-[var(--brand)]" />
                </div>
                <div>
                  <span className="label-caps !text-[10px] !text-[var(--brand-text)] block">
                    Dedicated Delivery Partner
                  </span>
                  <h3 className="font-bold text-base text-stone-900">
                    {order.deliveryRiderName ? `🚴 ${order.deliveryRiderName}` : 'Assigning Delivery Partner...'}
                  </h3>
                </div>
              </div>

              {order.deliveryRiderPhone && (
                <a
                  href={`tel:${order.deliveryRiderPhone}`}
                  className="btn btn-primary shrink-0"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Rider</span>
                </a>
              )}
            </div>

            {order.deliveryAddress && (
              <div className="p-3 rounded-xl bg-white border border-[var(--border-subtle)] text-xs space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-[var(--brand-text)] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[var(--brand)]" />
                  <span>Delivery Address:</span>
                </span>
                <p className="text-stone-700 font-medium leading-tight">{order.deliveryAddress}</p>
              </div>
            )}
          </div>
        )}

        {/* Cancel CTA if order is PLACED or CONFIRMED */}
        {(order.status === 'PLACED' || order.status === 'CONFIRMED') && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleCancelOrder}
              className="btn btn-secondary !text-rose-700 hover:!bg-rose-50 hover:!border-rose-200"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel Order</span>
            </button>
          </div>
        )}
      </div>

      {/* Order Items & Financial Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Items Breakdown */}
        <div className="md:col-span-2 surface !rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <h3 className="section-title flex items-center gap-2">
              <Utensils className="w-4 h-4 text-amber-700" />
              <span>Items Ordered ({order.items.length})</span>
            </h3>

            {canAddMoreItems && (order.orderType === 'Dine-in' || order.orderType === 'Takeaway') && (
              <button
                type="button"
                onClick={() => setAddonModalOpen(true)}
                className="text-xs font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] px-3 py-1.5 rounded-full border border-[var(--brand-border)] transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Dishes</span>
              </button>
            )}
          </div>

          {/* Original Items */}
          <div className="space-y-2.5">
            <p className="label-caps">
              Initial Order Dishes
            </p>
            {originalItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-xs py-2 border-b border-stone-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)] flex items-center justify-center font-bold font-mono shrink-0">
                    {item.quantity}×
                  </div>
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{item.name}<OrderLineChoices item={item} /></p>
                    {item.specialInstructions && (
                      <p className="text-[11px] text-[var(--brand-text)]">
                        Note: {item.specialInstructions}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-bold text-stone-900 text-sm">
                    {formatCurrency(item.totalPrice)}
                  </p>
                  <p className="text-[10px] text-stone-500 font-mono">
                    {formatCurrency(item.unitPrice)} each
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Add-on Items Section (if any) */}
          {addonItems.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-stone-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="label-caps !text-[var(--brand-text)] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Add-on Dishes Added During Dining ({addonItems.length})</span>
                </p>
                <span className="badge badge-warning !text-[9px] font-bold uppercase">
                  Active in Kitchen
                </span>
              </div>

              {addonItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-xs py-2.5 px-3 bg-[var(--brand-soft)] rounded-xl border border-[var(--brand-border)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center font-bold font-mono shrink-0">
                      {item.quantity}×
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-stone-900 text-sm">{item.name}<OrderLineChoices item={item} /></p>
                        <span className="badge badge-brand !text-[9px] font-bold">
                          + Add-on
                        </span>
                      </div>
                      {item.specialInstructions && (
                        <p className="text-[11px] text-[var(--brand-text)]">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-bold text-[var(--brand-text)] text-sm">
                      {formatCurrency(item.totalPrice)}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">
                      {formatCurrency(item.unitPrice)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Kitchen Notes */}
          {order.notes && (
            <div className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-xs">
              <span className="font-bold text-stone-700 block mb-0.5">Kitchen Note:</span>
              <p className="text-stone-600 italic">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right Col: Bill Summary & Settle Actions */}
        <div className="surface-raised !rounded-2xl p-5 sm:p-6 space-y-5 h-fit">
          <h3 className="section-title border-b border-stone-100 pb-3 flex items-center justify-between gap-2">
            <span>Bill Summary</span>
            <span className="badge font-mono !font-medium">
              {order.paymentMethod}
            </span>
          </h3>

          <div className="space-y-2 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(order.subtotal)}</span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount {order.discountCode ? `(${order.discountCode})` : ''}</span>
                <span className="font-mono">-{formatCurrency(order.discount)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>GST Tax (5%)</span>
              <span className="font-mono">{formatCurrency(order.tax)}</span>
            </div>

            <div className="flex justify-between">
              <span>Service Fee</span>
              <span className="font-mono">{formatCurrency(order.serviceCharge)}</span>
            </div>

            <div className="flex justify-between items-baseline text-base font-bold text-stone-900 pt-3 border-t border-dashed border-[var(--brand-border)]">
              <span className="font-display text-lg">Grand Total</span>
              <span className="font-display text-2xl font-bold text-[var(--brand-text)]">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>

          {/* Payment Status & Settle Actions */}
          <div className="pt-2 space-y-2.5">
            {isPaymentPending ? (
              <button
                type="button"
                onClick={() => handleLaunchPayment('PHONEPE')}
                disabled={retryingPayment}
                className="lux-btn lux-btn-wine w-full disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay {formatCurrency(order.total)} Now</span>
              </button>
            ) : (
              <div className="p-3 bg-[var(--success-soft)] rounded-xl border border-[var(--success-border)] text-center text-xs space-y-0.5">
                <span className="font-bold text-emerald-900 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Payment Complete</span>
                </span>
                <p className="text-[11px] text-emerald-700">Thank you for dining with ABC Hotel.</p>
              </div>
            )}

            {/* Dine-in guests ask staff for the bill when they are done */}
            {order.orderType === 'Dine-in' && isPaymentPending && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
              billAlreadyRequested ? (
                <div className="w-full py-2.5 px-3 bg-[var(--warning-soft)] text-amber-900 font-bold text-xs rounded-xl border border-[var(--warning-border)] flex items-center justify-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Bill requested — staff notified</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestBill}
                  disabled={requestingBill}
                  className="btn btn-primary w-full"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{requestingBill ? 'Requesting Bill…' : 'Request Bill'}</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={handleViewInvoice}
              className="btn btn-secondary w-full"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>View Itemized Bill / Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add-on Dishes Modal */}
      {addonModalOpen && order && (
        <AddonItemsModal
          isOpen={addonModalOpen}
          onClose={() => setAddonModalOpen(false)}
          order={order}
          onItemsAdded={(updated) => {
            setOrder(updated);
            fetchOrder();
          }}
        />
      )}

      {/* Invoice Viewer Modal */}
      {invoiceOpen && invoiceData && (
        <InvoiceViewModal
          isOpen={invoiceOpen}
          onClose={() => setInvoiceOpen(false)}
          invoice={invoiceData}
        />
      )}

      {/* Hotel Payment Modal (Pay via PhonePe, Google Pay, QR, Card) */}
      {upiModalOpen && order && (
        <HotelUpiQrPaymentModal
          orderId={order.id}
          orderNumber={order.orderNumber}
          amount={upiModalData?.amountInRupees || order.total}
          customerName={order.customerName}
          customerEmail={order.customerEmail}
          customerPhone={order.customerPhone}
          mode={paymentMode}
          initialPaymentData={upiModalData}
          onSuccess={() => {
            setUpiModalOpen(false);
            fetchOrder();
          }}
          onFailure={() => {
            fetchOrder();
          }}
          onClose={() => {
            setUpiModalOpen(false);
            fetchOrder();
          }}
          onReturnToMenu={() => {
            setUpiModalOpen(false);
            navigate('menu');
          }}
        />
      )}
    </div>
  );
};
