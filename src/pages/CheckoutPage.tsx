/**
 * ABC Hotel — Checkout & Payment Workflow
 * 
 * Supported Payment Methods:
 * 1. PhonePe – Pay using the PhonePe app.
 * 2. Google Pay – Pay using the Google Pay app.
 * 3. Scan QR – Scan a QR code using any supported UPI app.
 * 4. Credit/Debit Card – Pay using a card.
 * 5. Pay at Exit – Place your order now and pay later (Dine-in & Takeaway only).
 */
import React, { useState, useEffect } from 'react';
import {
  Utensils,
  ShoppingBag,
  BedDouble,
  Truck,
  CreditCard,
  QrCode,
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  MapPin,
  Crosshair,
  Check,
  User,
  LogOut,
  Ban,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';
import { OrderType, PaymentMethod, TableBooking } from '../types/index.ts';
import { OrderApi, BookingApi, PaymentApi } from '../api/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatCurrency } from '../utils/formatters.ts';
import { HotelUpiQrPaymentModal, PaymentModalMode } from '../components/payment/HotelUpiQrPaymentModal.tsx';
import { DeliveryAddressModal, StructuredDeliveryAddress } from '../components/checkout/DeliveryAddressModal.tsx';

export type PaymentSelectionOption = 'PHONEPE' | 'GPAY' | 'QR' | 'CARD' | 'PAY_AT_EXIT';

export const CheckoutPage: React.FC<{
  navigate: (route: string, state?: any) => void;
}> = ({ navigate }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { items, subtotal, tax, discount, discountCode, serviceCharge, total, clearCart } =
    useCart();
  const { error, success } = useToast();

  // 1. Dining Service Details (Section 1)
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [bookingReference, setBookingReference] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // 2. Payment Selection (Section 2 - 5 Options)
  const [selectedPayment, setSelectedPayment] = useState<PaymentSelectionOption>('PAY_AT_EXIT');

  // Card Form State (Shown when Card is selected)
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');

  // 3. Guest Details (Section 3)
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');

  // Active bookings for quick linking
  const [myBookings, setMyBookings] = useState<TableBooking[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string>('');
  const [failedOrderRef, setFailedOrderRef] = useState<any | null>(null);

  // Delivery Address & Modal State
  const [addressModalOpen, setAddressModalOpen] = useState<boolean>(false);
  const [selectedAddressObj, setSelectedAddressObj] = useState<StructuredDeliveryAddress | null>(null);
  const [editingAddressObj, setEditingAddressObj] = useState<StructuredDeliveryAddress | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<StructuredDeliveryAddress[]>([]);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [paymentModalData, setPaymentModalData] = useState<{ order: any; pOrder: any } | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<PaymentModalMode>('PHONEPE');

  // QR Session Lock State
  const [isQrSession, setIsQrSession] = useState<boolean>(false);
  const [qrTableNumber, setQrTableNumber] = useState<string>('');

  // Detect QR Table Session on Mount
  useEffect(() => {
    try {
      const qrData = sessionStorage.getItem('abc_qr_table_session');
      if (qrData) {
        const parsed = JSON.parse(qrData);
        if (parsed.tableNumber) {
          setIsQrSession(true);
          setQrTableNumber(parsed.tableNumber);
          setTableNumber(parsed.tableNumber);
          setOrderType('Dine-in');
        }
      } else {
        const params = new URLSearchParams(window.location.search);
        const tNum = params.get('tableNumber') || params.get('tableId');
        if (tNum) {
          setIsQrSession(true);
          setQrTableNumber(tNum);
          setTableNumber(tNum);
          setOrderType('Dine-in');
        }
      }
    } catch {}
  }, []);

  // Rule: Is Online Payment Mandatory?
  const isOnlinePaymentMandatory = orderType === 'Room Service' || orderType === 'Delivery';

  // Automatically adjust payment mode if user switches to Room Service / Delivery while on Pay at Exit
  useEffect(() => {
    if (isOnlinePaymentMandatory && selectedPayment === 'PAY_AT_EXIT') {
      setSelectedPayment('PHONEPE');
    }
  }, [orderType, isOnlinePaymentMandatory, selectedPayment]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('login');
      return;
    }

    if (user) {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      setCustomerName(fullName);
      setCardHolder(fullName);
      setCustomerPhone(user.phone || '');
      setCustomerEmail(user.email || '');
    }

    async function loadBookings() {
      try {
        const bookings = await BookingApi.getMyBookings();
        const active = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'SEATED');
        setMyBookings(active);
        if (active.length > 0) {
          setBookingReference(active[0].bookingReference);
          setTableNumber(active[0].tableNumber || 'Table 03');
        }
      } catch {
        // ignore
      }
    }

    function loadSavedAddresses() {
      try {
        const existingStr = localStorage.getItem('abc_saved_delivery_addresses');
        let list: StructuredDeliveryAddress[] = existingStr ? JSON.parse(existingStr) : [];
        if (list.length > 0) {
          setSavedAddresses(list);
          setSelectedAddressObj(list[0]);
          setDeliveryAddress(list[0].formattedAddress);
        } else {
          setSavedAddresses([]);
          setSelectedAddressObj(null);
          setDeliveryAddress('');
        }
      } catch {}
    }

    loadBookings();
    loadSavedAddresses();
  }, [user, isAuthenticated, isLoading]);

  const handleSaveAddress = (savedAddress: StructuredDeliveryAddress) => {
    setSavedAddresses((prev) => {
      const existsIndex = prev.findIndex((a) => a.id === savedAddress.id);
      let updated: StructuredDeliveryAddress[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = savedAddress;
      } else {
        updated = [savedAddress, ...prev];
      }
      try {
        localStorage.setItem('abc_saved_delivery_addresses', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setSelectedAddressObj(savedAddress);
    setDeliveryAddress(savedAddress.formattedAddress);
    setEditingAddressObj(null);
  };

  const handleDeleteAddress = (id: string) => {
    setSavedAddresses((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem('abc_saved_delivery_addresses', JSON.stringify(updated));
      } catch {}

      if (selectedAddressObj?.id === id) {
        if (updated.length > 0) {
          setSelectedAddressObj(updated[0]);
          setDeliveryAddress(updated[0].formattedAddress);
        } else {
          setSelectedAddressObj(null);
          setDeliveryAddress('');
        }
      }
      return updated;
    });
    success('Delivery address removed.');
  };

  if (items.length === 0 && !failedOrderRef) {
    navigate('cart');
    return null;
  }

  // Handle Order Placement & Payment Workflow Launch
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !customerEmail) {
      error('Please fill in all customer contact details.');
      return;
    }

    if (orderType === 'Dine-in' && !tableNumber && !bookingReference) {
      error('Please select or specify your dining table number.');
      return;
    }

    if (orderType === 'Room Service' && !roomNumber) {
      error('Please specify your room or suite number.');
      return;
    }

    if (orderType === 'Delivery' && !deliveryAddress) {
      error('Please specify your delivery address.');
      return;
    }

    // Card Validation if Card is selected
    if (selectedPayment === 'CARD') {
      const cleanNum = cardNumber.replace(/\s+/g, '');
      if (cleanNum.length < 15) {
        error('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry || !cardExpiry.includes('/')) {
        error('Please enter a valid expiry date (MM/YY).');
        return;
      }
      if (cardCvv.length < 3) {
        error('Please enter a valid 3 or 4-digit CVV.');
        return;
      }
    }

    setSubmitting(true);
    setPaymentStatusMessage('');

    try {
      const backendPaymentMethod: PaymentMethod =
        selectedPayment === 'PAY_AT_EXIT'
          ? 'Pay at Exit'
          : selectedPayment === 'CARD'
          ? 'Card'
          : 'UPI';

      // 1. Reuse existing failed/pending order or create new order
      let createdOrder = failedOrderRef;

      if (!createdOrder) {
        createdOrder = await OrderApi.createOrder({
          orderType,
          tableNumber: orderType === 'Dine-in' ? tableNumber : undefined,
          bookingReference: orderType === 'Dine-in' ? bookingReference : undefined,
          roomNumber: orderType === 'Room Service' ? roomNumber : undefined,
          deliveryAddress: orderType === 'Delivery' ? deliveryAddress : undefined,
          customerName,
          customerPhone,
          customerEmail,
          paymentMethod: backendPaymentMethod,
          discountCode: discountCode || undefined,
          notes: notes.trim() || undefined,
          items: items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.quantity,
            specialInstructions: i.specialInstructions
          }))
        });
      }

      // 2. PAY AT EXIT WORKFLOW (Dine-in & Takeaway)
      if (selectedPayment === 'PAY_AT_EXIT') {
        clearCart();
        success(`Order #${createdOrder.orderNumber} placed successfully! Settle your bill at exit.`);
        navigate('order-status', { orderId: createdOrder.id });
        return;
      }

      // 3. ONLINE PAYMENT (PhonePe, Google Pay, Scan QR, Card)
      setPaymentStatusMessage(
        selectedPayment === 'PHONEPE'
          ? 'Connecting to PhonePe Gateway...'
          : selectedPayment === 'GPAY'
          ? 'Connecting to Google Pay Gateway...'
          : selectedPayment === 'QR'
          ? 'Generating Dynamic Hotel UPI QR Code...'
          : 'Initializing Secure Card Payment...'
      );

      const pOrder = await PaymentApi.createPaymentOrder(createdOrder.id, backendPaymentMethod);
      setPaymentModalData({ order: createdOrder, pOrder });

      const modeToSet: PaymentModalMode =
        selectedPayment === 'PHONEPE'
          ? 'PHONEPE'
          : selectedPayment === 'GPAY'
          ? 'GPAY'
          : selectedPayment === 'QR'
          ? 'QR'
          : 'CARD';

      setPaymentModalMode(modeToSet);
      setPaymentModalOpen(true);
      setSubmitting(false);
    } catch (err: any) {
      error(err.message || 'Unable to place your order. Please try again.');
      setSubmitting(false);
      setPaymentStatusMessage('');
    }
  };

  // Primary Button Text
  const getProceedButtonText = () => {
    if (submitting) return 'Processing Order & Payment...';
    if (failedOrderRef) return `Retry Payment (${formatCurrency(total)})`;
    if (selectedPayment === 'PAY_AT_EXIT') {
      return `Place Order – Pay at Exit (${formatCurrency(total)})`;
    }
    if (selectedPayment === 'PHONEPE') {
      return `Redirect to PhonePe (${formatCurrency(total)})`;
    }
    if (selectedPayment === 'GPAY') {
      return `Redirect to Google Pay (${formatCurrency(total)})`;
    }
    if (selectedPayment === 'QR') {
      return `Generate QR Code (${formatCurrency(total)})`;
    }
    return `Continue to Secure Payment (${formatCurrency(total)})`;
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">
            Step 2 of 2 • Dining & Payment
          </span>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-stone-900 leading-tight">
            Checkout & Order Finalization
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>256-bit Encrypted Checkout</span>
        </div>
      </div>

      {/* Warning Banner if previously failed attempt */}
      {failedOrderRef && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-bold">Pending Order #{failedOrderRef.orderNumber}</span>
            <span className="text-amber-800 hidden sm:inline">• Select payment method below to complete payment.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFailedOrderRef(null);
              setPaymentStatusMessage('');
            }}
            className="text-[11px] font-bold text-amber-900 underline hover:text-amber-700 cursor-pointer shrink-0"
          >
            Start Fresh Order
          </button>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left 2 Columns: 1. Dining Service -> 2. Payment Method -> 3. Guest Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* ========================================================================= */}
          {/* SECTION 1: DINING SERVICE TYPE & LOCATION                                */}
          {/* ========================================================================= */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h2 className="font-serif font-bold text-sm sm:text-base text-stone-900 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-700" />
                <span>1. Dining Service Type & Location</span>
              </h2>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                isOnlinePaymentMandatory
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {isOnlinePaymentMandatory ? 'Online Payment Mandatory' : 'Pay at Exit Available'}
              </span>
            </div>

            {/* 4 Segmented Service Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Dine-in */}
              <button
                type="button"
                onClick={() => setOrderType('Dine-in')}
                className={`py-2.5 px-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  orderType === 'Dine-in'
                    ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold ring-2 ring-amber-600/30 shadow-2xs'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-medium'
                }`}
              >
                <Utensils className="w-4 h-4 text-amber-700" />
                <span className="text-xs">Dine-in Table</span>
                <span className="text-[9px] text-emerald-700 font-semibold">
                  {isQrSession ? '✓ QR Locked' : 'Pay at Exit Allowed'}
                </span>
              </button>

              {/* Takeaway */}
              <button
                type="button"
                disabled={isQrSession}
                onClick={() => !isQrSession && setOrderType('Takeaway')}
                className={`py-2.5 px-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                  isQrSession
                    ? 'opacity-40 bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : orderType === 'Takeaway'
                    ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold ring-2 ring-amber-600/30 shadow-2xs cursor-pointer'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-medium cursor-pointer'
                }`}
                title={isQrSession ? 'Disabled for Table QR Code session' : ''}
              >
                <ShoppingBag className="w-4 h-4 text-amber-700" />
                <span className="text-xs">Takeaway</span>
                <span className="text-[9px] text-stone-500 font-semibold">
                  {isQrSession ? 'Disabled for QR' : 'Pay at Exit Allowed'}
                </span>
              </button>

              {/* Room Service */}
              <button
                type="button"
                disabled={isQrSession}
                onClick={() => !isQrSession && setOrderType('Room Service')}
                className={`py-2.5 px-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                  isQrSession
                    ? 'opacity-40 bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : orderType === 'Room Service'
                    ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold ring-2 ring-amber-600/30 shadow-2xs cursor-pointer'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-medium cursor-pointer'
                }`}
                title={isQrSession ? 'Disabled for Table QR Code session' : ''}
              >
                <BedDouble className="w-4 h-4 text-amber-700" />
                <span className="text-xs">Room Service</span>
                <span className="text-[9px] text-stone-500 font-semibold">
                  {isQrSession ? 'Disabled for QR' : 'Payment Mandatory'}
                </span>
              </button>

              {/* Home Delivery */}
              <button
                type="button"
                disabled={isQrSession}
                onClick={() => !isQrSession && setOrderType('Delivery')}
                className={`py-2.5 px-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                  isQrSession
                    ? 'opacity-40 bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : orderType === 'Delivery'
                    ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold ring-2 ring-amber-600/30 shadow-2xs cursor-pointer'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 font-medium cursor-pointer'
                }`}
                title={isQrSession ? 'Disabled for Table QR Code session' : ''}
              >
                <Truck className="w-4 h-4 text-amber-700" />
                <span className="text-xs">Home Delivery</span>
                <span className="text-[9px] text-stone-500 font-semibold">
                  {isQrSession ? 'Disabled for QR' : 'Payment Mandatory'}
                </span>
              </button>
            </div>

            {/* Sub-inputs based on Order Type */}
            {orderType === 'Dine-in' && (
              <div className="pt-1 space-y-2">
                {myBookings.length > 0 && (
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-950">Link Confirmed Table:</span>
                    <select
                      value={bookingReference}
                      onChange={(e) => {
                        const sel = myBookings.find((b) => b.bookingReference === e.target.value);
                        setBookingReference(e.target.value);
                        if (sel) setTableNumber(sel.tableNumber || 'Table 03');
                      }}
                      className="p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium"
                    >
                      {myBookings.map((b) => (
                        <option key={b.id} value={b.bookingReference}>
                          {b.bookingReference} — {b.tableName || b.tableNumber} ({b.bookingDate})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-stone-700 shrink-0">Table / Seating Area:</label>
                  <input
                    type="text"
                    placeholder="Enter Table Number"
                    value={tableNumber}
                    onChange={(e) => !isQrSession && setTableNumber(e.target.value)}
                    readOnly={isQrSession}
                    disabled={isQrSession}
                    className={`flex-1 px-3 py-1.5 rounded-xl text-xs ${
                      isQrSession
                        ? 'bg-amber-100/60 border border-amber-300 font-bold text-amber-950 cursor-not-allowed'
                        : 'bg-stone-50 border border-stone-200'
                    }`}
                    required
                  />
                  {isQrSession && (
                    <span className="text-[10px] font-extrabold uppercase bg-amber-800 text-white px-2 py-1 rounded-lg shrink-0">
                      🔒 QR Locked
                    </span>
                  )}
                </div>
              </div>
            )}

            {orderType === 'Room Service' && (
              <div className="pt-1 flex items-center gap-2">
                <label className="text-xs font-bold text-stone-700 shrink-0">Suite / Room #:</label>
                <input
                  type="text"
                  placeholder="Enter Room Number"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                  required
                />
              </div>
            )}

            {orderType === 'Delivery' && (
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-700" />
                    <span>Delivery Address Details</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddressObj(null);
                      setAddressModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-900 hover:text-white bg-amber-100 hover:bg-amber-800 px-3 py-1.5 rounded-xl border border-amber-300 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Address</span>
                  </button>
                </div>

                {savedAddresses.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-stone-500 font-medium">Select address or click edit icon to update:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressObj?.id === addr.id;
                        return (
                          <div
                            key={addr.id}
                            onClick={() => {
                              setSelectedAddressObj(addr);
                              setDeliveryAddress(addr.formattedAddress);
                            }}
                            className={`p-3.5 rounded-2xl border transition-all relative flex flex-col justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50/90 border-amber-600 ring-2 ring-amber-600/30 shadow-2xs'
                                : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                                  addr.tag === 'Home'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : addr.tag === 'Work'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                                }`}>
                                  {addr.tag}
                                </span>
                                {isSelected && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                                    <Check className="w-3 h-3" /> Selected
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingAddressObj(addr);
                                    setAddressModalOpen(true);
                                  }}
                                  title="Edit address"
                                  className="p-1 rounded-lg bg-stone-200/80 hover:bg-amber-700 hover:text-white text-stone-700 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {savedAddresses.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAddress(addr.id);
                                    }}
                                    title="Delete address"
                                    className="p-1 rounded-lg bg-stone-200/80 hover:bg-rose-700 hover:text-white text-stone-700 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="font-bold text-xs text-stone-900">{addr.houseNo}</p>
                              <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{addr.formattedAddress}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-center space-y-2">
                    <p className="text-xs text-amber-900 font-medium">No saved delivery address yet.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddressObj(null);
                        setAddressModalOpen(true);
                      }}
                      className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Delivery Address</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: SELECT PAYMENT METHOD                                          */}
          {/* ========================================================================= */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h2 className="font-serif font-bold text-sm sm:text-base text-stone-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-700" />
                <span>Select Payment Method</span>
              </h2>
              <span className="text-[10px] text-stone-500 font-medium">
                {isOnlinePaymentMandatory ? '🔒 Online Payment Required' : '✓ Pay at Exit Available'}
              </span>
            </div>

            {/* 4 Online Payment Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: PhonePe */}
              <button
                type="button"
                onClick={() => setSelectedPayment('PHONEPE')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  selectedPayment === 'PHONEPE'
                    ? 'bg-purple-50/90 border-purple-500 text-purple-950 ring-2 ring-purple-500/30 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                    पे
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs sm:text-sm text-stone-900">PhonePe</p>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-sm border border-purple-200">
                        App
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">Pay using the PhonePe app.</p>
                  </div>
                </div>
                {selectedPayment === 'PHONEPE' && (
                  <div className="w-5 h-5 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Option 2: Google Pay */}
              <button
                type="button"
                onClick={() => setSelectedPayment('GPAY')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  selectedPayment === 'GPAY'
                    ? 'bg-blue-50/90 border-blue-500 text-blue-950 ring-2 ring-blue-500/30 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 text-blue-600 flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                    G
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs sm:text-sm text-stone-900">Google Pay</p>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-sm border border-blue-200">
                        GPay
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">Pay using the Google Pay app.</p>
                  </div>
                </div>
                {selectedPayment === 'GPAY' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Option 3: Scan QR Code */}
              <button
                type="button"
                onClick={() => setSelectedPayment('QR')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  selectedPayment === 'QR'
                    ? 'bg-amber-50/90 border-amber-600 text-amber-950 ring-2 ring-amber-600/30 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-800 text-white flex items-center justify-center shadow-sm shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs sm:text-sm text-stone-900">Scan QR Code</p>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-sm border border-amber-300">
                        UPI QR
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">Scan a QR code using any UPI app.</p>
                  </div>
                </div>
                {selectedPayment === 'QR' && (
                  <div className="w-5 h-5 rounded-full bg-amber-800 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Option 4: Credit / Debit Card */}
              <button
                type="button"
                onClick={() => setSelectedPayment('CARD')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  selectedPayment === 'CARD'
                    ? 'bg-stone-900 text-white border-stone-900 ring-2 ring-stone-900/30 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                    selectedPayment === 'CARD' ? 'bg-amber-400 text-stone-950' : 'bg-stone-800 text-white'
                  }`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`font-bold text-xs sm:text-sm ${selectedPayment === 'CARD' ? 'text-white' : 'text-stone-900'}`}>
                        Credit / Debit Card
                      </p>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-sm border ${
                        selectedPayment === 'CARD'
                          ? 'bg-stone-800 text-amber-300 border-stone-700'
                          : 'bg-stone-200 text-stone-700 border-stone-300'
                      }`}>
                        Visa / Master
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${selectedPayment === 'CARD' ? 'text-stone-300' : 'text-stone-500'}`}>
                      Pay securely using a card.
                    </p>
                  </div>
                </div>
                {selectedPayment === 'CARD' && (
                  <div className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 font-bold" />
                  </div>
                )}
              </button>
            </div>

            {/* DIRECT CARD INPUT FIELDS (Only displayed when Card is selected) */}
            {selectedPayment === 'CARD' && (
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/90 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-800" />
                    <span className="font-bold text-xs text-stone-900">Enter Card Information</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    <span>256-Bit SSL Encrypted</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-stone-700">Card Number</label>
                    <input
                      type="text"
                      placeholder="Enter Card Number"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                        setCardNumber(val);
                      }}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:border-amber-700 focus:outline-hidden"
                      required={selectedPayment === 'CARD'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-700">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        placeholder="Enter Expiry Date"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^\d/]/g, '');
                          if (val.length === 2 && !val.includes('/')) val += '/';
                          setCardExpiry(val);
                        }}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:border-amber-700 focus:outline-hidden"
                        required={selectedPayment === 'CARD'}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-stone-700">CVV / CVC</label>
                      <input
                        type="password"
                        placeholder="Enter CVV"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs focus:border-amber-700 focus:outline-hidden"
                        required={selectedPayment === 'CARD'}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-stone-700">Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="Enter Cardholder Name"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs uppercase focus:border-amber-700 focus:outline-hidden"
                      required={selectedPayment === 'CARD'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Option 5: PAY AT EXIT (For Dine-in and Takeaway) */}
            <div className="pt-0.5">
              <button
                type="button"
                disabled={isOnlinePaymentMandatory}
                onClick={() => {
                  if (!isOnlinePaymentMandatory) {
                    setSelectedPayment('PAY_AT_EXIT');
                  }
                }}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                  isOnlinePaymentMandatory
                    ? 'bg-stone-100/70 border-stone-200 opacity-60 cursor-not-allowed text-stone-400'
                    : selectedPayment === 'PAY_AT_EXIT'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/30 shadow-xs cursor-pointer'
                    : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xs shrink-0 ${
                    isOnlinePaymentMandatory ? 'bg-stone-300 text-stone-500' : 'bg-emerald-700 text-white'
                  }`}>
                    {isOnlinePaymentMandatory ? <Ban className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-stone-900">Pay at Exit</p>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.2 rounded-md border ${
                        isOnlinePaymentMandatory
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-emerald-800 bg-emerald-100 border-emerald-300'
                      }`}>
                        {isOnlinePaymentMandatory ? `Disabled for ${orderType}` : 'Place Order Now • Pay Later'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      {isOnlinePaymentMandatory
                        ? `Online payment is mandatory for ${orderType}. Please choose PhonePe, GPay, QR, or Card.`
                        : `Place your order now and pay later when your meal is complete or at exit.`}
                    </p>
                  </div>
                </div>
                {selectedPayment === 'PAY_AT_EXIT' && !isOnlinePaymentMandatory && (
                  <div className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 font-bold" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Dynamic Proceed CTA */}
        <div className="lg:col-span-1 space-y-4 sticky top-20">
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div className="border-b border-stone-100 pb-2.5 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-900">
                Review & Pay
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {items.length} {items.length === 1 ? 'Dish' : 'Dishes'}
              </span>
            </div>

            {/* Line items preview */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.menuItem.id} className="text-xs flex justify-between items-center text-stone-700 py-0.5 border-b border-stone-50 last:border-0">
                  <span className="truncate max-w-[170px]">
                    <strong className="text-amber-900 mr-1">{item.quantity}×</strong>
                    {item.menuItem.name}
                  </span>
                  <span className="font-mono font-medium">{formatCurrency(item.menuItem.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Financial breakdown */}
            <div className="space-y-2 text-xs text-stone-600 border-t border-stone-100 pt-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount ({discountCode})</span>
                  <span className="font-mono">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST Tax (5%)</span>
                <span className="font-mono">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee</span>
                <span className="font-mono">{formatCurrency(serviceCharge)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-stone-900 pt-2.5 border-t border-stone-200">
                <span className="font-serif">Grand Total</span>
                <span className="font-serif text-xl font-bold text-amber-950">{formatCurrency(total)}</span>
              </div>
            </div>

            {paymentStatusMessage && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center text-[11px] font-semibold text-amber-900 animate-pulse">
                {paymentStatusMessage}
              </div>
            )}

            {/* Dynamic CTA Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3.5 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                selectedPayment === 'PAY_AT_EXIT'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : selectedPayment === 'PHONEPE'
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : selectedPayment === 'GPAY'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : selectedPayment === 'QR'
                  ? 'bg-amber-800 hover:bg-amber-900'
                  : 'bg-stone-900 hover:bg-black'
              }`}
            >
              <span>{getProceedButtonText()}</span>
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1.5 text-[10px] text-stone-400 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Instant Bank Verified • Zero Stored Credentials</span>
            </div>
          </div>
        </div>
      </form>

      {/* Luxury Payment & Order Confirmation Modal */}
      {paymentModalOpen && paymentModalData && (
        <HotelUpiQrPaymentModal
          orderId={paymentModalData.order.id}
          orderNumber={paymentModalData.order.orderNumber}
          amount={paymentModalData.pOrder?.amountInRupees || paymentModalData.order.total}
          customerName={customerName}
          customerEmail={customerEmail}
          customerPhone={customerPhone}
          mode={paymentModalMode}
          cardDetails={{
            cardNumber,
            cardHolder,
            cardExpiry,
            cardCvv
          }}
          initialPaymentData={paymentModalData.pOrder}
          onSuccess={(order, payment) => {
            clearCart();
            setFailedOrderRef(null);
            setPaymentModalOpen(false);
            navigate('order-status', { orderId: paymentModalData.order.id });
          }}
          onFailure={(msg) => {
            setFailedOrderRef(paymentModalData.order);
            setPaymentStatusMessage(msg);
          }}
          onClose={() => {
            setPaymentModalOpen(false);
            setFailedOrderRef(paymentModalData.order);
          }}
          onReturnToMenu={() => {
            clearCart();
            setPaymentModalOpen(false);
            navigate('menu');
          }}
        />
      )}

      {/* Delivery Address & Map Pin Modal */}
      <DeliveryAddressModal
        isOpen={addressModalOpen}
        onClose={() => {
          setAddressModalOpen(false);
          setEditingAddressObj(null);
        }}
        initialAddress={editingAddressObj}
        defaultPhone={customerPhone || user?.phone || ''}
        defaultEmail={customerEmail || user?.email || ''}
        defaultName={customerName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
        onSelectAddress={handleSaveAddress}
      />
    </div>
  );
};
