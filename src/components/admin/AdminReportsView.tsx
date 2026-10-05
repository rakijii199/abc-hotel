/**
 * Admin Reports & Analytics Component
 */
import React from 'react';
import { TrendingUp, Award, UtensilsCrossed, Calendar, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters.ts';

interface AdminReportsViewProps {
  reports: {
    ordersByType: Record<string, { count: number; revenue: number }>;
    topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
    totalOrdersCount: number;
    totalBookingsCount: number;
    totalRevenue: number;
  } | null;
}

export const AdminReportsView: React.FC<AdminReportsViewProps> = ({ reports }) => {
  if (!reports) {
    return <div className="p-8 text-center text-xs text-stone-400">Loading reports data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
          Analytics & Performance
        </span>
        <h2 className="font-serif text-2xl font-bold text-stone-900">
          Hotel Dining Operations Reports
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Sales breakdown, cuisine popularity metrics, and reservation traffic
        </p>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase text-stone-400">Total Net Revenue</span>
          <p className="font-serif font-bold text-2xl text-stone-900">
            {formatCurrency(reports.totalRevenue)}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold">
            ✓ Across all settled dining orders
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase text-stone-400">Total Food Orders</span>
          <p className="font-serif font-bold text-2xl text-indigo-700">
            {reports.totalOrdersCount}
          </p>
          <span className="text-[11px] text-stone-500">
            Kitchen orders dispatched
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase text-stone-400">Table Bookings</span>
          <p className="font-serif font-bold text-2xl text-amber-700">
            {reports.totalBookingsCount}
          </p>
          <span className="text-[11px] text-stone-500">
            Floor reservations recorded
          </span>
        </div>
      </div>

      {/* Service Type Breakdown & Top Dishes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Type Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-700" /> Revenue by Service Channel
          </h3>

          <div className="space-y-3">
            {Object.entries(reports.ordersByType).map(([type, stats]) => (
              <div key={type} className="p-4 bg-stone-50 rounded-xl space-y-2 border border-stone-200/60">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-900 text-sm">{type}</span>
                  <span className="font-mono font-bold text-stone-900">{formatCurrency(stats.revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-stone-500">
                  <span>{stats.count} Total Orders</span>
                  <span>{reports.totalRevenue > 0 ? `${Math.round((stats.revenue / reports.totalRevenue) * 100)}% of revenue` : '0%'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Selling Gourmet Dishes */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-700" /> Top Selling Signature Dishes
          </h3>

          <div className="space-y-3">
            {reports.topSellingItems.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No sales recorded yet.</p>
            ) : (
              reports.topSellingItems.map((item, idx) => (
                <div key={item.name} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-stone-900">{item.name}</p>
                      <p className="text-[11px] text-stone-500 font-mono">{item.quantity} orders placed</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-stone-900 text-sm">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
