/**
 * Landing Page for ABC Hotel & Restaurant
 * Optimized for mobile, tablet, and desktop viewports
 */
import React, { useEffect, useState } from 'react';
import {
  UtensilsCrossed,
  Calendar,
  Award,
  Sparkles,
  Star,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Wine,
  HeartHandshake,
  ShoppingBag
} from 'lucide-react';
import { MenuItem } from '../types/index.ts';
import { MenuApi } from '../api/index.ts';
import { MenuItemCard } from '../components/menu/MenuItemCard.tsx';
import { Spinner } from '../components/common/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export const HomePage: React.FC<{ navigate: (route: string, state?: any) => void }> = ({ navigate }) => {
  const { isAuthenticated } = useAuth();
  const [featuredDishes, setFeaturedDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBookTable = () => {
    if (isAuthenticated) {
      navigate('book-table');
    } else {
      navigate('login', {
        returnTo: 'book-table',
        message: 'Please login or register to book a table.'
      });
    }
  };

  const handleBookOrder = () => {
    if (isAuthenticated) {
      navigate('menu');
    } else {
      navigate('login', {
        returnTo: 'menu',
        message: 'Please login or register to place an order.'
      });
    }
  };

  useEffect(() => {
    async function loadFeatured() {
      try {
        const items = await MenuApi.getItems({ sortBy: 'popular' });
        setFeaturedDishes(items.filter((i) => i.isChefSpecial).slice(0, 4));
      } catch (err) {
        console.error('Failed to load featured dishes', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 pb-12 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[520px] sm:min-h-[580px] lg:min-h-[640px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl mx-3 sm:mx-6 lg:mx-8 mt-3 sm:mt-4 bg-stone-900 flex items-center">
        {/* Background Image with Dark Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&auto=format&fit=crop&q=85"
            alt="ABC Hotel Luxury Restaurant Interior"
            className="w-full h-full object-cover object-center opacity-40 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/95 via-black/75 to-black/40" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl px-4 sm:px-10 lg:px-16 py-10 sm:py-16 text-white space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 backdrop-blur-md text-amber-300 text-[11px] sm:text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Michelin Recommended Luxury</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15] text-balance">
            Experience Exceptional Dining at <span className="text-amber-400 italic">ABC Hotel</span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-stone-300 max-w-2xl leading-relaxed font-light">
            Reserve your table, explore our award-winning menu, and immerse in a seamless symphony of rich royal heritage and modern culinary artistry.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
            <button
              onClick={handleBookTable}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold text-sm sm:text-base shadow-lg hover:shadow-amber-600/30 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-amber-200 group-hover:scale-110 transition-transform" />
              <span>Book a Table</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={handleBookOrder}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur-md border border-white/20 text-white font-semibold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-amber-300" />
              <span>Book an Order</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="pt-6 sm:pt-8 grid grid-cols-3 gap-2 sm:gap-6 max-w-lg border-t border-white/10 text-center sm:text-left">
            <div>
              <span className="font-serif text-lg sm:text-2xl font-bold text-amber-400 block">4.9 / 5</span>
              <span className="text-stone-400 text-[10px] sm:text-xs">Guest Rating</span>
            </div>
            <div>
              <span className="font-serif text-lg sm:text-2xl font-bold text-amber-400 block">100%</span>
              <span className="text-stone-400 text-[10px] sm:text-xs">Instant Lock</span>
            </div>
            <div>
              <span className="font-serif text-lg sm:text-2xl font-bold text-amber-400 block">12 AM - 11 PM</span>
              <span className="text-stone-400 text-[10px] sm:text-xs">Daily Service</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Booking Strip */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 -mt-6 sm:-mt-12 relative z-20">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-stone-200/80 p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
          <div className="flex items-center gap-3 p-1 sm:p-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-stone-400 font-medium">Step 1</p>
              <p className="text-xs sm:text-sm font-bold text-stone-800">Select Date & Time</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-1 sm:p-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-stone-400 font-medium">Step 2</p>
              <p className="text-xs sm:text-sm font-bold text-stone-800">Pick Table & Floor</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-1 sm:p-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] sm:text-xs text-stone-400 font-medium">Step 3</p>
              <p className="text-xs sm:text-sm font-bold text-stone-800">Instant Guarantee</p>
            </div>
          </div>

          <div className="pt-2 sm:pt-0">
            <button
              onClick={handleBookTable}
              className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 font-semibold text-xs sm:text-sm transition-all text-center flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>Reserve Table Now</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* About ABC Hotel Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div className="space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-800">
              <Award className="w-4 h-4 text-amber-600" />
              <span>About ABC Hotel & Fine Dining</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-900 leading-tight">
              A Legacy of Regal Flavors & Sophisticated Comfort
            </h2>

            <p className="text-stone-600 text-xs sm:text-sm lg:text-base leading-relaxed">
              Established with an enduring passion for culinary excellence, <strong>ABC Hotel</strong> blends timeless architectural elegance with bespoke hospitality. Our master chefs draw inspiration from century-old royal recipes and fresh organic harvests, presenting authentic delicacies paired with curated vintage selections.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60">
                <Wine className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 mb-2" />
                <h4 className="font-serif font-bold text-stone-900 text-sm">Fine Dining Cellar</h4>
                <p className="text-xs text-stone-500 mt-1">Artisanal mocktails & global botanical infusions.</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60">
                <HeartHandshake className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 mb-2" />
                <h4 className="font-serif font-bold text-stone-900 text-sm">White-Glove Service</h4>
                <p className="text-xs text-stone-500 mt-1">Dedicated concierge and customized event styling.</p>
              </div>
            </div>
          </div>

          <div className="relative mt-4 lg:mt-0">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl aspect-4/3 border-4 border-white">
              <img
                src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=1000&auto=format&fit=crop&q=80"
                alt="ABC Hotel Dining Room"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 bg-white p-4 sm:p-5 rounded-2xl shadow-xl border border-stone-200 max-w-[260px] sm:max-w-xs">
              <div className="flex items-center gap-1 text-amber-500 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-stone-800">
                "An unforgettable evening. The Truffle Malai Tikka and Dal Makhani are masterworks."
              </p>
              <p className="text-[10px] text-stone-400 mt-1">— Gastronomy Guide 2026</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Chef Specials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-800 block mb-1">
              Culinary Highlights
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              Chef's Signature Dishes
            </h2>
          </div>

          <button
            onClick={() => navigate('menu')}
            className="text-xs sm:text-sm font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1.5 transition-colors group cursor-pointer"
          >
            <span>View Complete Menu</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {loading ? (
          <Spinner text="Loading gourmet specials..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredDishes.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Why Choose Us */}
      <section className="bg-stone-900 text-white py-12 sm:py-16 -mx-3 sm:-mx-6 lg:-mx-8 px-4 sm:px-8 lg:px-12 rounded-2xl sm:rounded-3xl">
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              The ABC Standard
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">Why Dine at ABC Hotel</h2>
            <p className="text-xs sm:text-sm text-stone-400">
              Every detail is calibrated to deliver an effortless, luxurious, and flavorful hospitality experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-5 sm:p-6 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-base sm:text-lg">
                01
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white">Guaranteed Table Locking</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Zero double-booking guarantee powered by atomic transactional concurrency locks. Your preferred table is held exclusively for you.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-base sm:text-lg">
                02
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white">Authentic Artisanal Ingredients</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Farm-fresh, zero preservatives, slow-cooked overnight curries, hand-ground spices, and pure unadulterated cold-pressed oils.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-stone-800/80 border border-stone-700/60 space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold text-base sm:text-lg">
                03
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg text-white">Real-Time Kitchen Tracking</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Watch your order progress live from the chef's tandoor to your table or suite with accurate preparation milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Guest Testimonials
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
            Praised by Food Connoisseurs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex text-amber-500 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs sm:text-sm text-stone-600 italic leading-relaxed">
              "The table reservation process was instantaneous, and the terrace ambiance at sunset is simply magnificent. The Butter Chicken is second to none!"
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">
                AK
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">Ananya Kapoor</p>
                <p className="text-[10px] text-stone-400">Verified Diner</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex text-amber-500 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs sm:text-sm text-stone-600 italic leading-relaxed">
              "We hosted a 12-person family anniversary. The booking reference worked seamlessly, the staff attended to our special seating request, and the desserts were divine."
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">
                RS
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">Rahul Sharma</p>
                <p className="text-[10px] text-stone-400">Family Banquet Host</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/80 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex text-amber-500 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs sm:text-sm text-stone-600 italic leading-relaxed">
              "I frequently order room service while staying at ABC Hotel. The live status tracker is accurate and the food arrives piping hot with restaurant-grade presentation."
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">
                DM
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">David Miller</p>
                <p className="text-[10px] text-stone-400">Hotel Resident Guest</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center space-y-4 sm:space-y-6 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-3 sm:space-y-4">
            <h2 className="font-serif text-2xl sm:text-4xl font-bold">
              Ready to Savor an Unrivaled Dining Experience?
            </h2>
            <p className="text-amber-100 text-xs sm:text-base leading-relaxed">
              Reserve your table today or order from our gourmet menu directly to your suite or doorstep.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-2">
              <button
                onClick={handleBookTable}
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-white text-stone-900 hover:bg-amber-50 font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Reserve Your Table
              </button>
              <button
                onClick={handleBookOrder}
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-amber-900/60 hover:bg-amber-900/80 border border-amber-300/30 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                Browse Menu
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
