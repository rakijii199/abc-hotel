/**
 * Admin Operations Audit Log Component
 */
import React, { useState } from 'react';
import { History, Search, ShieldCheck } from 'lucide-react';
import { AuditLog } from '../../types/index.ts';
import { formatDate, formatTime } from '../../utils/formatters.ts';

export const AdminAuditView: React.FC<{ auditLogs: AuditLog[] }> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const filtered = auditLogs.filter((log) => {
    if (entityFilter !== 'ALL' && log.entity !== entityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.adminEmail.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="lux-eyebrow text-amber-800">
            Compliance & Security
          </span>
          <h2 className="page-title">
            System Operations Audit Log ({auditLogs.length})
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Immutable log of administrative operations, menu modifications, price adjustments, and booking actions
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-[var(--shadow-card)]">
        <div className="flex-1 flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-stone-200 focus-within:border-amber-700 focus-within:ring-3 focus-within:ring-[var(--brand-ring-soft)] transition-shadow">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search audit trail by admin email, action name, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700"
        >
          <option value="ALL">All Entities</option>
          <option value="MENU_ITEM">Menu Items</option>
          <option value="BOOKING">Bookings</option>
          <option value="ORDER">Orders</option>
          <option value="TABLE">Tables</option>
          <option value="CATEGORY">Categories</option>
          <option value="SETTINGS">Settings</option>
        </select>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--brand-soft)] text-stone-600 uppercase font-semibold tracking-wide border-b border-[var(--brand-border)]">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Staff Admin</th>
                <th className="p-4">Action</th>
                <th className="p-4">Entity</th>
                <th className="p-4">Activity Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    No audit records match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--brand-soft)]/60 transition-colors">
                    <td className="p-4 font-mono text-stone-600 text-[11px] whitespace-nowrap">
                      {formatDate(log.timestamp)} • {formatTime(log.timestamp)}
                    </td>

                    <td className="p-4 font-mono font-bold text-stone-800">
                      {log.adminEmail}
                    </td>

                    <td className="p-4">
                      <span className="badge font-mono">
                        {log.action}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="badge badge-brand">
                        {log.entity}
                      </span>
                    </td>

                    <td className="p-4 text-stone-700">
                      {log.details || 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
