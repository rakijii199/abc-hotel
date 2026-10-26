/**
 * Staff top navigation bar: brand, role-filtered navigation (flat links or
 * grouped dropdowns), refresh, live notifications and the account menu.
 * On screens below `lg` the navigation moves into the existing drawer
 * (opened with the menu button), which uses the same role-filtered items.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  RotateCcw,
  Calendar,
  ShoppingBag,
  AlertTriangle,
  Menu,
  LogOut,
  ChevronDown,
  Shield,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminNotification } from '../../types/index.ts';
import { formatDate, formatTime } from '../../utils/formatters.ts';
import { AdminTab, NavItem, getAdminNavSections } from './AdminSidebar.tsx';
import { roleDisplayName } from '../../../shared/accessControl.ts';
import { BrandIcon, BrandName } from '../common/BrandMark.tsx';

interface AdminHeaderProps {
  notifications: AdminNotification[];
  unreadCount: number;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onSelectNotification: (notif: AdminNotification) => void;
  onToggleMobileSidebar: () => void;
  refreshing?: boolean;
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  pendingOrdersCount?: number;
  pendingBookingsCount?: number;
}

/** Roles with this many pages or fewer get a flat row of links instead of grouped dropdowns. */
const FLAT_NAV_LIMIT = 7;

const NavBadge: React.FC<{ value?: number }> = ({ value }) =>
  value === undefined ? null : (
    <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--brand)] text-white text-[10px] font-bold flex items-center justify-center">
      {value}
    </span>
  );

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  notifications,
  unreadCount,
  onRefresh,
  onMarkAllRead,
  onSelectNotification,
  onToggleMobileSidebar,
  refreshing = false,
  activeTab,
  onSelectTab,
  pendingOrdersCount = 0,
  pendingBookingsCount = 0
}) => {
  const { user, logout } = useAuth();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const sections = getAdminNavSections(user?.access, { pendingOrdersCount, pendingBookingsCount });
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0);
  const flat = totalItems <= FLAT_NAV_LIMIT;

  // Close an open nav dropdown on outside click or Escape.
  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  const go = (tab: AdminTab) => {
    setOpenGroup(null);
    onSelectTab(tab);
  };

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => go(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className="nav-item"
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
        <span>{item.label}</span>
        <NavBadge value={item.badge} />
      </button>
    );
  };

  return (
    <header className="relative z-40 shrink-0 px-3 sm:px-6 pt-3 pb-1">
      <div className="topbar-float mx-auto max-w-[1440px] h-16 px-3 sm:px-4 flex items-center gap-3 lg:gap-5">
        {/* Mobile / tablet: navigation lives in the drawer */}
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)] rounded-xl cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandIcon size="sm" />
          <BrandName size="sm" className="hidden sm:block" />
        </div>

        {/* Desktop navigation */}
        <nav ref={navRef} className="hidden lg:flex items-center gap-1 flex-1 min-w-0" aria-label="Operations">
          {flat
            ? sections.flatMap((s) => s.items).map(renderLink)
            : sections.map((section) => {
                if (section.items.length === 1) return renderLink(section.items[0]);
                const containsActive = section.items.some((i) => i.id === activeTab);
                const isOpen = openGroup === section.title;
                const groupBadge = section.items.reduce((n, i) => n + (i.badge || 0), 0);
                return (
                  <div key={section.title} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenGroup(isOpen ? null : section.title)}
                      aria-haspopup="menu"
                      aria-expanded={isOpen}
                      data-active={containsActive ? 'true' : undefined}
                      className="nav-item"
                    >
                      <span>{section.title}</span>
                      {groupBadge > 0 && <NavBadge value={groupBadge} />}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div role="menu" aria-label={section.title} className="bg-white border border-[var(--border-subtle)] shadow-[var(--shadow-float)] absolute left-0 top-full mt-2 min-w-[220px] rounded-xl p-1.5 z-50 animate-in fade-in zoom-in-95 origin-top-left">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="menuitem"
                              onClick={() => go(item.id)}
                              aria-current={isActive ? 'page' : undefined}
                              className={`w-full flex items-center justify-between gap-3 px-3 min-h-10 rounded-lg text-[13px] text-left cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-[var(--brand-soft-hover)] text-[var(--brand-text)] font-semibold'
                                  : 'text-stone-700 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-text)]'
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--brand)]' : 'text-stone-400'}`} strokeWidth={1.75} />
                                {item.label}
                              </span>
                              <NavBadge value={item.badge} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* Right: role, refresh, notifications, account */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn btn-ghost !min-h-10 !px-2.5"
            title="Refresh live data"
            aria-label="Refresh live data"
          >
            <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[var(--brand)]' : ''}`} />
          </button>
        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifDropdownOpen(!notifDropdownOpen);
              setStaffDropdownOpen(false);
            }}
            className="w-10 h-10 flex items-center justify-center text-stone-700 hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] rounded-xl relative transition-all cursor-pointer"
            aria-label="Staff Notifications"
            aria-expanded={notifDropdownOpen}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[var(--border-subtle)] shadow-[var(--shadow-float)] rounded-2xl py-3 z-50 animate-in fade-in zoom-in-95 origin-top-right">
              <div className="px-4 pb-2 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <span className="font-serif font-bold text-sm text-stone-900">Notifications</span>
                  <span className="text-[11px] text-stone-400 block font-normal">
                    {unreadCount} unread updates
                  </span>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      onMarkAllRead();
                      setNotifDropdownOpen(false);
                    }}
                    className="text-[11px] font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-stone-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => {
                    const isOrder = n.type.includes('ORDER');
                    const isBooking = n.type.includes('BOOKING');
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          onSelectNotification(n);
                          setNotifDropdownOpen(false);
                        }}
                        className={`p-3.5 hover:bg-stone-50 cursor-pointer flex items-start gap-3 transition-colors ${
                          !n.read ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isOrder
                              ? 'bg-indigo-100 text-indigo-700'
                              : isBooking
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isOrder ? (
                            <ShoppingBag className="w-4 h-4" />
                          ) : isBooking ? (
                            <Calendar className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-stone-900 truncate">{n.title}</p>
                          <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-stone-400 font-mono block">
                            {formatDate(n.createdAt)} • {formatTime(n.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Staff User Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setStaffDropdownOpen(!staffDropdownOpen);
              setNotifDropdownOpen(false);
            }}
            className="flex items-center gap-2 p-1 sm:pl-3 rounded-full bg-white hover:border-[var(--brand-border)] hover:bg-[var(--brand-soft)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
            aria-label="Account menu"
            aria-expanded={staffDropdownOpen}
          >
            <span className="text-xs font-bold text-stone-800 max-w-[90px] truncate hidden sm:inline-block">
              {user?.firstName || 'Admin'}
            </span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--brand-hover)] text-white flex items-center justify-center text-xs font-bold">
              {user?.firstName?.[0] || 'A'}
            </div>
          </button>

          {staffDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-float)] p-1.5 z-50 animate-in fade-in zoom-in-95 origin-top-right" role="menu">
              <div className="flex items-center gap-3 px-2.5 py-2.5">
                <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--brand-soft-hover)] text-[var(--brand-text)] flex items-center justify-center text-sm font-bold">
                  {user?.firstName?.[0] || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-stone-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] text-[var(--brand)] truncate">{user?.email}</p>
                </div>
              </div>

              <div className="mx-1 border-t border-[var(--border-subtle)]" />
              <dl className="px-2.5 py-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-stone-500">
                    <Shield className="w-3.5 h-3.5" /> Role
                  </dt>
                  <dd className="font-semibold text-stone-900 truncate">{roleDisplayName(user?.role)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-stone-500">
                    <KeyRound className="w-3.5 h-3.5" /> Privilege
                  </dt>
                  <dd className="font-semibold text-stone-900 truncate">
                    {user?.effectivePrivilege === 'SUPER_ADMIN' ? 'Super Admin' : 'User'}
                  </dd>
                </div>
              </dl>
              <div className="mx-1 border-t border-[var(--border-subtle)]" />

              <button
                role="menuitem"
                onClick={() => {
                  setStaffDropdownOpen(false);
                  logout();
                }}
                className="mt-1 w-full text-left px-2.5 h-9 rounded-lg text-xs text-stone-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 font-medium cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
};
