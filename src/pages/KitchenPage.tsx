/**
 * Kitchen Department Standalone Portal Page
 * Full-screen Light-Themed Kitchen Display System for Kitchen Staff & Executive Chefs
 */
import React from 'react';
import { ChefHat, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { KitchenKdsView } from '../components/kitchen/KitchenKdsView.tsx';

export const KitchenPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { user, logout, isAdmin, isManager } = useAuth();

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col justify-between selection:bg-amber-800 selection:text-white">
      {/* Top Kitchen Header - Clean Luxury Light Theme */}
      <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/90 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 flex items-center justify-center text-amber-100 font-serif font-bold text-lg shadow-sm">
            ABC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-stone-900 text-base sm:text-lg tracking-tight">
                ABC HOTEL & SUITES
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
                Kitchen Dept
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              Commercial Culinary Operations & Live Ticket Dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(isAdmin || isManager) && (
            <button
              onClick={() => navigate('admin')}
              className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100/80 border border-stone-200 text-xs">
            <ChefHat className="w-4 h-4 text-amber-800" />
            <span className="text-stone-800 font-semibold">
              {user?.firstName || 'Chef'} {user?.lastName || 'Station'}
            </span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('staff-login');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
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
      <footer className="bg-white border-t border-stone-200/80 px-6 py-3.5 text-center text-xs text-stone-500 font-medium shadow-2xs">
        ABC Hotel & Culinary Division • Connected to Central Food & Beverage Real-time Network
      </footer>
    </div>
  );
};

