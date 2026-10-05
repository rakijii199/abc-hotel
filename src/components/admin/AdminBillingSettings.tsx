import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle2, DollarSign, FileText } from 'lucide-react';
import { BillingSettings } from '../../types/index.ts';
import { BillingApi } from '../../api/billingApi.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Spinner } from '../common/Footer.tsx';

export const AdminBillingSettings: React.FC = () => {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await BillingApi.getSettings();
      setSettings(data);
    } catch (err: any) {
      error(err.message || 'Failed to load billing settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await BillingApi.updateSettings(settings);
      setSettings(updated);
      success('✓ Hotel & Billing Settings saved successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-stone-200 flex items-center justify-center">
        <Spinner size="lg" text="Loading hotel billing configuration..." />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-900 text-amber-300 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl text-stone-900">Hotel Details & Tax Settings</h2>
            <p className="text-xs text-stone-500">
              Configure legal entity information, GSTIN, FSSAI numbers, tax rates, and printed invoice footer.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-bold text-stone-700 block mb-1">Hotel Legal Name</label>
            <input
              type="text"
              value={settings.hotelName}
              onChange={(e) => setSettings({ ...settings, hotelName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-hidden focus:border-amber-800"
              required
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Hotel Logo URL</label>
            <input
              type="text"
              value={settings.hotelLogoUrl}
              onChange={(e) => setSettings({ ...settings, hotelLogoUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-[11px] focus:outline-hidden focus:border-amber-800"
            />
          </div>

          <div className="md:col-span-2">
            <label className="font-bold text-stone-700 block mb-1">Address</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-hidden focus:border-amber-800"
              required
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Contact Phone</label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:border-amber-800"
              required
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Contact Email</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:border-amber-800"
              required
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">GSTIN Number</label>
            <input
              type="text"
              value={settings.gstin}
              onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:border-amber-800 uppercase"
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">FSSAI Registration Number</label>
            <input
              type="text"
              value={settings.fssaiNumber}
              onChange={(e) => setSettings({ ...settings, fssaiNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-hidden focus:border-amber-800"
            />
          </div>
        </div>

        {/* Invoice Prefix & Tax Rates */}
        <div className="pt-4 border-t border-stone-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-stone-700 block mb-1">Invoice Number Prefix</label>
            <input
              type="text"
              value={settings.invoicePrefix}
              onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold uppercase"
              required
            />
            <p className="text-[10px] text-stone-400 mt-1">e.g. "INV" generates INV-2026-000101</p>
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">GST Tax Rate (%)</label>
            <input
              type="number"
              min="0"
              max="28"
              step="0.5"
              value={settings.gstPercent}
              onChange={(e) => setSettings({ ...settings, gstPercent: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Service Fee Rate (%)</label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={settings.serviceFeePercent}
              onChange={(e) => setSettings({ ...settings, serviceFeePercent: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
              required
            />
          </div>
        </div>

        {/* Footer & Terms */}
        <div className="pt-4 border-t border-stone-100 space-y-4 text-xs">
          <div>
            <label className="font-bold text-stone-700 block mb-1">Invoice Printable Footer Message</label>
            <input
              type="text"
              value={settings.invoiceFooter}
              onChange={(e) => setSettings({ ...settings, invoiceFooter: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-serif italic text-stone-800"
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Terms & Conditions</label>
            <textarea
              rows={2}
              value={settings.termsAndConditions}
              onChange={(e) => setSettings({ ...settings, termsAndConditions: e.target.value })}
              className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-700 text-xs"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="py-3 px-6 bg-gradient-to-r from-amber-800 to-amber-950 hover:from-amber-900 hover:to-black text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-300" />
            <span>{saving ? 'Saving Settings...' : 'Save Billing Settings'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
