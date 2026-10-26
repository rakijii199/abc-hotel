/**
 * ABC Hotel — Full-Stack Application Client Root
 */
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { Navbar } from './components/common/Navbar.tsx';
import { Footer } from './components/common/Footer.tsx';
import { parseUrlToRoute, routeToUrl } from './utils/router.ts';
import { isStaffRole } from '../shared/accessControl.ts';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';

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
import { StaffLoginPage } from './pages/StaffLoginPage.tsx';

// Staff dashboards, docs, the public invoice and the Firebase-backed sign-in
// page load on demand, keeping them out of the bundle every visitor downloads.
const CustomerAuthPage = lazy(() => import('./pages/CustomerAuthPage.tsx').then((m) => ({ default: m.CustomerAuthPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.tsx').then((m) => ({ default: m.AdminDashboardPage })));
const KitchenPage = lazy(() => import('./pages/KitchenPage.tsx').then((m) => ({ default: m.KitchenPage })));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage.tsx').then((m) => ({ default: m.ApiDocsPage })));
const SystemDocsPage = lazy(() => import('./pages/SystemDocsPage.tsx').then((m) => ({ default: m.SystemDocsPage })));
const SystemTestsPage = lazy(() => import('./pages/SystemTestsPage.tsx').then((m) => ({ default: m.SystemTestsPage })));
const PublicInvoicePage = lazy(() => import('./pages/PublicInvoicePage.tsx').then((m) => ({ default: m.PublicInvoicePage })));
const DeliveryPortalPage = lazy(() => import('./pages/DeliveryPortalPage.tsx').then((m) => ({ default: m.DeliveryPortalPage })));

const PageLoader: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
    <span className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-amber-600 animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading…</span>
  </div>
);

function MainApp() {
  const { isAdmin, isKitchen, isManager, isDelivery, user, isLoading, can } = useAuth();

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
    // Wait for the stored session to be restored; otherwise reloading a staff
    // page sees "no user" and bounces to the login screen.
    if (isLoading) return;
    const isStaffUser = isStaffRole(user?.role);
    if (!isStaffUser) {
      // Customer / guest attempting to open an internal staff portal
      if (currentRoute === 'admin' || currentRoute === 'kitchen' || currentRoute === 'delivery') {
        navigate('staff-login', { message: 'Please login with authorized employee credentials.' }, true);
      }
      return;
    }

    // Staff: portals open according to resolved section access (same rules as the API).
    const canAdmin = Object.values(user?.access || {}).some((level) => level !== 'NONE');
    const canKitchen = can('KITCHEN');
    const canDelivery = can('DELIVERY');
    const homePortal =
      isDelivery && canDelivery ? 'delivery'
      : isKitchen && canKitchen ? 'kitchen'
      : canAdmin ? 'admin'
      : null;
    const customerRoutes = ['home', 'dashboard', 'my-orders', 'orders', 'my-bookings', 'bookings', 'cart', 'checkout'];

    if (!homePortal) {
      if (currentRoute === 'admin' || currentRoute === 'kitchen' || currentRoute === 'delivery') {
        navigate('staff-login', { message: 'Your account has no access yet. Please contact a Super Admin.' }, true);
      }
      return;
    }
    const blocked =
      (currentRoute === 'admin' && !canAdmin) ||
      (currentRoute === 'kitchen' && !canKitchen) ||
      (currentRoute === 'delivery' && !canDelivery);
    if (blocked) {
      navigate(homePortal, {}, true);
    } else if ((isDelivery || isKitchen) && customerRoutes.includes(currentRoute)) {
      // Kitchen and delivery staff land on their own portal
      navigate(homePortal, {}, true);
    } else if (currentRoute === 'home') {
      navigate(homePortal, {}, true);
    }
  }, [user?.id, user?.access, isKitchen, isDelivery, isLoading, currentRoute, navigate]);

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
        return <AdminDashboardPage navigate={navigate} initialTab={routeState?.tab} />;
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
      <main className="lux-ops animate-in fade-in duration-200">
        <Suspense fallback={<PageLoader />}>
          <KitchenPage navigate={navigate} />
        </Suspense>
      </main>
    );
  }

  // Full-screen dedicated Delivery Portal
  if (currentRoute === 'delivery') {
    return (
      <main className="lux-ops animate-in fade-in duration-200">
        <Suspense fallback={<PageLoader />}>
          <DeliveryPortalPage navigate={navigate} />
        </Suspense>
      </main>
    );
  }

  // Full-screen dedicated Operations Suite view when on admin route
  if (currentRoute === 'admin') {
    return (
      <div className="lux-ops ambient-staff h-screen w-full overflow-hidden text-stone-900">
        <Suspense fallback={<PageLoader />}>
          <AdminDashboardPage navigate={navigate} initialTab={routeState?.tab} />
        </Suspense>
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
    <div className="lux min-h-screen flex flex-col justify-between overflow-x-clip">
      <div>
        {(isAdmin || isManager) && (
          <div className="bg-amber-50 text-amber-900 px-4 py-2 text-xs flex items-center justify-between border-b border-amber-200 sticky top-0 z-50">
            <span className="font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Logged in as {isAdmin ? 'Staff Administrator' : 'Hotel Manager'} (Previewing Website)
            </span>
            <button
              onClick={() => navigate('admin')}
              className="btn btn-primary !min-h-8 !px-3 !text-xs"
            >
              ← Back to Operations Suite
            </button>
          </div>
        )}
        <Navbar currentRoute={currentRoute} navigate={navigate} />
        <main className="animate-in fade-in duration-300">
          <Suspense fallback={<PageLoader />}>{renderRoute()}</Suspense>
        </main>
      </div>
      <Footer navigate={navigate} />
    </div>
    </MotionConfig>
    </LazyMotion>
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
