/**
 * Clean & Modern Table Configuration & QR Code Management Module
 */
import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  MapPin,
  QrCode,
  Download,
  Printer,
  Search,
  Eye,
  SquareDashedBottom,
  Sparkles
} from 'lucide-react';
import { DiningTable, TableLocation, TableStatus } from '../../types/index.ts';
import { Modal } from '../common/Footer.tsx';
import { useToast } from '../../context/ToastContext.tsx';

interface AdminTablesViewProps {
  tables: DiningTable[];
  onCreateTable: (data: any) => Promise<void>;
  onUpdateTable: (id: string, data: any) => Promise<void>;
  onDeleteTable: (id: string) => Promise<void>;
}

export const AdminTablesView: React.FC<AdminTablesViewProps> = ({
  tables,
  onCreateTable,
  onUpdateTable,
  onDeleteTable
}) => {
  const { success, error } = useToast();

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState<number>(4);
  const [location, setLocation] = useState<TableLocation>('Center Terrace');
  const [status, setStatus] = useState<TableStatus>('AVAILABLE');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiningTable | null>(null);

  // QR Code Modal
  const [qrModalTable, setQrModalTable] = useState<DiningTable | null>(null);

  // Metrics
  const totalTables = tables.length;
  const availableTables = tables.filter((t) => t.status === 'AVAILABLE').length;
  const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED').length;
  const reservedTables = tables.filter((t) => t.status === 'RESERVED').length;
  const inactiveTables = tables.filter(
    (t) => t.status === 'MAINTENANCE' || t.status === 'UNAVAILABLE' || (t as any).isActive === false
  ).length;

  const openCreateModal = () => {
    setEditingTable(null);
    setTableNumber(`Table ${String(tables.length + 1).padStart(2, '0')}`);
    setCapacity(4);
    setLocation('Center Terrace');
    setStatus('AVAILABLE');
    setModalOpen(true);
  };

  const openEditModal = (tbl: DiningTable) => {
    setEditingTable(tbl);
    setTableNumber(tbl.tableNumber);
    setCapacity(tbl.capacity);
    setLocation(tbl.location);
    setStatus(tbl.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        tableNumber: tableNumber.trim(),
        capacity: Number(capacity),
        location,
        status,
        isActive: status !== 'MAINTENANCE' && status !== 'UNAVAILABLE'
      };

      if (editingTable) {
        await onUpdateTable(editingTable.id, payload);
        success(`✓ ${tableNumber} updated.`);
      } else {
        await onCreateTable(payload);
        success(`✓ New table ${tableNumber} created.`);
      }
      setModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Failed to save table.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await onDeleteTable(deleteTarget.id);
      success(`✓ ${deleteTarget.tableNumber} deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      error(err.message || 'Failed to delete table.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate QR Code Target URL
  const getTableQrUrl = (tbl: DiningTable) => {
    const origin = window.location.origin;
    return `${origin}/menu?tableId=${encodeURIComponent(tbl.id)}&tableNumber=${encodeURIComponent(tbl.tableNumber)}`;
  };

  const getQrImageUrl = (tbl: DiningTable) => {
    const targetUrl = getTableQrUrl(tbl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}&color=451a03&bgcolor=ffffff`;
  };

  // Download QR Code PNG
  const handleDownloadQr = (tbl: DiningTable) => {
    const qrUrl = getQrImageUrl(tbl);
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${tbl.tableNumber.replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success(`Downloading QR Code for ${tbl.tableNumber}...`);
  };

  // Print Table Stand QR Card
  const handlePrintQr = (tbl: DiningTable) => {
    const qrUrl = getQrImageUrl(tbl);
    const printWindow = window.open('', '_blank', 'width=700,height=800');
    if (!printWindow) {
      error('Please allow popups to print table QR stands.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Table Stand — ${tbl.tableNumber}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 40px 20px;
              background-color: #fafaf9;
              color: #1c1917;
            }
            .card {
              max-width: 400px;
              margin: 0 auto;
              background: #ffffff;
              padding: 36px 28px;
              border-radius: 20px;
              border: 2px solid #78350f;
              box-shadow: 0 8px 24px rgba(0,0,0,0.06);
            }
            .header-badge {
              display: inline-block;
              background: #fef3c7;
              color: #78350f;
              padding: 4px 14px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1.5px;
            }
            h1 {
              font-size: 28px;
              margin: 12px 0 4px 0;
              color: #451a03;
            }
            .subtitle {
              font-size: 13px;
              color: #78716c;
              margin-bottom: 20px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              border-radius: 12px;
              border: 1px solid #e7e5e4;
              padding: 10px;
              background: #ffffff;
            }
            .instructions {
              margin-top: 20px;
              font-size: 13px;
              font-weight: bold;
              color: #292524;
            }
            .footer-note {
              font-size: 10px;
              color: #a8a29e;
              margin-top: 16px;
            }
            @media print {
              body { background: white; padding: 0; }
              .card { border: 2px solid #78350f; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-badge">ABC HOTEL & RESTAURANT</div>
            <h1>${tbl.tableNumber}</h1>
            <div class="subtitle">${tbl.location} • Capacity: ${tbl.capacity} Guests</div>
            <img src="${qrUrl}" alt="${tbl.tableNumber} QR Code" class="qr-img" />
            <div class="instructions">📱 Scan to View Menu & Order Directly</div>
            <div class="footer-note">Table Ref: ${tbl.id}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Filtered Tables
  const filteredTables = tables.filter((tbl) => {
    const matchesQuery =
      !searchQuery ||
      tbl.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tbl.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tbl.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'INACTIVE'
        ? tbl.status === 'MAINTENANCE' || tbl.status === 'UNAVAILABLE'
        : tbl.status === statusFilter);

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Top Header & New Table Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-3">
        <div>
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            Table Configuration
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage dining tables, seating capacities, and QR ordering codes.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Configure New Table</span>
        </button>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total Tables</span>
          <p className="font-serif font-bold text-xl text-stone-900">{totalTables}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Available</span>
          <p className="font-serif font-bold text-xl text-emerald-950">{availableTables}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Occupied</span>
          <p className="font-serif font-bold text-xl text-amber-950">{occupiedTables}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 shadow-2xs space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">Reserved</span>
          <p className="font-serif font-bold text-xl text-indigo-950">{reservedTables}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200/80 shadow-2xs space-y-0.5 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Inactive</span>
          <p className="font-serif font-bold text-xl text-stone-700">{inactiveTables}</p>
        </div>
      </div>

      {/* Search Bar & Status Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div className="flex-1 relative flex items-center bg-stone-50 rounded-xl border border-stone-200 px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by table, location, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-hidden text-stone-900 ml-2"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-stone-400 hover:text-stone-600 text-xs font-bold cursor-pointer">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'INACTIVE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-amber-800 text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tables Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {filteredTables.map((tbl) => {
          const isInactive = tbl.status === 'MAINTENANCE' || tbl.status === 'UNAVAILABLE' || (tbl as any).isActive === false;
          return (
            <div
              key={tbl.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:shadow-md transition-all ${
                isInactive ? 'border-stone-300 opacity-75 bg-stone-50/50' : 'border-stone-200/90'
              }`}
            >
              <div className="space-y-2">
                {/* Row 1: Table Number & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-serif font-bold text-lg text-stone-900 leading-none truncate">
                    {tbl.tableNumber}
                  </h3>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider shrink-0 ${
                      tbl.status === 'AVAILABLE'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : tbl.status === 'OCCUPIED'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : tbl.status === 'RESERVED'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    {tbl.status}
                  </span>
                </div>

                {/* Row 2: Location & Capacity Badge */}
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500 pt-0.5">
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="truncate">{tbl.location}</span>
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold text-[11px] flex items-center gap-1 shrink-0">
                    <Users className="w-3 h-3 text-stone-500" />
                    {tbl.capacity} Seats
                  </span>
                </div>

                {/* Clean QR Thumbnail & View Button */}
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getQrImageUrl(tbl)}
                      alt={`QR for ${tbl.tableNumber}`}
                      className="w-11 h-11 rounded-lg border border-stone-200 bg-white p-0.5 shadow-2xs shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                        Table Reference
                      </span>
                      <p className="text-[11px] text-stone-700 font-mono font-medium truncate">
                        {tbl.id}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setQrModalTable(tbl)}
                    className="px-2.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                    title="View QR Code"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>QR</span>
                  </button>
                </div>
              </div>

              {/* Clean Footer Actions */}
              <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadQr(tbl)}
                    className="p-1.5 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Download PNG"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handlePrintQr(tbl)}
                    className="p-1.5 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Print Table Stand"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(tbl)}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setDeleteTarget(tbl)}
                    className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="Delete Table"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-stone-300">
          <SquareDashedBottom className="w-8 h-8 mx-auto text-stone-400 mb-2" />
          <h3 className="font-serif font-bold text-base text-stone-800">No Dining Tables Found</h3>
          <p className="text-xs text-stone-500 mt-0.5 max-w-xs mx-auto">
            Adjust your search or filter, or configure a new table.
          </p>
        </div>
      )}

      {/* CREATE / EDIT TABLE MODAL */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingTable ? `Edit ${editingTable.tableNumber}` : 'Configure New Table'}
        >
          <form onSubmit={handleSave} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Table Number / Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Table 05 or Terrace VIP"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-700 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Seating Capacity *</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-700 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Section / Location *</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as TableLocation)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-700 focus:outline-hidden"
                >
                  <option value="Center Terrace">Center Terrace</option>
                  <option value="Window View">Window View</option>
                  <option value="Private Booth">Private Booth</option>
                  <option value="Garden Side">Garden Side</option>
                  <option value="VIP Section">VIP Section</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Table Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TableStatus)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-700 focus:outline-hidden"
              >
                <option value="AVAILABLE">AVAILABLE (Accepts Orders)</option>
                <option value="OCCUPIED">OCCUPIED (Dining in progress)</option>
                <option value="RESERVED">RESERVED (Has reservation)</option>
                <option value="MAINTENANCE">MAINTENANCE / INACTIVE (Block QR orders)</option>
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingTable ? 'Update Table' : 'Create Table'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* QR CODE DISPLAY MODAL */}
      {qrModalTable && (
        <Modal
          isOpen={Boolean(qrModalTable)}
          onClose={() => setQrModalTable(null)}
          title={`Table QR Code — ${qrModalTable.tableNumber}`}
        >
          <div className="space-y-4 text-center pt-1">
            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 max-w-xs mx-auto">
              <div>
                <h3 className="font-bold text-xl text-stone-900">
                  {qrModalTable.tableNumber}
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  {qrModalTable.location} • {qrModalTable.capacity} Seats
                </p>
              </div>

              {/* QR Image */}
              <div className="p-3 bg-white rounded-xl border border-stone-300 shadow-xs inline-block">
                <img
                  src={getQrImageUrl(qrModalTable)}
                  alt={`QR for ${qrModalTable.tableNumber}`}
                  className="w-48 h-48 mx-auto rounded-md"
                />
              </div>

              <p className="text-xs text-stone-600 font-medium">
                📱 Scan to view menu & place order directly from table
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadQr(qrModalTable)}
                className="py-2 px-3.5 rounded-xl bg-stone-900 hover:bg-stone-950 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintQr(qrModalTable)}
                className="py-2 px-3.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Stand</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title={`Delete ${deleteTarget.tableNumber}?`}
        >
          <div className="space-y-3 pt-1">
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to delete <strong>{deleteTarget.tableNumber}</strong>?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
