/**
 * Primary Navigation Bar for ABC Hotel
 * Differentiates Customer, Staff Admin, Hotel Manager, Kitchen, and Delivery Rider workflows
 * Presentation: transparent over the light home hero, ivory glass once scrolled.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  UtensilsCrossed,
  Calendar,
  ShoppingBag,
  User as UserIcon,
  LogOut,
  Shield,
  Menu as MenuIcon,
  X,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  ChefHat,
  Truck,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useCart } from '../../context/CartContext.tsx';

interface NavbarProps {
  currentRoute: string;
  navigate: (route: string, state?: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, navigate }) => {
  const { user, isAuthenticated, isAdmin, isManager, isKitchen, isDelivery, logout } = useAuth();
  const { itemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isStaffOrManager = isAdmin || isManager;
  const isSpecialRole = isStaffOrManager || isKitchen || isDelivery;

  // Float transparently over the cinematic home hero (customers & guests only)
  const overlay = currentRoute === 'home' && !isSpecialRole;
  const solid = !overlay || scrolled || mobileMenuOpen;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus with Escape / outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  // Prevent background scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNav = (route: string, state?: any) => {
    navigate(route, state);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  };

  const handleBookTableClick = () => {
    if (isAuthenticated) {
      handleNav('book-table');
    } else {
      handleNav('login', {
        returnTo: 'book-table',
        message: 'Please login or register to book a table.'
      });
    }
  };

  const getRoleLandingRoute = () => {
    if (isDelivery) return 'delivery';
    if (isKitchen) return 'kitchen';
    if (isStaffOrManager) return 'admin';
    return 'home';
  };

  const roleAvatarClass = isStaffOrManager
    ? 'bg-gradient-to-tr from-amber-800 to-amber-600 text-white'
    : isKitchen
    ? 'bg-gradient-to-tr from-amber-600 to-amber-600 text-white'
    : isDelivery
    ? 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white'
    : 'bg-gradient-to-br from-champagne to-gold text-ink';

  const roleBadgeClass = isStaffOrManager
    ? 'bg-amber-100 text-amber-800'
    : isKitchen
    ? 'bg-amber-100 text-amber-800'
    : isDelivery
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-amber-100 text-amber-800';

  const navLink = (active: boolean) =>
    `lux-link py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors cursor-pointer ${
      active ? 'text-[var(--brand-text)]' : 'text-stone-600 hover:text-[var(--brand-text)]'
    }`;

  return (
    <header
      className={`${overlay ? 'fixed' : 'sticky'} inset-x-0 top-0 z-40 transition-[background-color,box-shadow,border-color] duration-500 ${
        solid
          ? 'bg-[var(--glass-bg-strong)] backdrop-blur-xl backdrop-saturate-150 border-b border-[var(--border-subtle)] shadow-[var(--shadow-xs)]'
          : 'bg-gradient-to-b from-[rgba(255,253,249,0.6)] to-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between transition-[height] duration-500 ${solid && !mobileMenuOpen ? 'h-16 sm:h-[4.5rem]' : 'h-16 sm:h-20'}`}>
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => handleNav(getRoleLandingRoute())}
            className="flex items-center gap-3 cursor-pointer group shrink-0 text-left"
            aria-label="ABC Hotel home"
          >
            <span className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center border border-gold/70 bg-white/60 text-[var(--brand-text)] transition-colors group-hover:border-[var(--brand)]">
              <span className="absolute inset-[3px] border border-gold/35" />
              <span className="font-display text-[13px] sm:text-[15px] font-semibold tracking-[0.06em]">ABC</span>
            </span>
            <span className="leading-none hidden min-[360px]:block">
              <span className="font-display text-lg sm:text-xl font-semibold tracking-[0.18em] text-stone-900 block">
                ABC HOTEL
              </span>
              <span className="text-[8.5px] sm:text-[9px] tracking-[0.32em] uppercase font-semibold text-amber-700 block mt-1">
                {isDelivery
                  ? 'Delivery Staff Portal'
                  : isKitchen
                  ? 'Kitchen Department KDS'
                  : isManager
                  ? 'Hotel Manager Suite'
                  : isAdmin
                  ? 'Staff Operations Suite'
                  : 'Luxury Dining & Suites'}
              </span>
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8" aria-label="Primary">
            {!isSpecialRole ? (
              // Customer Navigation Links ONLY
              <>
                <button
                  onClick={() => handleNav('home')}
                  aria-current={currentRoute === 'home' ? 'page' : undefined}
                  className={navLink(currentRoute === 'home')}
                >
                  Home
                </button>
                <button
                  onClick={() => handleNav('menu')}
                  aria-current={currentRoute === 'menu' ? 'page' : undefined}
                  className={navLink(currentRoute === 'menu')}
                >
                  Menu
                </button>
                <button
                  onClick={handleBookTableClick}
                  aria-current={currentRoute === 'book-table' ? 'page' : undefined}
                  className={navLink(currentRoute === 'book-table')}
                >
                  Reservations
                </button>

                {isAuthenticated && (
                  <>
                    <button
                      onClick={() => handleNav('orders')}
                      aria-current={currentRoute === 'my-orders' || currentRoute === 'orders' ? 'page' : undefined}
                      className={navLink(currentRoute === 'my-orders' || currentRoute === 'orders')}
                    >
                      My Orders
                    </button>
                    <button
                      onClick={() => handleNav('bookings')}
                      aria-current={currentRoute === 'my-bookings' || currentRoute === 'bookings' ? 'page' : undefined}
                      className={`${navLink(currentRoute === 'my-bookings' || currentRoute === 'bookings')} hidden lg:inline-flex`}
                    >
                      My Bookings
                    </button>
                  </>
                )}
              </>
            ) : isDelivery ? (
              // Delivery staff link
              <button
                onClick={() => handleNav('delivery')}
                className="px-4 py-2 text-xs font-bold rounded-full transition-all flex items-center gap-2 cursor-pointer text-amber-950 bg-amber-100 border border-amber-300"
              >
                <Truck className="w-4 h-4 text-amber-700" />
                Delivery Dispatch Board
              </button>
            ) : isKitchen ? (
              // Kitchen link
              <button
                onClick={() => handleNav('kitchen')}
                className="px-4 py-2 text-xs font-bold rounded-full transition-all flex items-center gap-2 cursor-pointer text-amber-950 bg-amber-100 border border-amber-300"
              >
                <ChefHat className="w-4 h-4 text-amber-700" />
                Kitchen Display System
              </button>
            ) : (
              // Staff Admin / Manager link
              <button
                onClick={() => handleNav('admin')}
                className="px-4 py-2 text-xs font-bold rounded-full transition-all flex items-center gap-2 cursor-pointer text-[var(--brand-text)] bg-[var(--brand-soft)] border border-[var(--brand-border)] hover:bg-[var(--brand-soft-hover)]"
              >
                <Shield className="w-4 h-4 text-amber-700" />
                {isManager ? 'Hotel Manager Suite' : 'Staff Operations Suite'}
              </button>
            )}
          </nav>

          {/* Right Action Icons & User Menu */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Customer Cart Button (Hidden for all internal staff) */}
            {!isSpecialRole && (
              <button
                onClick={() => handleNav('cart')}
                className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                  currentRoute === 'cart'
                    ? 'text-[var(--brand-text)] bg-[var(--brand-soft)]'
                    : 'text-stone-700 hover:text-[var(--brand-text)] hover:bg-[var(--brand-soft)]'
                }`}
                aria-label={`Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              >
                <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.6} />
                {itemCount > 0 && (
                  <span
                    key={itemCount}
                    className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand)] text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-[var(--surface)]animate-[lux-pop_0.4s_var(--ease-lux)]"
                  >
                    {itemCount}
                  </span>
                )}
              </button>
            )}

            {/* User Dropdown or Login CTA (Desktop) */}
            {isAuthenticated && user ? (
              <div className="relative hidden md:block" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-haspopup="menu"
                  aria-expanded={userDropdownOpen}
                  className="flex items-center gap-2 p-1 pl-3.5 rounded-full border border-[var(--border-subtle)] hover:border-[var(--brand-border)] bg-white/70 shadow-[var(--shadow-xs)] transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-stone-800 max-w-[100px] truncate">
                    {user.firstName}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${roleAvatarClass}`}>
                    {user.firstName[0]}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-64 bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-float)] border border-[var(--border-subtle)] py-2 z-50 origin-top-right animate-[lux-drop_0.25s_var(--ease-lux)]"
                  >
                    <div className="px-4 pt-2 pb-3 border-b border-stone-100">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-semibold">Signed in as</p>
                      <p className="font-display text-lg font-semibold text-stone-900 truncate mt-0.5">
                        {user.firstName} {user.lastName}
                      </p>
                      <span className={`inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${roleBadgeClass}`}>
                        {user.role}
                      </span>
                    </div>

                    {isDelivery ? (
                      // Delivery Rider menu
                      <button
                        role="menuitem"
                        onClick={() => handleNav('delivery')}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Truck className="w-4 h-4 text-emerald-700" />
                        Delivery Dispatch Board
                      </button>
                    ) : isKitchen ? (
                      // Kitchen menu
                      <button
                        role="menuitem"
                        onClick={() => handleNav('kitchen')}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <ChefHat className="w-4 h-4 text-amber-700" />
                        Kitchen Display System
                      </button>
                    ) : isStaffOrManager ? (
                      // Staff Admin & Manager menu
                      <button
                        role="menuitem"
                        onClick={() => handleNav('admin')}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4 text-amber-700" />
                        Operations Suite
                      </button>
                    ) : (
                      // Customer account menu items
                      <div className="py-1">
                        {[
                          { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                          { route: 'profile', label: 'Profile & Settings', icon: UserIcon },
                          { route: 'my-orders', label: 'My Orders', icon: ShoppingBag },
                          { route: 'my-bookings', label: 'My Bookings', icon: Calendar }
                        ].map(({ route, label, icon: Icon }) => (
                          <button
                            key={route}
                            role="menuitem"
                            onClick={() => handleNav(route)}
                            className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-amber-50 hover:text-stone-900 flex items-center gap-3 cursor-pointer transition-colors"
                          >
                            <Icon className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-stone-100 mt-1 pt-1">
                      <button
                        role="menuitem"
                        onClick={() => {
                          logout();
                          setUserDropdownOpen(false);
                          handleNav('login');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-3 font-medium cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-4">
                <button
                  onClick={() => handleNav('customer-auth')}
                  className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-600 hover:text-[var(--brand-text)] transition-colors cursor-pointer lux-link"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleNav('customer-register')}
                  className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-600 hover:text-[var(--brand-text)] transition-colors cursor-pointer lux-link"
                >
                  Register
                </button>
                <button
                  onClick={() => handleNav('staff-login')}
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 hover:text-stone-800 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Login as Staff"
                >
                  <Shield className="w-3 h-3" />
                  <span>Staff</span>
                </button>
              </div>
            )}

            {/* Primary reservation CTA (customers & guests, large screens) */}
            {!isSpecialRole && (
              <button
                onClick={handleBookTableClick}
                className="hidden lg:inline-flex lux-btn lux-btn-gold !min-h-[2.5rem] !px-5 !text-[10.5px] ml-1"
              >
                Reserve a Table
              </button>
            )}

            {/* Mobile Header Quick User Access / Login */}
            {isAuthenticated && user ? (
              <button
                onClick={() => handleNav(isSpecialRole ? getRoleLandingRoute() : 'dashboard')}
                className={`md:hidden w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${roleAvatarClass}`}
                aria-label="User Account"
                title={`${user.firstName} (${user.role})`}
              >
                {user.firstName[0]}
              </button>
            ) : (
              <button
                onClick={() => handleNav('customer-auth')}
                className="md:hidden flex items-center gap-1.5 px-3 h-9 rounded-full text-[10px] font-bold uppercase tracking-[0.16em] text-stone-800 bg-white/70 border border-[var(--border-subtle)] hover:border-[var(--brand-border)] transition-colors cursor-pointer"
                aria-label="Customer Login"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-700" />
                <span>Login</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center text-stone-800 hover:bg-[var(--brand-soft)] rounded-full transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-[var(--brand-text)]" /> : <MenuIcon className="w-6 h-6" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 sm:top-20 bottom-0 bg-[var(--page-bg)] border-t border-[var(--border-subtle)] z-50 overflow-y-auto pb-10 animate-[lux-drop_0.3s_var(--ease-lux)]">
          <div className="px-5 pt-6 space-y-8">
            {/* Navigation Links */}
            <nav className="space-y-1" aria-label="Mobile">
              {!isSpecialRole ? (
                // Customer mobile links
                <>
                  {[
                    { key: 'home', label: 'Home', active: currentRoute === 'home', onClick: () => handleNav('home') },
                    { key: 'menu', label: 'The Menu', active: currentRoute === 'menu', onClick: () => handleNav('menu') },
                    { key: 'book', label: 'Reserve a Table', active: currentRoute === 'book-table', onClick: handleBookTableClick },
                    { key: 'cart', label: `Your Cart (${itemCount})`, active: currentRoute === 'cart', onClick: () => handleNav('cart') }
                  ].map((link, i) => (
                    <button
                      key={link.key}
                      onClick={link.onClick}
                      className={`w-full text-left py-3 flex items-center justify-between border-b border-[var(--border-subtle)] cursor-pointer group ${
                        link.active ? 'text-[var(--brand-text)]' : 'text-stone-900 hover:text-[var(--brand-text)]'
                      }`}
                    >
                      <span className="flex items-baseline gap-4">
                        <span className="text-[10px] font-semibold text-amber-700 tracking-widest">0{i + 1}</span>
                        <span className="font-display text-3xl font-medium">{link.label}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 text-amber-700 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
                </>
              ) : isDelivery ? (
                // Delivery Staff mobile link
                <button
                  onClick={() => handleNav('delivery')}
                  className="w-full text-left px-4 py-3.5 text-sm font-bold text-amber-950 bg-amber-50 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-5 h-5 text-amber-700" />
                    <span>Delivery Dispatch Board</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500" />
                </button>
              ) : isKitchen ? (
                // Kitchen mobile link
                <button
                  onClick={() => handleNav('kitchen')}
                  className="w-full text-left px-4 py-3.5 text-sm font-bold text-amber-950 bg-amber-50 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ChefHat className="w-5 h-5 text-amber-700" />
                    <span>Kitchen Display System</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500" />
                </button>
              ) : (
                // Staff Admin / Manager mobile link
                <button
                  onClick={() => handleNav('admin')}
                  className="w-full text-left px-4 py-3.5 text-sm font-bold text-amber-900 bg-amber-50 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-amber-700" />
                    <span>{isAdmin ? 'Staff Operations Suite' : 'Hotel Manager Suite'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500" />
                </button>
              )}
            </nav>

            {/* Authenticated Actions on Mobile */}
            {isAuthenticated && user && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)] p-2">
                <div className="px-3 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Signed in as</p>
                    <p className="font-display text-xl text-stone-900">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${roleBadgeClass}`}>
                    {user.role}
                  </span>
                </div>

                {!isSpecialRole && (
                  <>
                    {[
                      { route: 'dashboard', label: 'Customer Dashboard', icon: LayoutDashboard },
                      { route: 'my-orders', label: 'My Orders', icon: ShoppingBag },
                      { route: 'my-bookings', label: 'My Bookings', icon: Calendar },
                      { route: 'profile', label: 'Profile & Settings', icon: UserIcon }
                    ].map(({ route, label, icon: Icon }) => (
                      <button
                        key={route}
                        onClick={() => handleNav(route)}
                        className="w-full text-left px-3 py-3 text-sm font-medium text-stone-700 hover:bg-[var(--brand-soft)] hover:text-stone-900 flex items-center justify-between rounded-xl cursor-pointer min-h-[44px]"
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-amber-700" strokeWidth={1.75} />
                          <span>{label}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-stone-400" />
                      </button>
                    ))}
                  </>
                )}

                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    handleNav('login');
                  }}
                  className="w-full text-left px-3 py-3 text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-3 rounded-xl cursor-pointer font-medium min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            )}

            {/* Unauthenticated Actions on Mobile */}
            {!isAuthenticated && (
              <div className="space-y-4">
                <div>
                  <p className="lux-eyebrow text-amber-700">Guest Account</p>
                  <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                    Login with phone OTP or register to reserve tables and track orders.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleNav('customer-auth')} className="lux-btn lux-btn-gold w-full !px-3">
                    Customer Login
                  </button>
                  <button onClick={() => handleNav('customer-register')} className="lux-btn lux-btn-outline w-full !px-3">
                    Register
                  </button>
                </div>

                {/* Staff Login Flow on Mobile */}
                <button
                  onClick={() => handleNav('staff-login')}
                  className="w-full py-3 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-stone-700 hover:text-stone-900 hover:border-[var(--brand-border)] flex items-center justify-between cursor-pointer min-h-[44px] transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-amber-700" />
                    <span className="text-left">
                      <span className="font-semibold block text-xs">Login as Staff</span>
                      <span className="text-[10px] text-stone-500 block leading-tight">Admin, Kitchen & Delivery portal</span>
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </button>
              </div>
            )}

            {!isSpecialRole && (
              <button onClick={handleBookTableClick} className="lux-btn lux-btn-wine w-full">
                <UtensilsCrossed className="w-4 h-4" />
                Reserve a Table
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
