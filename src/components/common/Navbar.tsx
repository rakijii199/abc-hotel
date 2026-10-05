/**
 * Primary Navigation Bar for ABC Hotel
 * Differentiates Customer, Staff Admin, Hotel Manager, Kitchen, and Delivery Rider workflows
 */
import React, { useState } from 'react';
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
  LayoutDashboard,
  ChefHat,
  Truck
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

  const isStaffOrManager = isAdmin || isManager;
  const isSpecialRole = isStaffOrManager || isKitchen || isDelivery;

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

  return (
    <header className="sticky top-0 z-40 bg-[#faf8f5]/95 backdrop-blur-md border-b border-amber-900/10 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo */}
          <div
            onClick={() => handleNav(getRoleLandingRoute())}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 flex items-center justify-center text-amber-100 shadow-md group-hover:scale-105 transition-transform">
              <span className="font-serif font-bold text-base sm:text-xl tracking-wider text-amber-200">ABC</span>
            </div>
            <div>
              <span className="font-serif font-bold text-base sm:text-xl tracking-tight text-stone-900 block leading-tight">
                ABC HOTEL
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-[0.18em] uppercase font-semibold text-amber-800 block">
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
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {!isSpecialRole ? (
              // Customer Navigation Links ONLY
              <>
                <button
                  onClick={() => handleNav('home')}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                    currentRoute === 'home'
                      ? 'text-amber-900 bg-amber-100/70 font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => handleNav('menu')}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    currentRoute === 'menu'
                      ? 'text-amber-900 bg-amber-100/70 font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                  Menu
                </button>
                <button
                  onClick={handleBookTableClick}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    currentRoute === 'book-table'
                      ? 'text-amber-900 bg-amber-100/70 font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-amber-700" />
                  Book a Table
                </button>

                {isAuthenticated && (
                  <>
                    <button
                      onClick={() => handleNav('orders')}
                      className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                        currentRoute === 'my-orders' || currentRoute === 'orders'
                          ? 'text-amber-900 bg-amber-100/70 font-semibold'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                      }`}
                    >
                      My Orders
                    </button>
                    <button
                      onClick={() => handleNav('bookings')}
                      className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                        currentRoute === 'my-bookings' || currentRoute === 'bookings'
                          ? 'text-amber-900 bg-amber-100/70 font-semibold'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                      }`}
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
                className="px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-amber-950 bg-amber-100 border border-amber-300 shadow-xs"
              >
                <Truck className="w-4 h-4 text-amber-700" />
                Delivery Dispatch Board
              </button>
            ) : isKitchen ? (
              // Kitchen link
              <button
                onClick={() => handleNav('kitchen')}
                className="px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-orange-950 bg-orange-100 border border-orange-300 shadow-xs"
              >
                <ChefHat className="w-4 h-4 text-orange-700" />
                Kitchen Display System
              </button>
            ) : (
              // Staff Admin / Manager link
              <button
                onClick={() => handleNav('admin')}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  currentRoute === 'admin'
                    ? 'text-purple-950 bg-purple-100 border border-purple-300 shadow-xs'
                    : 'text-purple-800 hover:text-purple-950 hover:bg-purple-50'
                }`}
              >
                <Shield className="w-4 h-4 text-purple-700" />
                {isManager ? 'Hotel Manager Suite' : 'Staff Operations Suite'}
              </button>
            )}
          </nav>

          {/* Right Action Icons & User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Customer Cart Button (Hidden for all internal staff) */}
            {!isSpecialRole && (
              <button
                onClick={() => handleNav('cart')}
                className="relative p-2 sm:p-2.5 text-stone-700 hover:text-amber-900 hover:bg-amber-100/60 rounded-xl transition-all cursor-pointer"
                aria-label="Shopping Cart"
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-700 text-white text-[10px] sm:text-[11px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-xs">
                    {itemCount}
                  </span>
                )}
              </button>
            )}

            {/* User Dropdown or Login CTA (Desktop) */}
            {isAuthenticated && user ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pl-3 rounded-full bg-stone-100 hover:bg-amber-100/50 border border-stone-200 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-semibold text-stone-800 max-w-[100px] truncate">
                    {user.firstName}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs ${
                      isStaffOrManager
                        ? 'bg-gradient-to-tr from-purple-800 to-indigo-600'
                        : isKitchen
                        ? 'bg-gradient-to-tr from-orange-600 to-amber-600'
                        : isDelivery
                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-700'
                        : 'bg-gradient-to-tr from-amber-700 to-amber-500'
                    }`}
                  >
                    {user.firstName[0]}
                  </div>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-stone-200 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2.5 border-b border-stone-100">
                      <p className="text-xs text-stone-500">Logged in as</p>
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <span
                        className={`inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          isStaffOrManager
                            ? 'bg-purple-100 text-purple-800'
                            : isKitchen
                            ? 'bg-orange-100 text-orange-800'
                            : isDelivery
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>

                    {isDelivery ? (
                      // Delivery Rider menu
                      <button
                        onClick={() => handleNav('delivery')}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Truck className="w-4 h-4 text-emerald-700" />
                        Delivery Dispatch Board
                      </button>
                    ) : isKitchen ? (
                      // Kitchen menu
                      <button
                        onClick={() => handleNav('kitchen')}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <ChefHat className="w-4 h-4 text-orange-700" />
                        Kitchen Display System
                      </button>
                    ) : isStaffOrManager ? (
                      // Staff Admin & Manager menu
                      <button
                        onClick={() => handleNav('admin')}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4 text-purple-700" />
                        Operations Suite
                      </button>
                    ) : (
                      // Customer account menu items
                      <>
                        <button
                          onClick={() => handleNav('dashboard')}
                          className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-amber-700" />
                          Dashboard
                        </button>
                        <button
                          onClick={() => handleNav('profile')}
                          className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-stone-500" />
                          Profile & Settings
                        </button>
                        <button
                          onClick={() => handleNav('my-orders')}
                          className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <ShoppingBag className="w-4 h-4 text-stone-500" />
                          My Orders
                        </button>
                        <button
                          onClick={() => handleNav('my-bookings')}
                          className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-amber-50 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Calendar className="w-4 h-4 text-stone-500" />
                          My Bookings
                        </button>
                      </>
                    )}

                    <div className="border-t border-stone-100 mt-1">
                      <button
                        onClick={() => {
                          logout();
                          setUserDropdownOpen(false);
                          handleNav('login');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-medium cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => handleNav('customer-auth')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Customer Login</span>
                </button>
                <button
                  onClick={() => handleNav('customer-register')}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors cursor-pointer"
                >
                  <span>Register</span>
                </button>
                <button
                  onClick={() => handleNav('staff-login')}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-stone-600" />
                  <span>Login as Staff</span>
                </button>
              </div>
            )}

            {/* Mobile Header Quick User Access / Login */}
            {isAuthenticated && user ? (
              <button
                onClick={() => handleNav(isSpecialRole ? getRoleLandingRoute() : 'dashboard')}
                className={`md:hidden w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs cursor-pointer ${
                  isStaffOrManager
                    ? 'bg-gradient-to-tr from-purple-800 to-indigo-600'
                    : isKitchen
                    ? 'bg-gradient-to-tr from-orange-600 to-amber-600'
                    : isDelivery
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-700'
                    : 'bg-gradient-to-tr from-amber-700 to-amber-500'
                }`}
                aria-label="User Account"
                title={`${user.firstName} (${user.role})`}
              >
                {user.firstName[0]}
              </button>
            ) : (
              <button
                onClick={() => handleNav('customer-auth')}
                className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300/80 transition-colors cursor-pointer"
                aria-label="Customer Login"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-800" />
                <span>Login</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-stone-700 hover:bg-stone-100 active:bg-stone-200 rounded-xl transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-amber-900" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 sm:top-20 bg-[#faf8f5] border-b border-stone-200 shadow-2xl z-50 max-h-[calc(100vh-4rem)] overflow-y-auto pb-8 animate-in slide-in-from-top duration-200">
          <div className="p-4 space-y-4">
            {/* Navigation Links */}
            <div className="space-y-1 bg-white rounded-2xl border border-stone-200/80 p-2 shadow-xs">
              {!isSpecialRole ? (
                // Customer mobile links
                <>
                  <button
                    onClick={() => handleNav('home')}
                    className={`w-full text-left px-4 py-3 text-sm font-medium rounded-xl flex items-center justify-between cursor-pointer ${
                      currentRoute === 'home' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    <span>Home Overview</span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                  <button
                    onClick={() => handleNav('menu')}
                    className={`w-full text-left px-4 py-3 text-sm font-medium rounded-xl flex items-center justify-between cursor-pointer ${
                      currentRoute === 'menu' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                      <span>Gourmet Menu</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                  <button
                    onClick={handleBookTableClick}
                    className={`w-full text-left px-4 py-3 text-sm font-medium rounded-xl flex items-center justify-between cursor-pointer ${
                      currentRoute === 'book-table' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-amber-700" />
                      <span>Reserve a Table</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                  <button
                    onClick={() => handleNav('cart')}
                    className={`w-full text-left px-4 py-3 text-sm font-medium rounded-xl flex items-center justify-between cursor-pointer ${
                      currentRoute === 'cart' ? 'bg-amber-50 text-amber-900 font-bold' : 'text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShoppingBag className="w-4 h-4 text-amber-700" />
                      <span>Shopping Cart ({itemCount})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
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
                  className="w-full text-left px-4 py-3.5 text-sm font-bold text-orange-950 bg-orange-50 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ChefHat className="w-5 h-5 text-orange-700" />
                    <span>Kitchen Display System</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-orange-500" />
                </button>
              ) : (
                // Staff Admin / Manager mobile link
                <button
                  onClick={() => handleNav('admin')}
                  className="w-full text-left px-4 py-3.5 text-sm font-bold text-purple-900 bg-purple-50 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-purple-700" />
                    <span>{isAdmin ? 'Staff Operations Suite' : 'Hotel Manager Suite'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-500" />
                </button>
              )}
            </div>

            {/* Authenticated Actions on Mobile */}
            {isAuthenticated && user && (
              <div className="space-y-1 bg-white rounded-2xl border border-stone-200/80 p-2 shadow-xs">
                <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500">Logged in as</p>
                    <p className="text-sm font-bold text-stone-900">
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                      isStaffOrManager
                        ? 'bg-purple-100 text-purple-800'
                        : isKitchen
                        ? 'bg-orange-100 text-orange-800'
                        : isDelivery
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>

                {!isSpecialRole && (
                  <>
                    <button
                      onClick={() => handleNav('dashboard')}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-between rounded-xl cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserIcon className="w-4 h-4 text-amber-700" />
                        <span>Customer Dashboard</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>
                    <button
                      onClick={() => handleNav('my-orders')}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-between rounded-xl cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShoppingBag className="w-4 h-4 text-stone-500" />
                        <span>My Orders</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>
                    <button
                      onClick={() => handleNav('my-bookings')}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-between rounded-xl cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-stone-500" />
                        <span>My Bookings</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>
                    <button
                      onClick={() => handleNav('profile')}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 flex items-center justify-between rounded-xl cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserIcon className="w-4 h-4 text-stone-500" />
                        <span>Profile & Settings</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    handleNav('login');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 flex items-center justify-between rounded-xl cursor-pointer font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </div>
                </button>
              </div>
            )}

            {/* Unauthenticated Actions on Mobile */}
            {!isAuthenticated && (
              <div className="space-y-3 bg-white rounded-2xl border border-stone-200/80 p-3.5 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                      Customer Dining Account
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Login with phone OTP or register to reserve tables and track orders.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleNav('customer-auth')}
                    className="w-full py-3 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                  >
                    <UserIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Customer Login</span>
                  </button>

                  <button
                    onClick={() => handleNav('customer-register')}
                    className="w-full py-3 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                  >
                    <span>Register</span>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-700" />
                  </button>
                </div>

                {/* Staff Login Flow on Mobile */}
                <div className="pt-2 border-t border-stone-100">
                  <button
                    onClick={() => handleNav('staff-login')}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-stone-50 hover:bg-stone-100 active:bg-stone-200 text-stone-800 border border-stone-200 font-semibold text-xs flex items-center justify-between cursor-pointer min-h-[44px] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <span className="font-bold block text-stone-900 text-xs">Login as Staff</span>
                        <span className="text-[10px] text-stone-500 block leading-tight">Admin, Kitchen & Delivery portal</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
