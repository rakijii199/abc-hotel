/**
 * Admin Payments Management Module
 * Comprehensive Gateway Audit Log, Status Filters, Transaction Verification & Refund Operations
 */
import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  ShieldCheck,
  Receipt,
  Eye,
  Filter,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  QrCode
} from 'lucide-react';
import { PaymentApi } from '../../api/index.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters.ts';
import { Modal, Spinner } from '../common/Footer.tsx';

interface AdminPaymentsViewProps {
  onRefreshOrders?: () => void;
}

export const AdminPaymentsView: React.FC<AdminPaymentsViewProps> = ({ onRefreshOrders }) => {
  const { error, success } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Refund Modal State
  const [refundModalPayment, setRefundModalPayment] = useState<any | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('Customer request / order adjustment');
  const [submittingRefund, setSubmittingRefund] = useState<boolean>(false);

  // Inspection Modal State
  const [inspectPayment, setInspectPayment] = useState<any | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  // Settings Modal State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [hotelUpiId, setHotelUpiId] = useState('9620369291@ybl');
  const [hotelName, setHotelName] = useState('ABC HOTEL');
  const [hotelMobile, setHotelMobile] = useState('+91 96203 69291');
  const [instructions, setInstructions] = useState('Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, CRED). Pay exact amount to 9620369291@ybl for instant automated order confirmation.');
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [data, config] = await Promise.all([
        PaymentApi.getAllPaymentsAdmin(),
        PaymentApi.getPaymentConfig()
      ]);
      setPayments(data);
      if (config) {
        setHotelUpiId(config.hotelUpiId || '9620369291@ybl');
        setHotelName(config.hotelName || 'ABC HOTEL');
        setHotelMobile(config.hotelMobileNumber || '+91 96203 69291');
        if (config.paymentInstructions) setInstructions(config.paymentInstructions);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load payments audit log.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await PaymentApi.updateAdminPaymentSettings({
        hotelUpiId,
        hotelName,
        hotelMobileNumber: hotelMobile,
        paymentInstructions: instructions
      });
      success('Hotel UPI payment settings updated successfully!');
      setSettingsModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleOpenRefundModal = (pay: any) => {
    setRefundModalPayment(pay);
    setRefundAmount(pay.amount);
    setRefundReason('Customer requested cancellation / refund');
  };

  const handleExecuteRefund = async () => {
    if (!refundModalPayment) return;
    setSubmittingRefund(true);
    try {
      await PaymentApi.refundPaymentAdmin(refundModalPayment.id, refundAmount, refundReason);
      success(`Refund of ${formatCurrency(refundAmount)} processed successfully for Order #${refundModalPayment.orderNumber || ''}!`);
      setRefundModalPayment(null);
      fetchPayments();
      if (onRefreshOrders) onRefreshOrders();
    } catch (err: any) {
      error(err.message || 'Failed to process refund.');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleReconcilePayment = async (paymentId: string) => {
    setReconcilingId(paymentId);
    try {
      const res = await PaymentApi.reconcilePaymentAdmin(paymentId);
      success(res.message || 'Payment reconciled and order confirmed!');
      fetchPayments();
      if (onRefreshOrders) onRefreshOrders();
    } catch (err: any) {
      error(err.message || 'Failed to reconcile payment.');
    } finally {
      setReconcilingId(null);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrder = p.orderNumber?.toLowerCase().includes(q) || p.orderId?.toLowerCase().includes(q);
      const matchCust = p.customerName?.toLowerCase().includes(q) || p.customerEmail?.toLowerCase().includes(q);
      const matchTxn = p.providerPaymentId?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q) || p.transactionId?.toLowerCase().includes(q);
      if (!matchOrder && !matchCust && !matchTxn) return false;
    }
    return true;
  });

  // Calculate Metrics
  const totalRevenue = payments
    .filter((p) => p.status === 'CAPTURED')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunded = payments
    .filter((p) => p.status === 'REFUNDED')
    .reduce((sum, p) => sum + p.amount, 0);

  const capturedCount = payments.filter((p) => p.status === 'CAPTURED').length;
  const pendingCount = payments.filter((p) => p.status === 'CREATED' || p.status === 'PENDING').length;

  if (loading) {
    return <Spinner text="Loading payment transactions..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Financial Operations
          </span>
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            Payment Transactions & Gateway Reconciliation
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Hotel UPI QR & Razorpay gateway logs, online transaction references, & idempotent reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" /> UPI & VPA Settings
          </button>
          <button
            onClick={fetchPayments}
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 font-bold text-xs text-stone-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500" /> Refresh Audit
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Captured Revenue</span>
          <p className="font-serif font-bold text-xl sm:text-2xl text-emerald-800">{formatCurrency(totalRevenue)}</p>
          <span className="text-[10px] text-emerald-700 font-semibold">{capturedCount} successful payments</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Pending Payments</span>
          <p className="font-serif font-bold text-xl sm:text-2xl text-amber-800">{pendingCount}</p>
          <span className="text-[10px] text-stone-500">Awaiting guest or staff payment</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Refunded</span>
          <p className="font-serif font-bold text-xl sm:text-2xl text-rose-800">{formatCurrency(totalRefunded)}</p>
          <span className="text-[10px] text-stone-500">Processed refunds</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Verification Engine</span>
          <p className="font-serif font-bold text-xl sm:text-2xl text-stone-900">Hotel QR + RZP</p>
          <span className="text-[10px] text-emerald-700 font-bold">HMAC Signature Verified</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 flex items-center gap-3 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by Order #, Payment ID, Customer Name/Email, or Gateway Txn Ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 p-3 bg-white rounded-2xl border border-stone-200/80 text-xs font-semibold text-stone-700 focus:border-amber-600 shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="CAPTURED">CAPTURED / PAID</option>
            <option value="CREATED">CREATED / PENDING</option>
            <option value="FAILED">FAILED</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="p-3 bg-white rounded-2xl border border-stone-200/80 text-xs font-semibold text-stone-700 focus:border-amber-600 shadow-2xs"
          >
            <option value="ALL">All Methods</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Cash">Cash</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase font-semibold border-b border-stone-200">
              <tr>
                <th className="p-4">Payment ID</th>
                <th className="p-4">Order Ref</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method & Provider</th>
                <th className="p-4">Gateway Txn Ref</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">
                    No payment records found matching the current search criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-4 font-mono font-bold text-stone-900">
                      {p.id}
                    </td>

                    <td className="p-4 font-mono font-bold text-amber-900">
                      {p.orderNumber || p.orderId}
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-stone-900">{p.customerName || 'Guest'}</p>
                      <p className="text-[11px] text-stone-400 font-mono">{p.customerEmail || ''}</p>
                    </td>

                    <td className="p-4 font-mono font-bold text-stone-900 text-sm">
                      {formatCurrency(p.amount)}
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-stone-800">{p.paymentMethod}</span>
                      <span className="block text-[10px] text-stone-400 uppercase font-bold">{p.provider || 'razorpay'}</span>
                    </td>

                    <td className="p-4 font-mono text-[11px] text-stone-600 max-w-[150px] truncate">
                      {p.providerPaymentId || p.providerOrderId || p.transactionId || '—'}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.status === 'CAPTURED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : p.status === 'REFUNDED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : p.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectPayment(p)}
                          className="px-2.5 py-1 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold rounded-lg text-[11px] cursor-pointer shadow-2xs"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          Details
                        </button>

                        {p.status === 'CAPTURED' && (
                          <>
                            <button
                              onClick={() => handleReconcilePayment(p.id)}
                              disabled={reconcilingId === p.id}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-lg text-[10px] cursor-pointer"
                              title="Ensure order is marked confirmed & paid"
                            >
                              {reconcilingId === p.id ? 'Reconciling...' : 'Reconcile'}
                            </button>

                            <button
                              onClick={() => handleOpenRefundModal(p)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              Refund
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Inspection Modal */}
      {inspectPayment && (
        <Modal
          isOpen={!!inspectPayment}
          onClose={() => setInspectPayment(null)}
          title={`Payment Inspection — ${inspectPayment.id}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs text-stone-700">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Number:</span>
                <span className="font-mono font-bold text-amber-900">#{inspectPayment.orderNumber || inspectPayment.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-bold text-stone-900">{inspectPayment.customerName} ({inspectPayment.customerEmail})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Amount:</span>
                <span className="font-mono font-bold text-stone-900 text-sm">{formatCurrency(inspectPayment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Status:</span>
                <span className="font-bold text-emerald-700">{inspectPayment.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Method:</span>
                <span className="font-bold text-stone-800">{inspectPayment.paymentMethod} ({inspectPayment.provider || 'razorpay'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Provider Order ID:</span>
                <span className="font-mono text-stone-700">{inspectPayment.providerOrderId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Provider Payment ID:</span>
                <span className="font-mono text-stone-700">{inspectPayment.providerPaymentId || inspectPayment.transactionId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Recorded At:</span>
                <span className="text-stone-600">{formatDate(inspectPayment.createdAt)} {formatTime(inspectPayment.createdAt)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setInspectPayment(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Settings Modal */}
      {settingsModalOpen && (
        <Modal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title="Hotel UPI & VPA Payment Settings"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs text-stone-700">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-1">
              <span className="font-bold block">Active Automated UPI ID</span>
              <p className="text-[11px] text-amber-800">
                All checkout QR codes dynamically generate using this VPA and exact payable amounts.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-stone-700">Hotel UPI ID / VPA</label>
              <input
                type="text"
                value={hotelUpiId}
                onChange={(e) => setHotelUpiId(e.target.value)}
                placeholder="e.g. 9620369291@ybl"
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-bold text-stone-700">Hotel Display Name</label>
                <input
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-700">Hotel Mobile Number</label>
                <input
                  type="text"
                  value={hotelMobile}
                  onChange={(e) => setHotelMobile(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-stone-700">Payment Instructions for Guests</label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs resize-none"
              />
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingSettings}
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer shadow-xs"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {refundModalPayment && (
        <Modal
          isOpen={!!refundModalPayment}
          onClose={() => setRefundModalPayment(null)}
          title={`Initiate Refund — Order #${refundModalPayment.orderNumber}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs text-stone-700">
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200/80 text-rose-950 space-y-1">
              <span className="font-bold block">Gateway Payment Reference:</span>
              <p className="font-mono text-[11px]">{refundModalPayment.providerPaymentId || refundModalPayment.transactionId}</p>
              <p className="text-[11px] text-rose-800">Original Total: <strong>{formatCurrency(refundModalPayment.amount)}</strong></p>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-stone-700">Refund Amount (₹)</label>
              <input
                type="number"
                max={refundModalPayment.amount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-stone-700">Refund Reason</label>
              <textarea
                rows={2}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs resize-none"
              />
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundModalPayment(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRefund}
                onClick={handleExecuteRefund}
                className="px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer shadow-xs"
              >
                {submittingRefund ? 'Processing Refund...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

