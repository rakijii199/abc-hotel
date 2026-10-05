/**
 * ABC Hotel — Full-Stack Application Client Root
 */
import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { Navbar } from './components/common/Navbar.tsx';
import { Footer } from './components/common/Footer.tsx';
import { parseUrlToRoute, routeToUrl } from './utils/router.ts';

// Pages
import { HomePage } from './pages/HomePage.tsx';
import { MenuPage } from './pages/MenuPage.tsx';
import { BookTablePage } from './pages/BookTablePage.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { OrderStatusPage } from './pages/OrderStatusPage.tsx';
import { MyOrdersPage } from './pages/MyOrdersPage.tsx';
import { MyBookingsPage } from './pages/MyBookingsPage.tsx';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { CustomerAuthPage } from './pages/CustomerAuthPage.tsx';
import { StaffLoginPage } from './pages/StaffLoginPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { KitchenPage } from './pages/KitchenPage.tsx';
import { ApiDocsPage } from './pages/ApiDocsPage.tsx';
import { SystemDocsPage } from './pages/SystemDocsPage.tsx';
import { SystemTestsPage } from './pages/SystemTestsPage.tsx';
import { PublicInvoicePage } from './pages/PublicInvoicePage.tsx';
import { DeliveryPortalPage } from './pages/DeliveryPortalPage.tsx';

function MainApp() {
  const { isAdmin, isKitchen, isManager, isDelivery, user } = useAuth();

  // Initialize route directly from browser URL
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const initial = parseUrlToRoute(window.location.pathname, window.location.search);
    return initial.route;
  });

  const [routeState, setRouteState] = useState<any>(() => {
    const initial = parseUrlToRoute(window.location.pathname, window.location.search);
    return initial.state;
  });

  const navigate = useCallback((route: string, state?: any, replace = false) => {
    setCurrentRoute(route);
    const mergedState = state || {};
    setRouteState(mergedState);

    // Compute canonical browser URL (e.g. /login, /stafflogin, /menu, /orders)
    const targetUrl = routeToUrl(route, mergedState);
    const currentFullUrl = window.location.pathname + window.location.search;

    if (currentFullUrl !== targetUrl) {
      if (replace) {
        window.history.replaceState({ route, state: mergedState }, '', targetUrl);
      } else {
        window.history.pushState({ route, state: mergedState }, '', targetUrl);
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen for browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const match = parseUrlToRoute(window.location.pathname, window.location.search);
      setCurrentRoute(match.route);
      setRouteState(match.state);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Ensure current URL matches canonical format on initial mount
  useEffect(() => {
    const match = parseUrlToRoute(window.location.pathname, window.location.search);
    const canonical = routeToUrl(match.route, match.state);
    const current = window.location.pathname + window.location.search;
    if (current !== canonical && window.location.pathname !== '/') {
      window.history.replaceState({ route: match.route, state: match.state }, '', canonical);
    }
  }, []);

  // Default to role-specific route on initial login or route access
  useEffect(() => {
    const hasAccessToAdmin = isAdmin || isManager;
    if (isDelivery) {
      // Delivery staff should ONLY access the delivery dispatch portal
      if (currentRoute === 'home' || currentRoute === 'dashboard' || currentRoute === 'my-orders' || currentRoute === 'orders' || currentRoute === 'my-bookings' || currentRoute === 'bookings' || currentRoute === 'admin' || currentRoute === 'kitchen' || currentRoute === 'cart' || currentRoute === 'checkout') {
        navigate('delivery', {}, true);
      }
    } else if (isKitchen) {
      // Kitchen department should ONLY access the kitchen KDS view
      if (currentRoute === 'home' || currentRoute === 'dashboard' || currentRoute === 'my-orders' || currentRoute === 'orders' || currentRoute === 'my-bookings' || currentRoute === 'bookings' || currentRoute === 'admin' || currentRoute === 'delivery' || currentRoute === 'cart' || currentRoute === 'checkout') {
        navigate('kitchen', {}, true);
      }
    } else if (hasAccessToAdmin) {
      if (currentRoute === 'home') {
        navigate('admin', {}, true);
      }
    } else {
      // Customer / Guest attempting to access internal staff portals
      if (currentRoute === 'admin' || currentRoute === 'kitchen' || currentRoute === 'delivery') {
        navigate('staff-login', { message: 'Please login with authorized employee credentials.' }, true);
      }
    }
  }, [isAdmin, isKitchen, isManager, isDelivery, currentRoute, navigate]);

  const renderRoute = () => {
    switch (currentRoute) {
      case 'home':
        return <HomePage navigate={navigate} />;
      case 'menu':
        return <MenuPage navigate={navigate} />;
      case 'book-table':
        return <BookTablePage navigate={navigate} />;
      case 'cart':
        return <CartPage navigate={navigate} />;
      case 'checkout':
        return <CheckoutPage navigate={navigate} />;
      case 'order-status':
        return <OrderStatusPage orderId={routeState?.orderId} navigate={navigate} />;
      case 'my-orders':
      case 'orders':
        return <MyOrdersPage navigate={navigate} />;
      case 'my-bookings':
      case 'bookings':
        return <MyBookingsPage navigate={navigate} />;
      case 'dashboard':
        return <CustomerDashboardPage navigate={navigate} />;
      case 'profile':
        return <ProfilePage navigate={navigate} />;
      case 'login':
      case 'customer-auth':
        return (
          <CustomerAuthPage
            navigate={navigate}
            defaultMode="login"
            returnTo={routeState?.returnTo}
            message={routeState?.message}
          />
        );
      case 'register':
      case 'customer-register':
      case 'customer-signup':
        return (
          <CustomerAuthPage
            navigate={navigate}
            defaultMode="register"
            returnTo={routeState?.returnTo}
            message={routeState?.message}
          />
        );
      case 'staff-login':
      case 'stafflogin':
        return <StaffLoginPage navigate={navigate} />;
      case 'admin':
        return <AdminDashboardPage navigate={navigate} />;
      case 'kitchen':
        return <KitchenPage navigate={navigate} />;
      case 'delivery':
        return <DeliveryPortalPage navigate={navigate} />;
      case 'api-docs':
        return <ApiDocsPage />;
      case 'system-docs':
        return <SystemDocsPage />;
      case 'system-tests':
        return <SystemTestsPage />;
      case 'invoice-public':
        return <PublicInvoicePage token={routeState?.token} navigate={navigate} />;
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  // Dedicated Kitchen Department Display
  if (currentRoute === 'kitchen') {
    return (
      <main className="animate-in fade-in duration-200">
        <KitchenPage navigate={navigate} />
      </main>
    );
  }

  // Full-screen dedicated Delivery Portal
  if (currentRoute === 'delivery') {
    return (
      <main className="animate-in fade-in duration-200">
        <DeliveryPortalPage navigate={navigate} />
      </main>
    );
  }

  // Full-screen dedicated Operations Suite view when on admin route
  if (currentRoute === 'admin') {
    return (
      <div className="h-screen w-full overflow-hidden bg-stone-100 text-stone-900 selection:bg-purple-200 selection:text-purple-900">
        <AdminDashboardPage navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#faf8f5] text-stone-900 selection:bg-amber-100 selection:text-amber-900">
      <div>
        {(isAdmin || isManager) && (
          <div className="bg-purple-950 text-purple-200 px-4 py-2 text-xs flex items-center justify-between border-b border-purple-800/60 sticky top-0 z-50">
            <span className="font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Logged in as {isAdmin ? 'Staff Administrator' : 'Hotel Manager'} (Previewing Website)
            </span>
            <button
              onClick={() => navigate('admin')}
              className="bg-purple-800 hover:bg-purple-700 text-white px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              ← Back to Operations Suite
            </button>
          </div>
        )}
        <Navbar currentRoute={currentRoute} navigate={navigate} />
        <main className="animate-in fade-in duration-300">
          {renderRoute()}
        </main>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}
