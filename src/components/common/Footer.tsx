/**
 * Common UI Components (Footer, Badges, Modals, Spinners, Empty States)
 */
import React from 'react';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Award,
  ShieldCheck,
  Sparkles,
  X,
  AlertCircle,
  Leaf,
  Flame,
  Star,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const Footer: React.FC<{ navigate: (route: string, state?: any) => void }> = ({ navigate }) => {
  const { isAuthenticated } = useAuth();

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

  const linkClass = 'lux-link min-h-10 lg:min-h-0 text-ivory/65 hover:text-ivory transition-colors cursor-pointer text-left';

  return (
    <footer className="relative bg-ink text-ivory/70 mt-20 overflow-hidden lux-grain">
      <div className="absolute inset-x-0 top-0 lux-hairline" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Signature line */}
        <div className="py-16 sm:py-20 flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/[0.08]">
          <h2 className="lux-display text-[clamp(2.5rem,6vw,5rem)] text-ivory max-w-3xl">
            Dine with us, <em className="font-normal text-champagne">stay a while.</em>
          </h2>
          <button onClick={handleBookTable} className="lux-btn lux-btn-gold self-start lg:self-auto">
            <span>Reserve a Table</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-12">
          {/* Brand & Story */}
          <div className="lg:col-span-4 space-y-5">
            <div className="flex items-center gap-3">
              <span className="relative w-11 h-11 flex items-center justify-center border border-gold/60 text-champagne">
                <span className="absolute inset-[3px] border border-gold/25" />
                <span className="font-display text-[15px] font-semibold tracking-[0.06em]">ABC</span>
              </span>
              <div className="leading-none">
                <span className="font-display text-xl font-semibold tracking-[0.18em] text-ivory block">ABC HOTEL</span>
                <span className="text-[9px] tracking-[0.32em] uppercase font-semibold text-gold block mt-1">
                  Luxury Dining & Suites
                </span>
              </div>
            </div>
            <p className="text-sm text-ivory/55 leading-relaxed max-w-sm">
              A gastronomic sanctuary where heritage recipes meet contemporary culinary mastery, dedicated to memorable
              dining moments and gracious hospitality.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold mb-5">Explore</h4>
            <ul className="space-y-0 lg:space-y-3 text-sm">
              <li><button onClick={() => navigate('home')} className={linkClass}>Home</button></li>
              <li><button onClick={() => navigate('menu')} className={linkClass}>The Menu</button></li>
              <li><button onClick={handleBookTable} className={linkClass}>Reserve a Table</button></li>
              <li><button onClick={() => navigate('cart')} className={linkClass}>Delivery & Takeaway</button></li>
            </ul>
          </div>

          {/* Account */}
          <div className="lg:col-span-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold mb-5">Account</h4>
            <ul className="space-y-0 lg:space-y-3 text-sm">
              <li><button onClick={() => navigate('customer-auth')} className={linkClass}>Customer Login</button></li>
              <li><button onClick={() => navigate('customer-register')} className={linkClass}>Register</button></li>
              <li>
                <button onClick={() => navigate('staff-login')} className="min-h-10 lg:min-h-0 text-ivory/40 hover:text-purple-200 transition-colors cursor-pointer text-xs">
                  Staff Operations Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Hours */}
          <div className="lg:col-span-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold mb-5">Hours & Location</h4>
            <ul className="space-y-4 text-sm text-ivory/60">
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-gold shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-ivory font-medium">Daily Dining</p>
                  <p className="text-xs mt-0.5">09:00 AM – 11:00 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gold shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>742 Heritage Promenade, Royal Gardens, Sector 4</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gold shrink-0" strokeWidth={1.5} />
                <a href="tel:+912249876543" className={linkClass}>+91 22 4987 6543</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gold shrink-0" strokeWidth={1.5} />
                <a href="mailto:concierge@abchotel.com" className={linkClass}>concierge@abchotel.com</a>
              </li>
            </ul>
            <p className="text-xs text-ivory/45 leading-relaxed mt-6 max-w-xs">
              Hosting a private banquet, corporate meeting or celebration? Contact our event team.
            </p>
          </div>
        </div>

        <div className="py-8 border-t border-white/[0.08] text-xs text-ivory/40 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} ABC Hotel & Luxury Suites. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-gold/70" />
            Instantly confirmed table reservations
          </p>
        </div>
      </div>
    </footer>
  );
};

export const DietaryBadge: React.FC<{
  vegetarian: boolean;
  spicy?: boolean;
  spiceLevel?: string;
  isChefSpecial?: boolean;
}> = ({ vegetarian, spicy, spiceLevel, isChefSpecial }) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {vegetarian ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
          <Leaf className="w-3 h-3" /> Veg
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
          <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" /> Non-Veg
        </span>
      )}

      {spicy && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          <Flame className="w-3 h-3 text-orange-600" /> {spiceLevel || 'Spicy'}
        </span>
      )}

      {isChefSpecial && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
          <Star className="w-3 h-3 fill-amber-500 text-amber-600" /> Chef's Signature
        </span>
      )}
    </div>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-stone-200 w-full ${maxWidth} overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95`}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-100 bg-[#faf8f5]">
          <h3 className="font-serif font-bold text-lg text-stone-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 w-10 h-10 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; text?: string }> = ({
  size = 'md',
  text
}) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <div
        className={`${sizeClass} border-3 border-amber-200 border-t-amber-700 rounded-full animate-spin`}
      />
      {text && <p className="text-sm font-medium text-stone-600">{text}</p>}
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionText, onAction }) => {
  return (
    <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-stone-300 bg-white/50 max-w-lg mx-auto my-6">
      {icon ? (
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
          {icon}
        </div>
      ) : (
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
      )}
      <h3 className="font-serif font-bold text-lg text-stone-900 mb-1">{title}</h3>
      <p className="text-sm text-stone-500 mb-5 leading-relaxed max-w-sm mx-auto">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-all"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
