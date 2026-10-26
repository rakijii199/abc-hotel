/**
 * Kitchen Department Standalone Portal Page
 * Full-screen Light-Themed Kitchen Display System for Kitchen Staff & Executive Chefs
 */
import React, { useEffect, useState } from 'react';
import { ChefHat, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { KitchenKdsView } from '../components/kitchen/KitchenKdsView.tsx';
import { BrandIcon, BrandName } from '../components/common/BrandMark.tsx';

const KitchenClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-sm font-semibold text-stone-800 tabular-nums">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
};

export const KitchenPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { user, logout, isAdmin, isManager } = useAuth();

  return (
    <div className="min-h-screen ambient text-stone-900 flex flex-col justify-between">
      {/* Top Kitchen Header - high contrast for the pass */}
      <header className="bg-white border-b border-[var(--border-subtle)] shadow-[var(--shadow-xs)] text-stone-900 px-4 sm:px-8 h-16 flex items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <BrandIcon size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <BrandName size="md" className="hidden sm:inline" />
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand-border)] text-[9.5px] font-bold uppercase tracking-[0.18em] shrink-0">
                Kitchen Dept
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium hidden sm:block">
              Commercial Culinary Operations & Live Ticket Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <KitchenClock />
          </div>

          {(isAdmin || isManager) && (
            <button
              onClick={() => navigate('admin')}
              className="btn btn-secondary !min-h-9 !px-3.5 !text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[var(--border-subtle)] text-xs">
            <ChefHat className="w-4 h-4 text-amber-700" />
            <span className="text-stone-800 font-semibold">
              {user?.firstName || 'Chef'} {user?.lastName || 'Station'}
            </span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('staff-login');
            }}
            className="flex items-center gap-1.5 px-3.5 min-h-9 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main KDS Board */}
      <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
        <KitchenKdsView />
      </main>

      {/* Footer Status */}
      <footer className="bg-[var(--surface)] text-stone-500 border-t border-[var(--border-subtle)] px-6 py-3 text-center text-[11px] font-medium tracking-wide">
        ABC Hotel & Culinary Division • Connected to Central Food & Beverage Real-time Network
      </footer>
    </div>
  );
};
