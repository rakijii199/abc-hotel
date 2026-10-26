/**
 * Common UI Components (Footer, Badges, Modals, Spinners, Empty States)
 */
import React from 'react';
import { createPortal } from 'react-dom';
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
import { BrandIcon, BrandName } from './BrandMark.tsx';

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

  const linkClass = 'lux-link min-h-10 lg:min-h-0 text-stone-600 hover:text-[var(--brand-text)] transition-colors cursor-pointer text-left';

  return (
    <footer className="relative bg-cream text-stone-600 mt-20 overflow-hidden border-t border-[var(--border-subtle)]">
      <div className="absolute -top-40 right-[-10%] w-[560px] h-[560px] rounded-full bg-champagne/40 blur-[140px] pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 lux-hairline" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Signature line */}
        <div className="py-16 sm:py-20 flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-stone-300/60">
          <h2 className="lux-display text-[clamp(2.5rem,6vw,5rem)] text-stone-900 max-w-3xl">
            Dine with us, <em className="font-normal text-[var(--brand)]">stay a while.</em>
          </h2>
          <button onClick={handleBookTable} className="lux-btn lux-btn-wine self-start lg:self-auto">
            <span>Reserve a Table</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-12">
          {/* Brand & Story */}
          <div className="lg:col-span-4 space-y-5">
            <div className="flex items-center gap-3">
              <BrandIcon size="md" />
              <BrandName size="md" />
            </div>
            <p className="text-sm text-stone-600 leading-relaxed max-w-sm">
              A gastronomic sanctuary where heritage recipes meet contemporary culinary mastery, dedicated to memorable
              dining moments and gracious hospitality.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700 mb-5">Explore</h4>
            <ul className="space-y-0 lg:space-y-3 text-sm">
              <li><button onClick={() => navigate('home')} className={linkClass}>Home</button></li>
              <li><button onClick={() => navigate('menu')} className={linkClass}>The Menu</button></li>
              <li><button onClick={handleBookTable} className={linkClass}>Reserve a Table</button></li>
              <li><button onClick={() => navigate('cart')} className={linkClass}>Delivery & Takeaway</button></li>
            </ul>
          </div>

          {/* Account */}
          <div className="lg:col-span-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700 mb-5">Account</h4>
            <ul className="space-y-0 lg:space-y-3 text-sm">
              <li><button onClick={() => navigate('customer-auth')} className={linkClass}>Customer Login</button></li>
              <li><button onClick={() => navigate('customer-register')} className={linkClass}>Register</button></li>
              <li>
                <button onClick={() => navigate('staff-login')} className="min-h-10 lg:min-h-0 text-stone-500 hover:text-[var(--brand-text)] transition-colors cursor-pointer text-xs">
                  Staff Operations Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Hours */}
          <div className="lg:col-span-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700 mb-5">Hours & Location</h4>
            <ul className="space-y-4 text-sm text-stone-600">
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-stone-900 font-medium">Daily Dining</p>
                  <p className="text-xs mt-0.5">09:00 AM – 11:00 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>742 Heritage Promenade, Royal Gardens, Sector 4</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-amber-700 shrink-0" strokeWidth={1.5} />
                <a href="tel:+912249876543" className={linkClass}>+91 22 4987 6543</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-amber-700 shrink-0" strokeWidth={1.5} />
                <a href="mailto:concierge@abchotel.com" className={linkClass}>concierge@abchotel.com</a>
              </li>
            </ul>
            <p className="text-xs text-stone-500 leading-relaxed mt-6 max-w-xs">
              Hosting a private banquet, corporate meeting or celebration? Contact our event team.
            </p>
          </div>
        </div>

        <div className="py-8 border-t border-stone-300/60 text-xs text-stone-500 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} ABC Hotel & Luxury Suites. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
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

  // Rendered into the app's themed root (.lux / .lux-ops) rather than in place:
  // an animated (transformed) ancestor would otherwise trap `position: fixed`
  // inside a card. The themed root keeps the design tokens applied.
  const portalTarget =
    typeof document !== 'undefined'
      ? (document.querySelector('.lux-ops, .lux') as HTMLElement | null) || document.body
      : null;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/35 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`bg-white rounded-2xl shadow-[var(--shadow-float)] border border-[var(--border-subtle)] ring-1 ring-white/60 w-full ${maxWidth} overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95`}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-muted)] to-white">
          <h3 className="section-title">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 w-10 h-10 flex items-center justify-center rounded-full text-stone-400 hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(dialog, portalTarget) : dialog;
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
