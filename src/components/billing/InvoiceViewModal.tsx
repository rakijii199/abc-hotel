import React, { useState } from 'react';
import {
  Printer,
  Download,
  Share2,
  Copy,
  Check,
  Send,
  MessageSquare,
  CreditCard,
  DollarSign,
  X,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Invoice, InvoicePrintFormat, PaymentMethod } from '../../types/index.ts';
import { formatCurrency, formatDate } from '../../utils/formatters.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { BillingApi } from '../../api/billingApi.ts';

interface InvoiceViewModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: () => void;
  isStaffOrAdmin?: boolean;
}

export const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onPaymentSuccess,
  isStaffOrAdmin = false
}) => {
  const [printFormat, setPrintFormat] = useState<InvoicePrintFormat>('A4');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  const { success, error, info } = useToast();

  if (!isOpen || !invoice) return null;

  const publicUrl = `${window.location.origin}/invoice/view/${invoice.publicToken}`;

  const shareText = `ABC HOTEL Tax Invoice ${invoice.invoiceNumber}\nOrder #${invoice.orderNumber} • ${invoice.tableNumber || 'Takeaway'}\nAmount: ${formatCurrency(invoice.grandTotal)}\nStatus: ${invoice.paymentStatus}\nView Invoice: ${publicUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    success('Invoice link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ABC HOTEL Invoice - ${invoice.invoiceNumber}`,
          text: shareText,
          url: publicUrl
        });
        success('Invoice shared successfully.');
      } catch {
        // User cancelled share
      }
    } else {
      setShowShareOptions(true);
    }
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // Standard print-to-PDF or printable download window trigger
    info('Opening PDF preview... Choose "Save as PDF" in your print dialog.');
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleCollectPayment = async () => {
    setIsProcessingPay(true);
    try {
      const res = await BillingApi.payInvoice(invoice.id, selectedMethod, {
        reference: paymentRef || `COLLECTED-${selectedMethod}-${Date.now().toString().slice(-6)}`
      });
      success(`✓ Payment Collected! Invoice ${invoice.invoiceNumber} marked PAID.`);
      setShowPayModal(false);
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      error(err.message || 'Payment collection failed.');
    } finally {
      setIsProcessingPay(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden print:max-w-none print:max-h-none print:border-0 print:shadow-none print:rounded-none">
        
        {/* Top Control Header (Hidden in Print) */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-serif font-bold text-sm leading-none">
                Invoice {invoice.invoiceNumber}
              </h3>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Order #{invoice.orderNumber} • {invoice.tableNumber || 'Dine-in'}
              </p>
            </div>
          </div>

          {/* Format Toggle Buttons */}
          <div className="flex items-center gap-2">
            <div className="bg-stone-800 p-1 rounded-xl flex items-center gap-1 text-[11px] font-semibold border border-stone-700">
              {(['A4', '80mm', '58mm'] as InvoicePrintFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setPrintFormat(fmt)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    printFormat === fmt ? 'bg-amber-600 text-white font-bold' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar (Hidden in Print) */}
        <div className="p-3 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bill</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Bill</span>
            </button>
          </div>

          {isStaffOrAdmin && invoice.paymentStatus !== 'PAID' && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <DollarSign className="w-4 h-4 text-amber-300" />
              <span>Collect Payment</span>
            </button>
          )}
        </div>

        {/* Printable Invoice Container */}
        <div
          id="printable-invoice"
          className={`p-6 sm:p-8 overflow-y-auto font-sans text-stone-800 bg-white ${
            printFormat === '80mm'
              ? 'max-w-[320px] mx-auto text-[11px] p-4 font-mono'
              : printFormat === '58mm'
              ? 'max-w-[240px] mx-auto text-[10px] p-3 font-mono'
              : 'w-full'
          }`}
        >
          {/* Header & Logo */}
          <div className="text-center space-y-1.5 border-b border-stone-200 pb-4">
            <h1 className="font-serif font-bold text-2xl text-stone-900 tracking-tight">
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
              <span className="inline-block px-3 py-1 bg-stone-100 text-stone-900 font-bold uppercase tracking-widest text-[10px] rounded-md border border-stone-300">
                TAX INVOICE
              </span>
            </div>
          </div>

          {/* Invoice Meta Grid */}
          <div className="grid grid-cols-2 gap-4 my-4 text-xs py-2 border-b border-stone-100">
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

            <div className="space-y-1 text-right">
              <p>
                <strong className="text-stone-500">Customer:</strong>{' '}
                <span className="font-bold text-stone-900">{invoice.customerName}</span>
              </p>
              <p>
                <strong className="text-stone-500">Phone:</strong>{' '}
                <span className="font-mono">{invoice.customerPhone}</span>
              </p>
              {invoice.customerEmail && (
                <p>
                  <strong className="text-stone-500">Email:</strong>{' '}
                  <span className="truncate max-w-[150px] inline-block">{invoice.customerEmail}</span>
                </p>
              )}
              <p>
                <strong className="text-stone-500">Status:</strong>{' '}
                <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] border ${
                  invoice.paymentStatus === 'PAID'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {invoice.paymentStatus}
                </span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full my-4 border-collapse text-xs">
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
                    <div>{item.productNameSnapshot}</div>
                    {item.specialInstructions && (
                      <div className="text-[10px] text-stone-400 italic font-normal">
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
              <span>Taxable Amount:</span>
              <span className="font-mono">{formatCurrency(invoice.taxableAmount)}</span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>GST ({invoice.gstPercent}%):</span>
              <span className="font-mono">{formatCurrency(invoice.tax)}</span>
            </div>

            <div className="flex justify-between text-stone-600">
              <span>Service Fee ({invoice.serviceFeePercent}%):</span>
              <span className="font-mono">{formatCurrency(invoice.serviceCharge)}</span>
            </div>

            <div className="flex justify-between items-center text-sm font-bold text-stone-900 pt-2 border-t-2 border-stone-800">
              <span>Grand Total:</span>
              <span className="font-serif text-lg text-amber-900 font-extrabold font-mono">
                {formatCurrency(invoice.grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment Method Details */}
          <div className="mt-5 p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Payment Mode:</span>
              <span className="font-bold text-stone-900">{invoice.paymentMethod}</span>
            </div>
            {invoice.paymentReference && (
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-stone-500">Transaction Ref:</span>
                <span className="font-bold text-stone-800">{invoice.paymentReference}</span>
              </div>
            )}
            {invoice.receivedBy && (
              <div className="flex justify-between text-[11px]">
                <span className="text-stone-500">Collected By:</span>
                <span className="font-medium text-stone-700">{invoice.receivedBy}</span>
              </div>
            )}
          </div>

          {/* Footer & Terms */}
          <div className="text-center mt-6 pt-4 border-t border-stone-200 text-stone-500 space-y-1">
            <p className="font-serif italic font-bold text-stone-800 text-xs">
              {invoice.invoiceFooterSnapshot || 'Thank you for dining at ABC HOTEL.'}
            </p>
            {invoice.termsSnapshot && (
              <p className="text-[10px] text-stone-400 max-w-md mx-auto leading-tight">
                {invoice.termsSnapshot}
              </p>
            )}
          </div>
        </div>

        {/* Share Options Popup Modal */}
        {showShareOptions && (
          <div className="p-4 bg-stone-900 text-white border-t border-stone-800 space-y-3 print:hidden">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Share Invoice Options
              </h4>
              <button onClick={() => setShowShareOptions(false)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <button
                onClick={handleWhatsAppShare}
                className="p-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="p-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="p-2.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer col-span-2 sm:col-span-1"
              >
                <Download className="w-4 h-4" />
                <span>PDF Document</span>
              </button>
            </div>
          </div>
        )}

        {/* Staff Collect Payment Sub-Modal */}
        {showPayModal && (
          <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-stone-800 shadow-2xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Collect Payment — {formatCurrency(invoice.grandTotal)}
                </h3>
                <button onClick={() => setShowPayModal(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMethod(m)}
                        className={`p-2.5 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                          selectedMethod === m
                            ? 'bg-amber-800 text-white border-amber-900'
                            : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Transaction Ref / Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Cash received in till / Bank UTR / Card Slip #"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCollectPayment}
                  disabled={isProcessingPay}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessingPay ? 'Processing...' : 'Mark Payment PAID'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-3 bg-stone-100 hover:bg-stone-200 font-bold rounded-xl text-xs text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
