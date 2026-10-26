/**
 * Compact data table card used by User Management (Users, Roles, Privileges):
 * title + icon toolbar (search, filter, export, refresh, primary action),
 * selectable rows, sortable columns and a brand-tinted header.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Filter, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  title: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Text a row is matched against; enables the search toggle. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Filter controls shown in the filter popover. */
  filters?: React.ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** CSV export of the selected rows (or all visible rows when none are selected). */
  exportName?: string;
  exportRow?: (row: T) => Record<string, string>;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean; title?: string };
  selectable?: boolean;
  loading?: boolean;
  emptyText?: string;
  rowActions?: (row: T) => React.ReactNode;
  rowClassName?: (row: T) => string;
  minWidth?: number;
}

const iconBtn =
  'w-8 h-8 inline-flex items-center justify-center rounded-lg text-stone-600 hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export function Chip({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'muted' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${
        tone === 'brand'
          ? 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]'
          : 'bg-white text-stone-600 border-stone-200'
      }`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ active, onClick, disabled, title }: { active: boolean; onClick?: () => void; disabled?: boolean; title?: string }) {
  const cls = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
    active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'
  }`;
  const body = (
    <>
      {active ? <span aria-hidden>✓</span> : <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />}
      {active ? 'Active' : 'Inactive'}
    </>
  );
  if (!onClick) return <span className={cls}>{body}</span>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${cls} cursor-pointer hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60`}>
      {body}
    </button>
  );
}

function downloadCsv(name: string, records: Record<string, string>[]) {
  if (records.length === 0) return;
  const headers = Object.keys(records[0]);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers.join(','), ...records.map((r) => headers.map((h) => esc(r[h] ?? '')).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  title,
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = 'Search…',
  filters,
  activeFilterCount = 0,
  onClearFilters,
  onRefresh,
  refreshing,
  exportName,
  exportRow,
  primaryAction,
  selectable = true,
  loading,
  emptyText = 'No records found.',
  rowActions,
  rowClassName,
  minWidth = 720
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(q)) : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const dir = sort!.dir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = col.sortValue!(a);
        const vb = col.sortValue!(b);
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
      });
    }
    return list;
  }, [rows, query, searchText, sort, columns]);

  // Drop selections that are no longer visible.
  useEffect(() => {
    setSelected((prev) => {
      const keys = new Set(visible.map(rowKey));
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible, rowKey]);

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(rowKey(r)));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map(rowKey)));
  const toggleOne = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  const exportRows = () => {
    if (!exportRow || !exportName) return;
    const source = selected.size > 0 ? visible.filter((r) => selected.has(rowKey(r))) : visible;
    downloadCsv(exportName, source.map(exportRow));
  };

  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <section className="bg-white rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <header className="min-h-14 px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-stone-900">{title}</h3>
          <span className="text-xs text-stone-400">{visible.length}</span>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 text-[11px] text-[var(--brand-text)] bg-[var(--brand-soft)] rounded-full px-2 py-0.5 cursor-pointer">
              {selected.size} selected <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {searchText && (searchOpen ? (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuery('');
                    setSearchOpen(false);
                  }
                }}
                onBlur={() => !query && setSearchOpen(false)}
                placeholder={searchPlaceholder}
                aria-label={`Search ${title.toLowerCase()}`}
                className="w-48 sm:w-60 h-8 pl-8 pr-7 rounded-lg border border-stone-200 bg-white text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden focus:border-[var(--brand)]"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button type="button" className={iconBtn} onClick={() => setSearchOpen(true)} title="Search" aria-label="Search">
              <Search className="w-4 h-4" />
            </button>
          ))}

          {filters && (
            <div className="relative" ref={filterRef}>
              <button type="button" className={`${iconBtn} relative`} onClick={() => setFilterOpen((o) => !o)} title="Filter" aria-label="Filter" aria-expanded={filterOpen}>
                <Filter className="w-4 h-4" />
                {activeFilterCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--brand)]" />}
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-[var(--border-subtle)] shadow-[0_24px_48px_-24px_rgba(26,23,21,0.45)] p-3 space-y-3 z-30">
                  {filters}
                  {onClearFilters && activeFilterCount > 0 && (
                    <button type="button" onClick={onClearFilters} className="text-[11px] font-semibold text-[var(--brand-text)] hover:underline cursor-pointer">
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {(exportRow || onRefresh) && <span className="w-px h-5 bg-stone-200 mx-1" aria-hidden />}

          {exportRow && (
            <button type="button" className={iconBtn} onClick={exportRows} disabled={visible.length === 0} title={selected.size ? 'Export selected (CSV)' : 'Export (CSV)'} aria-label="Export CSV">
              <Download className="w-4 h-4" />
            </button>
          )}
          {onRefresh && (
            <button type="button" className={iconBtn} onClick={onRefresh} disabled={refreshing} title="Refresh" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              title={primaryAction.title}
              className="ml-1 inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full border border-[var(--brand)] text-[var(--brand-text)] text-xs font-semibold hover:bg-[var(--brand-soft)] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-white inline-flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
              {primaryAction.label}
            </button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]" style={{ minWidth }}>
          <thead className="bg-[var(--brand-soft)] text-[12.5px] font-semibold text-stone-800">
            <tr>
              {selectable && (
                <th className="w-10 pl-4 py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="w-3.5 h-3.5 align-middle cursor-pointer" style={{ accentColor: 'var(--brand)' }} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.className || ''}`} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--brand-text)]">
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {rowActions && <th className="px-4 py-2.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--brand)]" />
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-xs text-stone-500">
                  {emptyText}
                  {(query || activeFilterCount > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        onClearFilters?.();
                      }}
                      className="ml-2 font-semibold text-[var(--brand-text)] hover:underline cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const key = rowKey(row);
                const isSel = selected.has(key);
                return (
                  <tr key={key} className={`group transition-colors ${isSel ? 'bg-[var(--brand-soft)]/60' : 'hover:bg-stone-50/80'} ${rowClassName?.(row) || ''}`}>
                    {selectable && (
                      <td className="pl-4 py-2.5">
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(key)} aria-label="Select row" className="w-3.5 h-3.5 align-middle cursor-pointer" style={{ accentColor: 'var(--brand)' }} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 text-stone-700 ${c.className || ''}`}>
                        {c.render(row)}
                      </td>
                    ))}
                    {rowActions && <td className="px-4 py-1.5 text-right whitespace-nowrap">{rowActions(row)}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export const rowIconBtn =
  'w-7 h-7 inline-flex items-center justify-center rounded-lg text-stone-500 hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer';
