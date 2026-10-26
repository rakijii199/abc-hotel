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
    { title: 'Total Items', value: stats.totalItems, icon: Boxes, color: 'text-[var(--brand-text)]', bg: '' },
    { title: 'Total Valuation', value: formatCurrency(stats.totalValuation), icon: DollarSign, color: 'text-[var(--success)]', bg: '' },
    { title: 'Low Stock', value: stats.lowStockItemsCount, icon: AlertTriangle, color: 'text-[var(--warning)]', bg: '' },
    { title: 'Out of Stock', value: stats.outOfStockItemsCount, icon: XCircle, color: 'text-[var(--danger)]', bg: '' },
    { title: 'Total Suppliers', value: stats.suppliersCount, icon: Truck, color: 'text-[var(--info)]', bg: '' },
    { title: 'Pending POs', value: stats.pendingPOsCount, icon: ClipboardList, color: 'text-stone-800', bg: '' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className={`stat-card p-5 ${card.bg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps">{card.title}</span>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <p className={`font-serif text-2xl font-bold leading-tight tabular-nums ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
};
