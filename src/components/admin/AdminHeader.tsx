/**
 * Admin Top Header with Live Notifications, Demo Switcher, & Quick Controls
 * Exclusively tailored for the Staff Admin Workflow
 */
import React, { useState } from 'react';
import {
  Bell,
  RotateCcw,
  CheckCircle2,
  Calendar,
  ShoppingBag,
  AlertTriangle,
  Menu,
  Shield,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminNotification } from '../../types/index.ts';
import { formatDate, formatTime } from '../../utils/formatters.ts';

interface AdminHeaderProps {
  notifications: AdminNotification[];
  unreadCount: number;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onSelectNotification: (notif: AdminNotification) => void;
  onToggleMobileSidebar: () => void;
  refreshing?: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  notifications,
  unreadCount,
  onRefresh,
  onMarkAllRead,
  onSelectNotification,
  onToggleMobileSidebar,
  refreshing = false
}) => {
  const { user, logout } = useAuth();
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);

  return (
    <header className="bg-white border-b border-stone-200/80 px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
          aria-label="Toggle admin sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-800 text-amber-200 flex items-center justify-center font-serif font-bold text-sm shadow-xs hidden sm:flex">
            ABC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-base sm:text-lg text-stone-900 leading-tight">
                ABC Hotel Operations Suite
              </h1>
              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider hidden md:inline-block ${
                user?.role === 'MANAGER'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {user?.role === 'MANAGER' ? 'Manager' : 'Staff'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block">
              {user?.role === 'MANAGER' 
                ? 'Centralized analytics, catalog command & configuration center' 
                : 'Centralized restaurant floor, kitchen dispatch & catalog command center'}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Quick Controls, Refresh, Notifications, Staff Account */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh live data"
        >
          <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-700' : ''}`} />
          <span className="hidden lg:inline">Refresh</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifDropdownOpen(!notifDropdownOpen);
              setStaffDropdownOpen(false);
            }}
            className="p-2 text-stone-700 hover:text-amber-900 hover:bg-amber-50 rounded-xl relative transition-all cursor-pointer"
            aria-label="Staff Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 py-3 z-50 animate-in fade-in zoom-in-95">
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
            className="flex items-center gap-2 p-1.5 pl-2.5 rounded-full bg-stone-100 hover:bg-purple-100/60 border border-stone-200 transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-stone-800 max-w-[90px] truncate hidden sm:inline-block">
              {user?.firstName || 'Admin'}
            </span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-800 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {user?.firstName?.[0] || 'A'}
            </div>
          </button>

          {staffDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-stone-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2.5 border-b border-stone-100">
                <p className="text-[10px] uppercase font-bold text-purple-700 tracking-wider">
                  Hotel Staff Account
                </p>
                <p className="text-xs font-bold text-stone-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-stone-400 font-mono truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  setStaffDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-bold cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out Admin</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
