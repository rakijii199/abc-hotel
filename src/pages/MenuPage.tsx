/**
 * Restaurant Gourmet Menu Page with Filters, Search, and Cart Interactions
 * Fully responsive on mobile, tablet, and desktop
 */
import React, { useEffect, useState } from 'react';
import {
  Search,
  Leaf,
  Flame,
  X,
  UtensilsCrossed,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  QrCode,
  AlertCircle
} from 'lucide-react';
import { MenuCategory, MenuItem, DiningTable } from '../types/index.ts';
import { MenuApi } from '../api/index.ts';
import { MenuItemCard } from '../components/menu/MenuItemCard.tsx';
import { Spinner, EmptyState } from '../components/common/Footer.tsx';
import { useCart } from '../context/CartContext.tsx';
import { formatCurrency } from '../utils/formatters.ts';

export const MenuPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { itemCount, total } = useCart();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vegOnly, setVegOnly] = useState<boolean>(false);
  const [spicyOnly, setSpicyOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('popular');

  // QR Session State
  const [qrTableInfo, setQrTableInfo] = useState<{ id: string; number: string; location?: string } | null>(null);
  const [qrTableInactive, setQrTableInactive] = useState<boolean>(false);

  // Validate QR Code Table parameters if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramTableId = params.get('tableId');
    const paramTableNumber = params.get('tableNumber');

    if (paramTableId || paramTableNumber) {
      async function validateQrTable() {
        try {
          const res = await fetch('/api/tables');
          if (res.ok) {
            const json = await res.json();
            const tableList: DiningTable[] = json.data?.tables || json.data || [];
            const matched = tableList.find(
              (t) =>
                (paramTableId && t.id === paramTableId) ||
                (paramTableNumber && t.tableNumber.toLowerCase() === paramTableNumber.toLowerCase())
            );

            if (matched) {
              if (matched.status === 'MAINTENANCE' || matched.status === 'UNAVAILABLE' || (matched as any).isActive === false) {
                setQrTableInactive(true);
                setQrTableInfo({ id: matched.id, number: matched.tableNumber });
              } else {
                setQrTableInactive(false);
                setQrTableInfo({ id: matched.id, number: matched.tableNumber, location: matched.location });
                const sessionObj = {
                  tableId: matched.id,
                  tableNumber: matched.tableNumber,
                  location: matched.location,
                  orderType: 'Dine-in',
                  isQrSession: true
                };
                sessionStorage.setItem('abc_qr_table_session', JSON.stringify(sessionObj));
                localStorage.setItem('abc_selected_table_number', matched.tableNumber);
              }
            } else {
              const fallbackNumber = paramTableNumber || paramTableId || 'Table QR';
              setQrTableInfo({ id: paramTableId || 'tbl-qr', number: fallbackNumber });
              sessionStorage.setItem(
                'abc_qr_table_session',
                JSON.stringify({
                  tableId: paramTableId || 'tbl-qr',
                  tableNumber: fallbackNumber,
                  orderType: 'Dine-in',
                  isQrSession: true
                })
              );
            }
          }
        } catch (e) {
          console.warn('QR table validation error:', e);
        }
      }
      validateQrTable();
    } else {
      const existing = sessionStorage.getItem('abc_qr_table_session');
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          setQrTableInfo({ id: parsed.tableId, number: parsed.tableNumber, location: parsed.location });
        } catch {}
      }
    }
  }, []);

  // Load Categories on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await MenuApi.getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    loadCategories();
  }, []);

  // Fetch Items on filter change
  useEffect(() => {
    async function loadItems() {
      setLoading(true);
      try {
        const data = await MenuApi.getItems({
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          search: searchQuery.trim() ? searchQuery.trim() : undefined,
          vegetarian: vegOnly ? true : undefined,
          spicy: spicyOnly ? true : undefined,
          sortBy
        });
        setItems(data);
      } catch (err) {
        console.error('Failed to load menu items', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      loadItems();
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery, vegOnly, spicyOnly, sortBy]);

  const resetFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setVegOnly(false);
    setSpicyOnly(false);
    setSortBy('popular');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> ABC Hotel Fine Dining Menu
          </span>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight">
            Gourmet Cuisine & Artisanal Delicacies
          </h1>
          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
            Crafted with passion using heirloom recipes, single-origin spices, and organic produce. Prepared fresh to order.
          </p>
        </div>
      </div>

      {/* QR Code Table Session Active Banner */}
      {qrTableInfo && !qrTableInactive && (
        <div className="p-4 sm:p-5 bg-stone-900 text-white rounded-2xl shadow-md border border-amber-800/80 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-amber-300">
                  Table QR Session Active
                </span>
                <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-300 font-bold text-[9px] uppercase rounded-md border border-emerald-400/30">
                  Verified
                </span>
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white">
                Ordering for {qrTableInfo.number} {qrTableInfo.location ? `(${qrTableInfo.location})` : ''}
              </h3>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-300 bg-amber-950 px-3.5 py-1.5 rounded-xl border border-amber-800 shrink-0">
            Dine-in Locked
          </span>
        </div>
      )}

      {/* Inactive Table Warning Banner */}
      {qrTableInactive && (
        <div className="p-4 bg-rose-950 text-white rounded-2xl shadow-md border border-rose-800/80 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-6 h-6 text-rose-300 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-white">
              {qrTableInfo?.number} is Currently Unavailable
            </h3>
            <p className="text-xs text-rose-200 mt-0.5">
              This table is deactivated or undergoing maintenance. Please speak to restaurant staff for table reassignment.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 sm:space-y-4">
        {/* Search & Sort Controls */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-full md:max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Enter Dish Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-amber-600 transition-all text-stone-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Dietary Toggles & Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Veg Only Toggle */}
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex-1 sm:flex-initial justify-center px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                vegOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Leaf className="w-3.5 h-3.5 shrink-0" />
              <span>Veg Only</span>
            </button>

            {/* Spicy Toggle */}
            <button
              onClick={() => setSpicyOnly(!spicyOnly)}
              className={`flex-1 sm:flex-initial justify-center px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                spicyOnly
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>Spicy</span>
            </button>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-hidden focus:border-amber-600"
            >
              <option value="popular">Chef Recommendations</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-2 border-t border-stone-100 -mx-2 px-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Dishes ({items.length})
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filter Chips Summary */}
      {(selectedCategory !== 'all' || searchQuery || vegOnly || spicyOnly || sortBy !== 'popular') && (
        <div className="flex items-center justify-between text-xs text-stone-500 px-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline">Active:</span>
            {selectedCategory !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium text-[11px]">
                {categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium text-[11px]">
                "{searchQuery}"
              </span>
            )}
            {vegOnly && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[11px]">
                Veg
              </span>
            )}
            {spicyOnly && (
              <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 font-medium text-[11px]">
                Spicy
              </span>
            )}
          </div>
          <button
            onClick={resetFilters}
            className="text-amber-800 font-semibold hover:underline text-xs shrink-0 cursor-pointer"
          >
            Reset All
          </button>
        </div>
      )}

      {/* Menu Dishes Grid */}
      {loading ? (
        <Spinner text="Fetching fresh menu items..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="w-8 h-8" />}
          title="No dishes found"
          description="We couldn't find any menu items matching your search or filters."
          actionText="Clear All Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Floating Cart Bar if Items Exist in Cart (Mobile-friendly fixed container) */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md sm:w-full z-30 bg-stone-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center justify-between animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-600 flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs shrink-0">
              {itemCount}
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-stone-400">Your Dining Cart</p>
              <p className="font-mono font-bold text-sm sm:text-base text-amber-300">
                {formatCurrency(total)}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('cart')}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>View Cart</span>
          </button>
        </div>
      )}
    </div>
  );
};
