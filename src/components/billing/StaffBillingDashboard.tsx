import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  DollarSign,
  Share2,
  FileText,
  RotateCcw,
  User,
  Smartphone,
  Calendar,
  Building2,
  AlertCircle
} from 'lucide-react';
import { Order, Invoice } from '../../types/index.ts';
import { BillingApi } from '../../api/billingApi.ts';
import { formatCurrency, formatDate } from '../../utils/formatters.ts';
import { Spinner, EmptyState } from '../common/Footer.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { InvoiceViewModal } from './InvoiceViewModal.tsx';

export const StaffBillingDashboard: React.FC<{
  isStaffOrAdmin?: boolean;
}> = ({ isStaffOrAdmin = true }) => {
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'PENDING' | 'PAID' | 'HISTORY'>('REQUESTS');
  const [requests, setRequests] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchText] = useState('');
  
  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { success, error, info } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqData, invData] = await Promise.all([
        BillingApi.getBillingRequests(),
        BillingApi.getBillingHistory()
      ]);
      setRequests(reqData);
      setInvoices(invData);
    } catch (err: any) {
      error(err.message || 'Failed to load billing requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleProceedToBilling = async (orderId: string) => {
    setGeneratingId(orderId);
    try {
      const res = await BillingApi.generateInvoice(orderId);
      if (res && res.invoice) {
        setSelectedInvoice(res.invoice);
        setModalOpen(true);
        fetchData();
      } else {
        const inv = await BillingApi.getInvoice(orderId);
        if (inv) {
          setSelectedInvoice(inv);
          setModalOpen(true);
          fetchData();
        }
      }
    } catch (err: any) {
      try {
        const inv = await BillingApi.getInvoice(orderId);
        if (inv) {
          setSelectedInvoice(inv);
          setModalOpen(true);
          fetchData();
          return;
        }
      } catch {
        // ignore fallback error
      }
      error(err.message || 'Could not generate invoice.');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleOpenExistingInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setModalOpen(true);
  };

  // Filtered Billing Requests
  const filteredRequests = requests.filter((r) => {
    const text = searchTerm.toLowerCase();
    const matchesSearch =
      r.orderNumber.toLowerCase().includes(text) ||
      r.customerName.toLowerCase().includes(text) ||
      r.customerPhone.toLowerCase().includes(text) ||
      (r.tableNumber && r.tableNumber.toLowerCase().includes(text));

    return matchesSearch;
  });

  // Filtered Invoices
  const filteredInvoices = invoices.filter((i) => {
    const text = searchTerm.toLowerCase();
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(text) ||
      i.orderNumber.toLowerCase().includes(text) ||
      i.customerName.toLowerCase().includes(text) ||
      i.customerPhone.toLowerCase().includes(text) ||
      (i.tableNumber && i.tableNumber.toLowerCase().includes(text));

    if (activeTab === 'PENDING') return matchesSearch && i.paymentStatus !== 'PAID';
    if (activeTab === 'PAID') return matchesSearch && i.paymentStatus === 'PAID';
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-900 text-amber-300 flex items-center justify-center font-bold shadow-xs">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl text-stone-900">
              Staff Billing Dashboard
            </h1>
            <p className="text-xs text-stone-500">
              Process customer dining bills, generate invoices, collect payments, print & share receipts.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4 text-stone-500" />
          <span>Refresh Requests</span>
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-200/80 rounded-2xl overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'REQUESTS'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Billing Requests</span>
            {requests.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-500 text-amber-950 font-mono text-[10px] rounded-full">
                {requests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'PENDING'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Pending Payments</span>
          </button>

          <button
            onClick={() => setActiveTab('PAID')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'PAID'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Paid Bills</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>All History</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search Order #, Invoice #, Table..."
            value={searchTerm}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs font-mono focus:outline-hidden focus:border-amber-800 shadow-2xs"
          />
        </div>
      </div>

      {/* Main Content Body */}
      {loading ? (
        <div className="py-12 bg-white rounded-3xl border border-stone-200 flex items-center justify-center">
          <Spinner size="lg" text="Loading billing pipeline..." />
        </div>
      ) : activeTab === 'REQUESTS' ? (
        /* BILLING REQUESTS CARDS */
        filteredRequests.length === 0 ? (
          <EmptyState
            title="No Active Billing Requests"
            description="When dining customers click 'Done / Request Bill', their requests will appear here instantly."
            icon="receipt"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRequests.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-3xl border-2 border-amber-200/90 p-5 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                        {order.tableNumber || order.orderType}
                      </span>
                      <h3 className="font-serif font-bold text-lg text-stone-900 mt-1">
                        Order #{order.orderNumber}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-xl text-stone-900">
                        {formatCurrency(order.total)}
                      </div>
                      <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                        {order.status === 'BILLING_PENDING' || order.customerStatus === 'DONE'
                          ? '🔔 Billing Requested'
                          : order.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600">
                    <p className="flex items-center gap-1.5 font-medium text-stone-900">
                      <User className="w-3.5 h-3.5 text-stone-400" />
                      <span>{order.customerName}</span>
                      <span className="text-stone-400 font-mono text-[11px]">({order.customerPhone})</span>
                    </p>

                    <p className="text-[11px] text-stone-500">
                      Placed at {formatDate(order.createdAt)} • {order.items.length} Items
                    </p>

                    <div className="p-2.5 bg-stone-50 rounded-xl space-y-1 border border-stone-200/60 text-[11px]">
                      {order.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span className="truncate max-w-[180px] font-medium text-stone-800">
                            {item.quantity}× {item.name}
                          </span>
                          <span className="font-mono text-stone-600">{formatCurrency(item.totalPrice)}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-[10px] text-amber-800 font-semibold pt-0.5">
                          + {order.items.length - 3} more items...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleProceedToBilling(order.id)}
                    disabled={generatingId === order.id}
                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-800 to-amber-950 hover:from-amber-900 hover:to-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Receipt className="w-4 h-4 text-amber-300" />
                    <span>
                      {generatingId === order.id ? 'Calculating Bill...' : 'Bill'}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* INVOICES TABLE (PENDING, PAID, HISTORY) */
        filteredInvoices.length === 0 ? (
          <EmptyState
            title="No Invoices Found"
            description="Generate a bill from active requests to view invoices."
            icon="receipt"
          />
        ) : (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase text-[10px] font-bold">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Order # / Table</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4 text-center">Method</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-stone-800">#{inv.orderNumber}</span>
                        <span className="block text-[11px] text-stone-500">{inv.tableNumber || inv.orderType}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-stone-900">{inv.customerName}</span>
                        <span className="block font-mono text-[11px] text-stone-500">{inv.customerPhone}</span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-500 whitespace-nowrap">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 text-sm">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        {inv.paymentMethod}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            inv.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenExistingInvoice(inv)}
                          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-[11px] inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View & Print</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onPaymentSuccess={() => {
            fetchData();
          }}
          isStaffOrAdmin={isStaffOrAdmin}
        />
      )}
    </div>
  );
};
