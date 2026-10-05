import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Smartphone,
  PieChart,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { BillingApi } from '../../api/billingApi.ts';
import { formatCurrency } from '../../utils/formatters.ts';
import { Spinner } from '../common/Footer.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export const AdminBillingReports: React.FC = () => {
  const [reports, setReports] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { error } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await BillingApi.getReports({ startDate, endDate });
      setReports(data);
    } catch (err: any) {
      error(err.message || 'Failed to load billing reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports();
  };

  return (
    <div className="space-y-6">
      {/* Date Filter Bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-800" />
          <span className="font-bold text-stone-900">Billing Financial Reports</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl cursor-pointer shadow-2xs"
          >
            Apply Filter
          </button>

          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              fetchReports();
            }}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </form>

      {loading ? (
        <div className="py-12 bg-white rounded-3xl border border-stone-200 flex items-center justify-center">
          <Spinner size="lg" text="Calculating financial metrics..." />
        </div>
      ) : !reports ? null : (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-gradient-to-tr from-amber-900 to-stone-900 text-white p-5 rounded-3xl shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                  Total Paid Revenue
                </span>
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <div className="font-serif font-extrabold text-3xl font-mono">
                {formatCurrency(reports.totalSales || 0)}
              </div>
              <p className="text-[11px] text-amber-200/80">
                From {reports.paidBillsCount || 0} paid invoices
              </p>
            </div>

            {/* Total Invoices */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Total Bills Issued
                </span>
                <Receipt className="w-5 h-5 text-stone-500" />
              </div>
              <div className="font-serif font-extrabold text-3xl text-stone-900 font-mono">
                {reports.totalBills || 0}
              </div>
              <p className="text-[11px] text-stone-500">
                {reports.pendingBillsCount || 0} pending payment
              </p>
            </div>

            {/* GST Collected */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  GST Tax Collected
                </span>
                <PieChart className="w-5 h-5 text-amber-800" />
              </div>
              <div className="font-serif font-extrabold text-3xl text-amber-900 font-mono">
                {formatCurrency(reports.totalGst || 0)}
              </div>
              <p className="text-[11px] text-stone-500">5% Govt GST Tax</p>
            </div>

            {/* Service Charges */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                  Service Charges
                </span>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="font-serif font-extrabold text-3xl text-emerald-800 font-mono">
                {formatCurrency(reports.totalServiceCharge || 0)}
              </div>
              <p className="text-[11px] text-stone-500">5% Service Fee</p>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-lg text-stone-900 border-b border-stone-100 pb-3">
              Collection Breakdown by Payment Mode
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-950">
                  <span>Cash Collection</span>
                  <DollarSign className="w-4 h-4 text-amber-800" />
                </div>
                <div className="font-mono font-extrabold text-2xl text-amber-900">
                  {formatCurrency(reports.cashSales || 0)}
                </div>
                <p className="text-[10px] text-amber-800">Collected in register till</p>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-1">
                <div className="flex items-center justify-between font-bold text-emerald-950">
                  <span>UPI QR Collection</span>
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="font-mono font-extrabold text-2xl text-emerald-900">
                  {formatCurrency(reports.upiSales || 0)}
                </div>
                <p className="text-[10px] text-emerald-800">PhonePe / GPay / Paytm</p>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-stone-900">
                  <span>Card Payments</span>
                  <CreditCard className="w-4 h-4 text-stone-600" />
                </div>
                <div className="font-mono font-extrabold text-2xl text-stone-900">
                  {formatCurrency(reports.cardSales || 0)}
                </div>
                <p className="text-[10px] text-stone-500">Credit / Debit POS Terminal</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
