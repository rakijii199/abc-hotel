import React, { useState, useEffect } from 'react';
import { Building2, ArrowLeft, Printer, Share2, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Invoice } from '../types/index.ts';
import { BillingApi } from '../api/billingApi.ts';
import { formatCurrency, formatDate } from '../utils/formatters.ts';
import { Spinner, EmptyState } from '../components/common/Footer.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { OrderLineChoices } from '../components/orders/OrderLineChoices.tsx';

export const PublicInvoicePage: React.FC<{
  token?: string;
  navigate?: (route: string) => void;
}> = ({ token, navigate }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { success, error } = useToast();

  useEffect(() => {
    if (!token) {
      setErrorMsg('Invoice security token missing.');
      setLoading(false);
      return;
    }

    const fetchPublicInvoice = async () => {
      try {
        const data = await BillingApi.getPublicInvoice(token);
        setInvoice(data);
      } catch (err: any) {
        setErrorMsg(err.message || 'Invoice not found or invalid token.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicInvoice();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen ambient flex items-center justify-center p-4">
        <Spinner size="lg" text="Retrieving verified tax invoice..." />
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div className="min-h-screen ambient flex items-center justify-center p-4">
        <div className="surface-raised !rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
          <h2 className="section-title !text-2xl">Invoice Unavailable</h2>
          <p className="text-xs text-stone-600">{errorMsg || 'Could not locate invoice.'}</p>
          {navigate && (
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary"
            >
              Go to Home Page
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ambient py-8 px-4 font-sans text-stone-800 print:bg-white print:p-0">
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* Navigation & Print Action Bar (Hidden in Print) */}
        <div className="glass flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 rounded-2xl print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--brand)]" />
            <span className="font-display font-bold text-stone-900 text-base">
              Invoice #{invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn btn-primary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Container */}
        <div className="surface-raised !rounded-2xl p-5 sm:p-8 print:shadow-none print:border-0 print:p-0">
          
          {/* Hotel Header */}
          <div className="text-center space-y-1.5 border-b border-dashed border-[var(--brand-border)] pb-4">
            <h1 className="lux-display text-3xl sm:text-4xl text-stone-900 tracking-[0.04em]">
              {invoice.hotelNameSnapshot || 'ABC HOTEL'}
            </h1>
            <p className="text-xs text-stone-600 max-w-sm mx-auto leading-tight">
              {invoice.hotelAddressSnapshot}
            </p>
            <div className="text-[11px] text-stone-500 flex flex-wrap items-center justify-center gap-2 pt-0.5">
              <span>Ph: {invoice.hotelPhoneSnapshot}</span>
              <span>•</span>
              <span>Email: {invoice.hotelEmailSnapshot}</span>
            </div>
            {(invoice.hotelGstinSnapshot || invoice.hotelFssaiSnapshot) && (
              <div className="text-[10px] font-mono text-stone-500 flex flex-wrap items-center justify-center gap-3 pt-0.5">
                {invoice.hotelGstinSnapshot && <span>GSTIN: {invoice.hotelGstinSnapshot}</span>}
                {invoice.hotelFssaiSnapshot && <span>FSSAI: {invoice.hotelFssaiSnapshot}</span>}
              </div>
            )}
            <div className="pt-2">
              <span className="badge badge-brand !px-3 !py-1 font-bold uppercase tracking-widest !text-[10px]">
                TAX INVOICE
              </span>
            </div>
          </div>

          {/* Invoice Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 text-xs py-2 border-b border-stone-100">
            <div className="space-y-1">
              <p>
                <strong className="text-stone-500">Invoice No:</strong>{' '}
                <span className="font-mono font-bold text-stone-900">{invoice.invoiceNumber}</span>
              </p>
              <p>
                <strong className="text-stone-500">Order Ref:</strong>{' '}
                <span className="font-mono font-semibold">#{invoice.orderNumber}</span>
              </p>
              <p>
                <strong className="text-stone-500">Date & Time:</strong>{' '}
                <span>{formatDate(invoice.createdAt)}</span>
              </p>
              <p>
                <strong className="text-stone-500">Type / Table:</strong>{' '}
                <span>{invoice.orderType} {invoice.tableNumber ? `(${invoice.tableNumber})` : ''}</span>
              </p>
            </div>

            <div className="space-y-1 sm:text-right">
              <p>
                <strong className="text-stone-500">Customer:</strong>{' '}
                <span className="font-bold text-stone-900">{invoice.customerName}</span>
              </p>
              <p>
                <strong className="text-stone-500">Phone:</strong>{' '}
                <span className="font-mono">{invoice.customerPhone}</span>
              </p>
              <p>
                <strong className="text-stone-500">Status:</strong>{' '}
                <span className={`badge font-bold !text-[10px] ${
                  invoice.paymentStatus === 'PAID'
                    ? 'badge-success'
                    : 'badge-warning'
                }`}>
                  {invoice.paymentStatus}
                </span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          {/* Scrolls horizontally inside the invoice on narrow phones */}
          <div className="my-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-stone-200 text-stone-500 uppercase text-[10px]">
                  <th className="py-2 text-left">Item Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-2 font-medium text-stone-900">
                      <div>{item.productNameSnapshot}<OrderLineChoices item={item} /></div>
                      {item.specialInstructions && (
                        <div className="text-[10px] text-stone-500 italic font-normal">
                          Note: {item.specialInstructions}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold">{item.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(item.unitPriceSnapshot)}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-stone-900">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="space-y-1.5 text-xs text-right border-t-2 border-stone-200 pt-3 max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-stone-500">Item Subtotal:</span>
              <span className="font-mono font-semibold">{formatCurrency(invoice.subtotal)}</span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount {invoice.discountCode ? `(${invoice.discountCode})` : ''}:</span>
                <span className="font-mono">-{formatCurrency(invoice.discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-stone-600">
              <span>GST ({invoice.gstPercent}%):</span>
              <span className="font-mono">{formatCurrency(invoice.tax)}</span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>Service Charge{invoice.serviceFeePercent ? ` (${invoice.serviceFeePercent}%)` : ''}:</span>
              <span className="font-mono">{formatCurrency(invoice.serviceCharge)}</span>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-stone-900 pt-2 border-t-2 border-[var(--brand)]">
              <span>Grand Total:</span>
              <span className="text-lg text-[var(--brand-text)] font-extrabold font-mono">
                {formatCurrency(invoice.grandTotal)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t border-stone-200 text-stone-500 space-y-1">
            <p className="font-display italic font-semibold text-stone-800 text-sm">
              {invoice.invoiceFooterSnapshot || 'Thank you for dining at ABC HOTEL.'}
            </p>
            {invoice.termsSnapshot && (
              <p className="text-[10px] text-stone-500 max-w-md mx-auto leading-tight">
                {invoice.termsSnapshot}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
