/**
 * Kitchen Department Standalone Portal Page
 * Full-screen Light-Themed Kitchen Display System for Kitchen Staff & Executive Chefs
 */
import React, { useEffect, useState } from 'react';
import { ChefHat, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { KitchenKdsView } from '../components/kitchen/KitchenKdsView.tsx';

const KitchenClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-sm font-semibold text-champagne tabular-nums">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
};

export const KitchenPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { user, logout, isAdmin, isManager } = useAuth();

  return (
    <div className="min-h-screen bg-[#f4efe7] text-stone-900 flex flex-col justify-between">
      {/* Top Kitchen Header - high contrast for the pass */}
      <header className="bg-ink text-ivory border-b border-gold/20 px-4 sm:px-8 py-3 flex items-center justify-between gap-3 sticky top-0 z-40 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative w-10 h-10 shrink-0 flex items-center justify-center border border-gold/60 text-champagne">
            <span className="absolute inset-[3px] border border-gold/25" />
            <span className="font-display text-[13px] font-semibold tracking-[0.06em]">ABC</span>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-display font-semibold text-ivory text-lg sm:text-xl tracking-[0.12em] truncate hidden sm:inline">
                ABC HOTEL & SUITES
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-wine text-champagne text-[9.5px] font-bold uppercase tracking-[0.18em] shrink-0">
                Kitchen Dept
              </span>
            </div>
            <p className="text-[11px] text-ivory/50 font-medium hidden sm:block">
              Commercial Culinary Operations & Live Ticket Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <KitchenClock />
          </div>

          {(isAdmin || isManager) && (
            <button
              onClick={() => navigate('admin')}
              className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/10 text-ivory border border-white/15 font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs">
            <ChefHat className="w-4 h-4 text-gold" />
            <span className="text-ivory font-semibold">
              {user?.firstName || 'Chef'} {user?.lastName || 'Station'}
            </span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('staff-login');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border border-rose-400/30 text-xs font-bold transition-all cursor-pointer"
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
      <footer className="bg-ink text-ivory/45 border-t border-white/[0.06] px-6 py-3 text-center text-[11px] font-medium tracking-wide">
        ABC Hotel & Culinary Division • Connected to Central Food & Beverage Real-time Network
      </footer>
    </div>
  );
};
