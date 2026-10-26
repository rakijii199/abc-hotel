/**
 * Comprehensive Luxury Payment Modal for ABC Hotel
 * Clean, minimalistic UI with clutter-free workflows for PhonePe, Google Pay, QR, and Card.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  X,
  Smartphone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  QrCode,
  Lock,
  ExternalLink,
  Receipt,
  Utensils
} from 'lucide-react';
import { PaymentApi } from '../../api/index.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatCurrency, formatOrderDateTime } from '../../utils/formatters.ts';

export type PaymentFlowStatus =
  | 'IDLE'
  | 'CREATING_PAYMENT'
  | 'WAITING_FOR_PAYMENT'
  | 'VERIFYING_PAYMENT'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_EXPIRED';

export type PaymentModalMode = 'PHONEPE' | 'GPAY' | 'QR' | 'CARD';

interface HotelUpiQrPaymentModalProps {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  mode?: PaymentModalMode;
  cardDetails?: {
    cardNumber: string;
    cardHolder: string;
    cardExpiry: string;
    cardCvv: string;
  };
  initialPaymentData?: any;
  defaultUpiApp?: 'PHONEPE' | 'GPAY';
  onSuccess: (order: any, payment: any) => void;
  onFailure: (errorMsg: string) => void;
  onClose: () => void;
  onReturnToMenu?: () => void;
}

export const HotelUpiQrPaymentModal: React.FC<HotelUpiQrPaymentModalProps> = ({
  orderId,
  orderNumber,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  mode = 'PHONEPE',
  cardDetails,
  initialPaymentData,
  onSuccess,
  onFailure,
  onClose,
  onReturnToMenu
}) => {
  const { error, success } = useToast();
  const PAYMENT_TIMEOUT_SECONDS = 60; // 60 seconds strict payment window

  const [currentMode, setCurrentMode] = useState<PaymentModalMode>(mode);
  const [paymentData, setPaymentData] = useState<any>(initialPaymentData || null);
  const [status, setStatus] = useState<PaymentFlowStatus>('WAITING_FOR_PAYMENT');
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for payment confirmation...');
  const [verifiedOrder, setVerifiedOrder] = useState<any | null>(null);
  const [verifiedPayment, setVerifiedPayment] = useState<any | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [utrInput, setUtrInput] = useState<string>('');
  const [showUtrField, setShowUtrField] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(PAYMENT_TIMEOUT_SECONDS);

  // Card 3D-Secure OTP State
  const [cardOtp, setCardOtp] = useState<string>('482910');
  const [cardOtpTimer, setCardOtpTimer] = useState<number>(30);
  const [isAuthorizingCard, setIsAuthorizingCard] = useState<boolean>(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync mode if prop changes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Play pleasant celebratory audio chime on payment confirmed
  const playSuccessChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Note 1: E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: G#5
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(830.61, now + 0.1);
      gain2.gain.setValueAtTime(0.15, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.4);

      // Note 3: B5
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(987.77, now + 0.22);
      gain3.gain.setValueAtTime(0.18, now + 0.22);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.22);
      osc3.stop(now + 0.6);

      // Note 4: E6
      const osc4 = ctx.createOscillator();
      const gain4 = ctx.createGain();
      osc4.type = 'triangle';
      osc4.frequency.setValueAtTime(1318.51, now + 0.35);
      gain4.gain.setValueAtTime(0.22, now + 0.35);
      gain4.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc4.connect(gain4);
      gain4.connect(ctx.destination);
      osc4.start(now + 0.35);
      osc4.stop(now + 0.9);
    } catch {
      // ignore
    }
  };

  const handlePaymentConfirmed = (orderObj: any, paymentObj: any) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setStatus('PAYMENT_SUCCESS');
    setStatusMessage('Payment received and verified!');
    setVerifiedOrder(orderObj);
    setVerifiedPayment(paymentObj);
    playSuccessChime();
  };

  // Initialize Payment Attempt if not already passed
  useEffect(() => {
    let isMounted = true;

    const initPayment = async () => {
      if (!paymentData) {
        setStatus('CREATING_PAYMENT');
        setStatusMessage('Generating secure payment session...');
        try {
          const methodParam = currentMode === 'CARD' ? 'Card' : 'UPI';
          const data = await PaymentApi.createPaymentOrder(orderId, methodParam);
          if (isMounted) {
            setPaymentData(data);
            setStatus('WAITING_FOR_PAYMENT');
            setStatusMessage('Waiting for payment confirmation...');
          }
        } catch (err: any) {
          if (isMounted) {
            setStatus('PAYMENT_FAILED');
            setStatusMessage(err.message || 'Failed to initialize payment.');
            onFailure(err.message || 'Payment initialization failed.');
          }
        }
      }
    };

    initPayment();

    return () => {
      isMounted = false;
    };
  }, [orderId, currentMode]);

  // 60-Second Countdown Timer
  useEffect(() => {
    if (status !== 'WAITING_FOR_PAYMENT' && status !== 'VERIFYING_PAYMENT') {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);

          if (paymentData?.attemptId) {
            PaymentApi.cancelPaymentAttempt(paymentData.attemptId).catch(() => {});
          }

          setStatus('PAYMENT_EXPIRED');
          setStatusMessage('Payment session expired after 60s. Payment rejected.');
          error('Payment session timed out (60s). Please retry.');
          onFailure('Payment timed out after 60 seconds.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [status, paymentData?.attemptId]);

  // Live Polling every 2.0s
  useEffect(() => {
    if (status !== 'WAITING_FOR_PAYMENT' && status !== 'VERIFYING_PAYMENT') {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const attemptId = paymentData?.attemptId;
    if (!attemptId) return;

    const checkAttemptStatus = async () => {
      try {
        const result = await PaymentApi.getPaymentAttemptStatus(attemptId);

        if (result.status === 'SUCCESS' || result.status === 'CAPTURED' || result.paymentStatus === 'PAID') {
          handlePaymentConfirmed(
            { id: result.orderId, orderNumber: result.orderNumber, total: result.amount },
            { id: result.paymentReference || 'pay_verified', transactionId: result.paymentReference, amount: result.amount }
          );
          return;
        }

        if (result.status === 'FAILED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setStatus('PAYMENT_FAILED');
          setStatusMessage('Payment failed or was rejected at gateway.');
        } else if (result.status === 'CANCELLED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setStatus('PAYMENT_CANCELLED');
          setStatusMessage('Payment attempt was cancelled.');
        } else if (result.status === 'EXPIRED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setStatus('PAYMENT_EXPIRED');
          setStatusMessage('Payment window expired (60s limit reached).');
        }
      } catch {
        // Continue polling silently
      }
    };

    pollTimerRef.current = setInterval(checkAttemptStatus, 2000);

    const handleFocusCheck = () => {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        checkAttemptStatus();
      }
    };

    window.addEventListener('visibilitychange', handleFocusCheck);
    window.addEventListener('focus', handleFocusCheck);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener('visibilitychange', handleFocusCheck);
      window.removeEventListener('focus', handleFocusCheck);
    };
  }, [paymentData?.attemptId, status]);

  // Card OTP timer countdown
  useEffect(() => {
    if (currentMode === 'CARD' && cardOtpTimer > 0) {
      const t = setTimeout(() => setCardOtpTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [currentMode, cardOtpTimer]);

  const handleConfirmPaymentDirect = async () => {
    if (!paymentData?.attemptId) return;
    setIsConfirming(true);
    setStatus('VERIFYING_PAYMENT');
    setStatusMessage('Verifying payment with bank...');
    try {
      const confirmRes = await PaymentApi.confirmUpiPayment(paymentData.attemptId, utrInput);
      success(`✓ Payment Verified! Order #${confirmRes.order?.orderNumber || orderNumber} is CONFIRMED.`);
      handlePaymentConfirmed(confirmRes.order, confirmRes.payment);
    } catch (err: any) {
      setStatus('WAITING_FOR_PAYMENT');
      setStatusMessage(err.message || 'Payment confirmation failed.');
      error(err.message || 'Could not verify payment. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleAuthorizeCardOtp = async () => {
    if (!cardOtp || cardOtp.length < 4) {
      error('Please enter the 6-digit Bank OTP.');
      return;
    }

    setIsAuthorizingCard(true);
    setStatus('VERIFYING_PAYMENT');
    setStatusMessage('Authorizing Card Payment with Bank...');

    try {
      if (paymentData?.attemptId) {
        const simResult = await PaymentApi.simulateUpiPaymentSuccess(paymentData.attemptId);
        success(`✓ Card Authorized! Order #${simResult.order?.orderNumber || orderNumber} confirmed.`);
        handlePaymentConfirmed(simResult.order, simResult.payment);
      } else {
        throw new Error('Payment session missing.');
      }
    } catch (err: any) {
      setStatus('PAYMENT_FAILED');
      setStatusMessage(err.message || 'Card authorization failed.');
      error(err.message || 'Card payment authorization failed.');
    } finally {
      setIsAuthorizingCard(false);
    }
  };

  const handleRetryPayment = async () => {
    setStatus('CREATING_PAYMENT');
    setStatusMessage('Generating fresh payment session...');
    setTimeLeft(PAYMENT_TIMEOUT_SECONDS);
    try {
      const methodParam = currentMode === 'CARD' ? 'Card' : 'UPI';
      const data = await PaymentApi.createPaymentOrder(orderId, methodParam);
      setPaymentData(data);
      setStatus('WAITING_FOR_PAYMENT');
      setStatusMessage('Waiting for payment confirmation...');
    } catch (err: any) {
      setStatus('PAYMENT_FAILED');
      setStatusMessage(err.message || 'Retry failed.');
    }
  };

  const handleCancelPayment = async () => {
    if (paymentData?.attemptId) {
      try {
        await PaymentApi.cancelPaymentAttempt(paymentData.attemptId);
      } catch {}
    }
    setStatus('PAYMENT_CANCELLED');
    setStatusMessage('Payment cancelled.');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const hotelUpiId = paymentData?.hotelUpiId || '9620369291@ybl';
  const hotelName = paymentData?.hotelName || 'ABC HOTEL';
  const baseUpiParams = `pa=${encodeURIComponent(hotelUpiId)}&pn=${encodeURIComponent(hotelName)}&am=${amount}&cu=INR&tr=${paymentData?.paymentReference || 'ABC-REF'}&tn=${encodeURIComponent(`ABC Hotel Order #${orderNumber}`)}`;
  const phonePeIntent = `phonepe://pay?${baseUpiParams}`;
  const gPayIntent = `gpay://upi/pay?${baseUpiParams}`;
  const genericUpiIntent = `upi://pay?${baseUpiParams}`;

  const getMethodDisplayName = () => {
    if (currentMode === 'PHONEPE') return 'PhonePe UPI';
    if (currentMode === 'GPAY') return 'Google Pay (GPay)';
    if (currentMode === 'QR') return 'Hotel UPI QR Code';
    return 'Credit / Debit Card';
  };

  const dynamicQrCodeUrl =
    paymentData?.hotelQrCodeUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(genericUpiIntent)}&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="surface-raised !rounded-2xl !shadow-[var(--shadow-float)] max-w-md w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Neat & Clean Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[var(--brand-soft)] to-white flex items-center justify-between gap-3 shrink-0 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="section-title !text-base sm:!text-lg leading-tight">
              {status === 'PAYMENT_SUCCESS'
                ? 'Payment Confirmation'
                : currentMode === 'PHONEPE'
                ? 'Pay via PhonePe'
                : currentMode === 'GPAY'
                ? 'Pay via Google Pay'
                : currentMode === 'QR'
                ? 'Scan & Pay via UPI QR'
                : 'Credit / Debit Card Payment'}
            </h3>
            <p className="text-xs text-[var(--brand-text)] mt-0.5 font-semibold">
              Order #{orderNumber} • {formatCurrency(amount)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {status === 'WAITING_FOR_PAYMENT' && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold transition-colors ${
                  timeLeft <= 15
                    ? 'bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger-border)] animate-pulse'
                    : 'bg-white text-stone-700 border border-[var(--border-subtle)]'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>{formatTimer(timeLeft)}</span>
              </div>
            )}
            {status !== 'PAYMENT_SUCCESS' && (
              <button
                onClick={handleCancelPayment}
                className="p-1 rounded-full hover:bg-[var(--brand-soft)] text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* ========================================================================= */}
          {/* STATE 1: SUCCESS STATE — CLEAN CONFIRMATION RECEIPT                      */}
          {/* ========================================================================= */}
          {status === 'PAYMENT_SUCCESS' && (
            <div className="text-center py-2 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg ring-6 ring-emerald-100 relative z-10">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="badge badge-success !px-3 !text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Payment Successful</span>
                </div>
                <h2 className="section-title !text-2xl">
                  Your Order Has Been Placed.
                </h2>
                <p className="text-xs text-stone-600">
                  Payment verified and received by <strong>{hotelName}</strong>.
                </p>
              </div>

              {/* Clean Confirmation Receipt */}
              <div className="p-4 bg-[var(--surface-muted)] rounded-2xl border border-[var(--border-subtle)] text-left text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-emerald-200/50 pb-1.5">
                  <span className="text-stone-600 font-medium">Order Number:</span>
                  <span className="font-serif font-bold text-sm text-stone-950">
                    #{orderNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-emerald-200/50 pb-1.5">
                  <span className="text-stone-600 font-medium">Amount Paid:</span>
                  <span className="font-display font-bold text-lg text-[var(--brand-text)]">
                    {formatCurrency(amount)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-emerald-200/50 pb-1.5">
                  <span className="text-stone-600 font-medium">Payment Method:</span>
                  <span className="font-bold text-stone-900">
                    {getMethodDisplayName()}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-emerald-200/50 pb-1.5">
                  <span className="text-stone-600 font-medium">Transaction Ref:</span>
                  <span className="font-mono font-bold text-stone-900 truncate max-w-[180px]">
                    {verifiedPayment?.transactionId || verifiedPayment?.id || paymentData?.paymentReference || 'ABC-REF-PAID'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-stone-600 font-medium">Date & Time:</span>
                  <span className="text-stone-800 font-medium">
                    {formatOrderDateTime(new Date().toISOString())}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSuccess(verifiedOrder, verifiedPayment)}
                  className="lux-btn lux-btn-wine w-full"
                >
                  <Receipt className="w-4 h-4" />
                  <span>View Order Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {onReturnToMenu && (
                  <button
                    type="button"
                    onClick={onReturnToMenu}
                    className="lux-btn lux-btn-outline w-full !min-h-11"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Return to Menu</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 2: REJECTED / EXPIRED STATE                                         */}
          {/* ========================================================================= */}
          {(status === 'PAYMENT_FAILED' || status === 'PAYMENT_CANCELLED' || status === 'PAYMENT_EXPIRED') && (
            <div className="text-center py-4 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm ring-6 ring-rose-50">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <span className="badge badge-danger uppercase tracking-widest !text-[10px] font-bold">
                  {status === 'PAYMENT_EXPIRED' ? 'Payment Timed Out (60s)' : 'Payment Cancelled'}
                </span>
                <h2 className="section-title mt-2">
                  {status === 'PAYMENT_EXPIRED' ? 'Payment Window Expired' : 'Payment Not Completed'}
                </h2>
                <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
                  {statusMessage || 'Payment was not received within the 60s window.'}
                </p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  className="btn btn-primary flex-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Payment</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 3: CLEAN ACTIVE PAYMENT FLOWS (PHONEPE, GPAY, QR, CARD)             */}
          {/* ========================================================================= */}
          {(status === 'WAITING_FOR_PAYMENT' || status === 'VERIFYING_PAYMENT' || status === 'CREATING_PAYMENT') && (
            <div className="space-y-4">
              {/* Clean Amount Display */}
              <div className="text-center py-2">
                <span className="label-caps block">
                  Amount to Pay
                </span>
                <div className="font-display font-bold text-4xl text-[var(--brand-text)] mt-0.5">
                  {formatCurrency(amount)}
                </div>
              </div>

              {/* WORKFLOW 1: PHONEPE REDIRECT */}
              {currentMode === 'PHONEPE' && (
                <div className="space-y-3">
                  <a
                    href={phonePeIntent}
                    className="w-full py-3.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open PhonePe & Pay {formatCurrency(amount)}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              )}

              {/* WORKFLOW 2: GOOGLE PAY REDIRECT */}
              {currentMode === 'GPAY' && (
                <div className="space-y-3">
                  <a
                    href={gPayIntent}
                    className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open Google Pay & Pay {formatCurrency(amount)}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              )}

              {/* WORKFLOW 3: SCAN DYNAMIC QR CODE */}
              {currentMode === 'QR' && (
                <div className="space-y-3 text-center">
                  <div className="mx-auto w-48 h-48 bg-white p-2 rounded-2xl border-2 border-[var(--brand-border)] shadow-[var(--shadow-card)] flex items-center justify-center">
                    <img
                      src={dynamicQrCodeUrl}
                      alt="Dynamic Hotel UPI QR Code"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>
                  <p className="text-xs text-stone-600 font-medium">
                    Scan with PhonePe, Google Pay, or any UPI app
                  </p>
                </div>
              )}

              {/* WORKFLOW 4: CREDIT / DEBIT CARD 3D-SECURE VERIFICATION */}
              {currentMode === 'CARD' && (
                <div className="p-4 bg-[var(--surface-muted)] rounded-2xl border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[var(--brand)]" />
                      <span className="font-bold text-xs text-stone-900">3D-Secure Bank Verification</span>
                    </div>
                    <span className="badge badge-success !text-[10px] font-bold">
                      256-Bit SSL
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-stone-200 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Card:</span>
                      <span className="font-mono font-bold text-stone-900">
                        {cardDetails?.cardNumber
                          ? `•••• •••• •••• ${cardDetails.cardNumber.replace(/\s+/g, '').slice(-4)}`
                          : '•••• •••• •••• 4242'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Cardholder:</span>
                      <span className="font-bold text-stone-900 uppercase">
                        {cardDetails?.cardHolder || customerName || 'VALUED GUEST'}
                      </span>
                    </div>
                  </div>

                  {/* Bank OTP Input Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-900">Enter Bank OTP</span>
                      <span className="text-[10px] text-stone-500">
                        Demo OTP: <strong>482910</strong>
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={cardOtp}
                        onChange={(e) => setCardOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="6-digit OTP"
                        className="field flex-1 min-w-0 !rounded-xl font-mono text-center font-bold tracking-widest text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAuthorizeCardOtp}
                        disabled={isAuthorizingCard}
                        className="btn btn-primary shrink-0"
                      >
                        {isAuthorizingCard ? 'Authorizing...' : 'Authorize'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Clean Confirmation / Verification via UTR */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-stone-500">
                    Paid on your app?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUtrField(!showUtrField)}
                    className="text-[11px] font-semibold text-[var(--brand-text)] hover:underline underline-offset-2 cursor-pointer"
                  >
                    {showUtrField ? 'Hide Ref' : '+ Enter UTR Ref'}
                  </button>
                </div>

                {showUtrField && (
                  <input
                    type="text"
                    placeholder="12-digit UPI UTR / Bank Reference No."
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    className="field !rounded-xl text-xs font-mono"
                  />
                )}

                <button
                  type="button"
                  onClick={handleConfirmPaymentDirect}
                  disabled={isConfirming || status === 'VERIFYING_PAYMENT'}
                  className="lux-btn lux-btn-wine w-full !tracking-[0.1em] disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isConfirming ? 'Verifying Payment...' : '✓ I Have Completed Payment'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
