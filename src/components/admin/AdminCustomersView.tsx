/**
 * Admin Customer Directory Component
 */
import React, { useState } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Eye,
  Shield
} from 'lucide-react';
import { SafeUser, Order, TableBooking } from '../../types/index.ts';
import { formatDate, formatCurrency } from '../../utils/formatters.ts';
import { Modal } from '../common/Footer.tsx';
import { AdminApi } from '../../api/index.ts';

interface CustomerWithMetrics extends SafeUser {
  totalOrders: number;
  totalBookings: number;
  totalSpend: number;
}

export const AdminCustomersView: React.FC<{ customers: CustomerWithMetrics[] }> = ({ customers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<{
    user: SafeUser;
    orders: Order[];
    bookings: TableBooking[];
    metrics: { totalOrders: number; totalBookings: number; totalSpend: number };
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const filtered = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const handleViewCustomer = async (userId: string) => {
    setLoadingDetails(true);
    try {
      const data = await AdminApi.getCustomerById(userId);
      setSelectedCustomerDetails(data);
    } catch (err) {
      console.error('Failed to fetch customer details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Guest Directory
          </span>
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            Registered Customers ({customers.length})
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            View customer profile histories, reservation counts, and dining spend
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
        <Search className="w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Search by customer name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase font-semibold border-b border-stone-200">
              <tr>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Registration Date</th>
                <th className="p-4 text-center">Total Orders</th>
                <th className="p-4 text-center">Total Bookings</th>
                <th className="p-4 text-right">Total Dining Spend</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold font-serif flex items-center justify-center text-xs">
                          {c.firstName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{c.firstName} {c.lastName}</p>
                          <span className="text-[10px] font-mono text-stone-400">ID: {c.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <p className="font-mono text-stone-800">{c.email}</p>
                      <p className="font-mono text-[11px] text-stone-500">{c.phone}</p>
                    </td>

                    <td className="p-4 font-mono text-stone-600">
                      {formatDate(c.createdAt)}
                    </td>

                    <td className="p-4 text-center font-mono font-bold text-stone-800">
                      {c.totalOrders || 0}
                    </td>

                    <td className="p-4 text-center font-mono font-bold text-stone-800">
                      {c.totalBookings || 0}
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-stone-900 text-sm">
                      {formatCurrency(c.totalSpend || 0)}
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        {c.status}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleViewCustomer(c.id)}
                        className="p-1.5 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="View Guest Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomerDetails && (
        <Modal
          isOpen={!!selectedCustomerDetails}
          onClose={() => setSelectedCustomerDetails(null)}
          title={`Customer Profile — ${selectedCustomerDetails.user.firstName} ${selectedCustomerDetails.user.lastName}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs text-stone-700">
            {/* Overview */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200/80">
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Total Spent</span>
                <span className="font-serif font-bold text-stone-900 text-lg">
                  {formatCurrency(selectedCustomerDetails.metrics.totalSpend)}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Food Orders</span>
                <span className="font-serif font-bold text-stone-900 text-lg">
                  {selectedCustomerDetails.metrics.totalOrders}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-bold">Table Reservations</span>
                <span className="font-serif font-bold text-stone-900 text-lg">
                  {selectedCustomerDetails.metrics.totalBookings}
                </span>
              </div>
            </div>

            {/* Recent Orders */}
            <div className="space-y-2">
              <span className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                Recent Food Orders
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedCustomerDetails.orders.length === 0 ? (
                  <p className="text-stone-400 italic">No food orders placed yet.</p>
                ) : (
                  selectedCustomerDetails.orders.map((o) => (
                    <div key={o.id} className="flex justify-between items-center p-2.5 bg-white border border-stone-200 rounded-xl">
                      <div>
                        <span className="font-mono font-bold text-stone-900 mr-2">{o.orderNumber}</span>
                        <span className="text-[11px] text-stone-500">({o.orderType}) • {formatDate(o.createdAt)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-stone-900 mr-2">{formatCurrency(o.total)}</span>
                        <span className="text-[10px] uppercase font-bold text-amber-800">{o.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="space-y-2">
              <span className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                Table Reservations
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedCustomerDetails.bookings.length === 0 ? (
                  <p className="text-stone-400 italic">No table bookings yet.</p>
                ) : (
                  selectedCustomerDetails.bookings.map((b) => (
                    <div key={b.id} className="flex justify-between items-center p-2.5 bg-white border border-stone-200 rounded-xl">
                      <div>
                        <span className="font-mono font-bold text-amber-900 mr-2">{b.bookingReference}</span>
                        <span className="text-[11px] text-stone-500">{formatDate(b.bookingDate)} at {b.startTime} ({b.guestCount} Guests)</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {b.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
