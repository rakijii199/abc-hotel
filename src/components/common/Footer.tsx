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
  Star
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

  return (
    <footer className="bg-stone-900 text-stone-300 pt-16 pb-12 border-t border-amber-900/30 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand & Story */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-serif font-bold text-lg shadow-md">
                ABC
              </div>
              <div>
                <span className="font-serif font-bold text-xl tracking-tight text-white block">
                  ABC HOTEL
                </span>
                <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-amber-400">
                  Luxury Dining & Suites
                </span>
              </div>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              An iconic gastronomic sanctuary where heritage recipes meet contemporary culinary mastery. Dedicated to memorable dining moments and flawless hospitality.
            </p>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
              <Award className="w-4 h-4" />
              <span>Michelin Recommended 2026</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-white font-semibold text-base mb-4 tracking-wide uppercase text-xs text-amber-400">
              Quick Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => navigate('home')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Home & Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('menu')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Gourmet Menu
                </button>
              </li>
              <li>
                <button
                  onClick={handleBookTable}
                  className="hover:text-amber-400 transition-colors"
                >
                  Reserve a Table
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('cart')}
                  className="hover:text-amber-400 transition-colors"
                >
                  Food Delivery & Takeaway
                </button>
              </li>
              <li className="pt-1 border-t border-stone-800">
                <button
                  onClick={() => navigate('customer-auth')}
                  className="hover:text-amber-400 transition-colors font-medium text-xs text-amber-200/90"
                >
                  Customer Login / Register
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('staff-login')}
                  className="hover:text-purple-300 transition-colors font-medium text-xs text-stone-400"
                >
                  Staff Operations Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Hours */}
          <div>
            <h4 className="font-serif text-white font-semibold text-base mb-4 tracking-wide uppercase text-xs text-amber-400">
              Operating Hours & Location
            </h4>
            <ul className="space-y-3 text-sm text-stone-400">
              <li className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Daily Dining</p>
                  <p className="text-xs">09:00 AM – 11:00 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>742 Heritage Promenade, Royal Gardens, Sector 4</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                <span>+91 22 4987 6543</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                <span>concierge@abchotel.com</span>
              </li>
            </ul>
          </div>

          {/* Newsletter / Security Guarantee */}
          <div className="space-y-4">
            <h4 className="font-serif text-white font-semibold text-base mb-2 tracking-wide uppercase text-xs text-amber-400">
              Private Events & Inquiries
            </h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              Looking to host private banquets, corporate meetings, or royal celebrations? Contact our event curators.
            </p>
            <div className="p-3.5 rounded-xl bg-stone-800/80 border border-stone-700/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                100% Guaranteed Reservations
              </div>
              <p className="text-[11px] text-stone-400">
                Real-time conflict prevention algorithm with atomic mutex verification.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-stone-800 text-center text-xs text-stone-500 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} ABC Hotel & Luxury Suites. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>ISO 9001:2015 Certified Hospitality</span>
            <span>•</span>
            <span>Zero-Tolerance Food Safety</span>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-stone-200 w-full ${maxWidth} overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-[#faf8f5]">
          <h3 className="font-serif font-bold text-lg text-stone-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
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
