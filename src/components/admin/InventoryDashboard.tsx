import React from 'react';
import { InventoryStats } from '../../types/index.ts';
import { Boxes, DollarSign, AlertTriangle, XCircle, Truck, ClipboardList } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters.ts';

interface InventoryDashboardProps {
  stats: InventoryStats | null;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ stats }) => {
  if (!stats) return <div className="p-4 text-stone-500">Loading dashboard...</div>;

  const cards = [
    { title: 'Total Items', value: stats.totalItems, icon: Boxes, color: 'text-stone-900', bg: 'bg-stone-50' },
    { title: 'Total Valuation', value: formatCurrency(stats.totalValuation), icon: DollarSign, color: 'text-emerald-900', bg: 'bg-emerald-50' },
    { title: 'Low Stock', value: stats.lowStockItemsCount, icon: AlertTriangle, color: 'text-amber-900', bg: 'bg-amber-50' },
    { title: 'Out of Stock', value: stats.outOfStockItemsCount, icon: XCircle, color: 'text-rose-900', bg: 'bg-rose-50' },
    { title: 'Total Suppliers', value: stats.suppliersCount, icon: Truck, color: 'text-blue-900', bg: 'bg-blue-50' },
    { title: 'Pending POs', value: stats.pendingPOsCount, icon: ClipboardList, color: 'text-purple-900', bg: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className={`p-5 rounded-3xl border border-stone-200/50 ${card.bg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-500">{card.title}</span>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <p className={`font-serif text-2xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
};
