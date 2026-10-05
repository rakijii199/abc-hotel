/**
 * Hotel Payment & UPI QR Configuration Panel (Admin)
 * Manage Hotel VPA, Brand Name, Mobile Numbers, and QR Image Asset
 */
import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Save,
  Upload,
  Smartphone,
  Building2,
  Sparkles
} from 'lucide-react';
import { PaymentApi } from '../../api/index.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Spinner } from '../common/Footer.tsx';

export const AdminPaymentSettingsView: React.FC = () => {
  const { error, success, info } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Form State
  const [hotelName, setHotelName] = useState<string>('ABC HOTEL');
  const [hotelUpiId, setHotelUpiId] = useState<string>('abchotel@upi');
  const [hotelMobileNumber, setHotelMobileNumber] = useState<string>('+91 98765 43210');
  const [hotelQrCodeUrl, setHotelQrCodeUrl] = useState<string>('');
  const [paymentProvider, setPaymentProvider] = useState<'razorpay' | 'custom_upi'>('razorpay');
  const [paymentEnvironment, setPaymentEnvironment] = useState<'test' | 'production'>('production');
  const [paymentInstructions, setPaymentInstructions] = useState<string>(
    'Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, CRED). Pay exact amount for instant automated order confirmation.'
  );
  const [supportContactNumber, setSupportContactNumber] = useState<string>('+91 22 4987 6543');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await PaymentApi.getAdminPaymentSettings();
      if (data) {
        setHotelName(data.hotelName || 'ABC HOTEL');
        setHotelUpiId(data.hotelUpiId || 'abchotel@upi');
        setHotelMobileNumber(data.hotelMobileNumber || '+91 98765 43210');
        setHotelQrCodeUrl(data.hotelQrCodeUrl || '');
        setPaymentProvider(data.paymentProvider || 'razorpay');
        setPaymentEnvironment(data.paymentEnvironment || 'production');
        setPaymentInstructions(
          data.paymentInstructions ||
            'Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, CRED). Pay exact amount for instant automated order confirmation.'
        );
        setSupportContactNumber(data.supportContactNumber || '+91 22 4987 6543');
      }
    } catch (err: any) {
      error(err.message || 'Failed to load payment settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await PaymentApi.updateAdminPaymentSettings({
        hotelName: hotelName.trim(),
        hotelUpiId: hotelUpiId.trim(),
        hotelMobileNumber: hotelMobileNumber.trim(),
        hotelQrCodeUrl: hotelQrCodeUrl.trim(),
        paymentProvider,
        paymentEnvironment,
        paymentInstructions: paymentInstructions.trim(),
        supportContactNumber: supportContactNumber.trim()
      });

      success('Hotel Payment Configuration saved successfully!');
    } catch (err: any) {
      error(err.message || 'Failed to update payment settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 3MB)
    if (file.size > 3 * 1024 * 1024) {
      error('QR code image size must be under 3MB.');
      return;
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      error('Please upload a valid image file (PNG, JPG, WEBP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setHotelQrCodeUrl(base64String);
      success('QR Code image loaded! Click "Save Payment Settings" to apply.');
    };
    reader.onerror = () => {
      error('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const sampleUpiIntent = `upi://pay?pa=${encodeURIComponent(hotelUpiId)}&pn=${encodeURIComponent(hotelName)}&am=730&cu=INR`;
  const previewQrSrc =
    hotelQrCodeUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(sampleUpiIntent)}&margin=10`;

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-stone-200 shadow-xs flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-stone-500">Loading hotel payment configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-amber-200 flex items-center justify-center shadow-xs shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-bold text-xl text-stone-900">Hotel Payment & UPI QR Settings</h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure hotel bank VPA, receiving accounts, and official QR code image
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Hotel UPI VPA & Mobile */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-800" />
              1. Hotel UPI Identity & Receiving Account
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700">Hotel Display Name</label>
                <input
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="E.g. ABC HOTEL"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:bg-white transition-all"
                  required
                />
                <p className="text-[10px] text-stone-400">Shown to guests on UPI payment screen and bank receipts</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700">Hotel UPI ID / VPA</label>
                <input
                  type="text"
                  value={hotelUpiId}
                  onChange={(e) => setHotelUpiId(e.target.value)}
                  placeholder="E.g. abchotel@upi or abchotel@icici"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono font-bold text-stone-900 focus:bg-white transition-all"
                  required
                />
                <p className="text-[10px] text-stone-400">Destination VPA where guest funds are deposited</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700">Hotel Payment Mobile Number</label>
                <input
                  type="text"
                  value={hotelMobileNumber}
                  onChange={(e) => setHotelMobileNumber(e.target.value)}
                  placeholder="E.g. +91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white transition-all"
                  required
                />
                <p className="text-[10px] text-stone-400">Associated UPI mobile for verification reference</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700">Concierge / Support Phone</label>
                <input
                  type="text"
                  value={supportContactNumber}
                  onChange={(e) => setSupportContactNumber(e.target.value)}
                  placeholder="E.g. +91 22 4987 6543"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:bg-white transition-all"
                  required
                />
                <p className="text-[10px] text-stone-400">Helpdesk number for payment inquiries</p>
              </div>
            </div>
          </div>

          {/* Section 2: Hotel QR Code Image Asset */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-800" />
              2. Hotel UPI QR Code Image
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              {/* QR Preview Thumbnail */}
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col items-center justify-center text-center">
                <div className="w-32 h-32 rounded-xl bg-white border border-stone-200 p-1.5 flex items-center justify-center overflow-hidden">
                  <img
                    src={previewQrSrc}
                    alt="Active Hotel QR"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[10px] font-bold text-stone-500 mt-2">Active QR Asset</span>
              </div>

              {/* Upload Controls */}
              <div className="sm:col-span-2 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700">Upload Official Hotel QR Image</label>
                  <div className="flex items-center gap-2">
                    <label className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border border-stone-200 shadow-2xs">
                      <Upload className="w-4 h-4 text-stone-600" />
                      <span>Choose File (PNG, JPG, WEBP)</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                        onChange={handleQrFileUpload}
                        className="hidden"
                      />
                    </label>

                    {hotelQrCodeUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setHotelQrCodeUrl('');
                          info('Reset to dynamic generated UPI QR.');
                        }}
                        className="px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-400">
                    Max size: 3MB. If no custom image is uploaded, high-resolution dynamic UPI QR will be generated automatically.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-stone-700">Or External Image URL</label>
                  <input
                    type="url"
                    value={hotelQrCodeUrl}
                    onChange={(e) => setHotelQrCodeUrl(e.target.value)}
                    placeholder="https://.../hotel-qr.png"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Saving Configuration...' : 'Save Payment Settings'}</span>
            </button>
          </div>
        </div>

        {/* Right Col: Live Guest Preview Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-800" />
                Live Customer Preview
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            </div>

            {/* Mobile Mockup Card */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3 text-center">
              <div className="w-8 h-8 rounded-lg bg-amber-800 text-amber-200 font-serif font-bold text-xs flex items-center justify-center mx-auto">
                ABC
              </div>

              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase">Pay Recipient</p>
                <p className="font-serif font-bold text-stone-900 text-sm">{hotelName}</p>
                <p className="font-serif font-bold text-amber-900 text-2xl mt-1">₹730.00</p>
              </div>

              <div className="w-40 h-40 bg-white rounded-xl border border-stone-200 p-1.5 mx-auto flex items-center justify-center shadow-2xs">
                <img
                  src={previewQrSrc}
                  alt="QR Preview"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-left text-[11px] space-y-1">
                <p className="text-[9px] uppercase font-bold text-stone-400">UPI ID</p>
                <p className="font-mono font-bold text-stone-900 truncate">{hotelUpiId}</p>
              </div>

              <p className="text-[10px] text-stone-500 leading-tight">
                {paymentInstructions || 'Scan the QR code using any UPI app to pay.'}
              </p>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-[11px] text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                <span>Security Assurance</span>
              </div>
              <p className="text-[10px] text-amber-900/80">
                Payment amounts are recalculated on the server. Machine verification ensures zero fraudulent order placements.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
