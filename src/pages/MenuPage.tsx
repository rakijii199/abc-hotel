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
import { PageHero, LUX_IMAGES, luxImage } from '../components/customer/Reveal.tsx';

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

  const hasActiveFilters = selectedCategory !== 'all' || searchQuery || vegOnly || spicyOnly || sortBy !== 'popular';

  return (
    <div className="pb-28">
      {/* Header Banner */}
      <PageHero
        eyebrow="ABC Hotel Fine Dining Menu"
        title={
          <>
            Gourmet cuisine <em className="font-normal text-champagne">&amp; artisanal delicacies</em>
          </>
        }
        description="Crafted with passion using heirloom recipes, single-origin spices, and organic produce. Prepared fresh to order."
        image={luxImage(LUX_IMAGES.plated, 1800)}
      />

      {/* Filter and Search Bar */}
      <div className="relative md:sticky md:top-[4.5rem] z-30 bg-ivory/90 backdrop-blur-xl border-b border-stone-200/80 shadow-[0_12px_30px_-24px_rgba(26,23,21,0.4)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category Tabs */}
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Menu categories">
            <button
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`relative py-4 text-[11px] font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'all' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              All Dishes <span className="font-mono text-stone-400">({items.length})</span>
              <span className={`absolute left-0 right-0 bottom-0 h-[2px] bg-wine transition-transform duration-500 origin-left ${selectedCategory === 'all' ? 'scale-x-100' : 'scale-x-0'}`} />
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`relative py-4 text-[11px] font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                {cat.name}
                <span className={`absolute left-0 right-0 bottom-0 h-[2px] bg-wine transition-transform duration-500 origin-left ${selectedCategory === cat.id ? 'scale-x-100' : 'scale-x-0'}`} />
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center py-3 border-t border-stone-200/70">
            {/* Search Input */}
            <div className="relative flex-1 max-w-full md:max-w-sm">
              <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search dishes"
                aria-label="Search dishes by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-10 bg-white border border-stone-200 rounded-full text-sm focus:outline-hidden focus:border-amber-500 focus:ring-4 focus:ring-amber-200/40 transition-all text-stone-900 placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Dietary Toggles & Sort Dropdown */}
            <div className="flex items-center gap-2">
              {/* Veg Only Toggle */}
              <button
                onClick={() => setVegOnly(!vegOnly)}
                aria-pressed={vegOnly}
                className={`shrink-0 justify-center h-11 px-4 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  vegOnly
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                }`}
              >
                <Leaf className="w-3.5 h-3.5 shrink-0" />
                <span>Veg Only</span>
              </button>

              {/* Spicy Toggle */}
              <button
                onClick={() => setSpicyOnly(!spicyOnly)}
                aria-pressed={spicyOnly}
                className={`shrink-0 justify-center h-11 px-4 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  spicyOnly
                    ? 'bg-wine text-white border-wine'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span>Spicy</span>
              </button>

              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort dishes"
                className="flex-1 md:flex-initial min-w-0 h-11 px-4 text-xs font-semibold bg-white border border-stone-200 rounded-full text-stone-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
              >
                <option value="popular">Chef Recommendations</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 space-y-6 sm:space-y-8">
        {/* QR Code Table Session Active Banner */}
        {qrTableInfo && !qrTableInactive && (
          <div className="p-4 sm:p-5 bg-ink text-ivory rounded-2xl border border-gold/30 flex flex-wrap items-center justify-between gap-3 animate-[lux-rise_0.6s_var(--ease-lux)]">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full border border-gold/50 text-gold flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-[0.24em] text-gold">
                    Table QR Session Active
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 font-bold text-[9px] uppercase rounded-full border border-emerald-400/30">
                    Verified
                  </span>
                </div>
                <h3 className="lux-display text-2xl text-ivory mt-1">
                  Ordering for {qrTableInfo.number} {qrTableInfo.location ? `(${qrTableInfo.location})` : ''}
                </h3>
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-champagne px-3.5 py-2 rounded-full border border-gold/40 shrink-0">
              Dine-in Locked
            </span>
          </div>
        )}

        {/* Inactive Table Warning Banner */}
        {qrTableInactive && (
          <div className="p-4 bg-rose-950 text-white rounded-2xl border border-rose-800/80 flex items-center gap-3" role="alert">
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

        {/* Active Filter Chips Summary */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-stone-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] font-semibold text-stone-400">Filtered by</span>
              {selectedCategory !== 'all' && (
                <span className="px-3 py-1 rounded-full bg-white text-stone-800 border border-stone-200 font-medium text-[11px]">
                  {categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
                </span>
              )}
              {searchQuery && (
                <span className="px-3 py-1 rounded-full bg-white text-stone-800 border border-stone-200 font-medium text-[11px]">
                  "{searchQuery}"
                </span>
              )}
              {vegOnly && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[11px]">
                  Veg
                </span>
              )}
              {spicyOnly && (
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-medium text-[11px]">
                  Spicy
                </span>
              )}
            </div>
            <button
              onClick={resetFilters}
              className="lux-link text-stone-900 font-semibold text-xs shrink-0 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}

        {/* Menu Dishes Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6" aria-busy="true" aria-label="Fetching fresh menu items">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#fffdf9] border border-stone-200/70 overflow-hidden animate-pulse">
                <div className="aspect-[4/3.4] bg-stone-200/60" />
                <div className="p-5 space-y-3">
                  <div className="h-2.5 w-1/3 bg-stone-200/80 rounded-full" />
                  <div className="h-5 w-3/4 bg-stone-200/80 rounded-full" />
                  <div className="h-3 w-full bg-stone-100 rounded-full" />
                  <div className="h-3 w-2/3 bg-stone-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="w-8 h-8" />}
            title="No dishes found"
            description="We couldn't find any menu items matching your search or filters."
            actionText="Clear All Filters"
            onAction={resetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="animate-[lux-rise_0.7s_var(--ease-lux)_both]"
                style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}
              >
                <MenuItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Cart Bar if Items Exist in Cart (Mobile-friendly fixed container) */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md sm:w-full z-30 bg-ink/95 backdrop-blur-xl text-ivory p-2.5 pl-4 rounded-full shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] border border-gold/25 flex items-center justify-between animate-[lux-rise_0.5s_var(--ease-lux)]">
          <div className="flex items-center gap-3">
            <div
              key={itemCount}
              className="w-9 h-9 rounded-full bg-gold text-ink flex items-center justify-center font-extrabold text-xs shrink-0 animate-[lux-pop_0.4s_var(--ease-lux)]"
            >
              {itemCount}
            </div>
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.2em] text-ivory/50">Your Dining Cart</p>
              <p className="font-mono font-semibold text-sm sm:text-base text-champagne">
                {formatCurrency(total)}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('cart')}
            className="lux-btn lux-btn-gold !min-h-[2.75rem] !px-5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>View Cart</span>
          </button>
        </div>
      )}
    </div>
  );
};
