/**
 * Browser URL Routing & Deep Linking Engine for ABC Hotel
 * Synchronizes browser history (URL address bar, back/forward buttons, direct links)
 * with the internal application view state.
 */

export interface RouteMatch {
  route: string;
  state: any;
}

/**
 * Convert any browser URL pathname and search query into canonical route and state
 */
export function parseUrlToRoute(pathname = window.location.pathname, search = window.location.search): RouteMatch {
  // Normalize path by stripping trailing slashes
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  
  // Extract query parameters
  const searchParams = new URLSearchParams(search);
  const stateFromQuery: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    stateFromQuery[key] = value;
  });

  // 1. Invoice public view: /invoice/view/:token or /invoice/:token
  if (cleanPath.startsWith('/invoice/view/')) {
    const token = cleanPath.replace('/invoice/view/', '').trim();
    return { route: 'invoice-public', state: { ...stateFromQuery, token } };
  }
  if (cleanPath.startsWith('/invoice/')) {
    const token = cleanPath.replace('/invoice/', '').trim();
    return { route: 'invoice-public', state: { ...stateFromQuery, token } };
  }

  // 2. Order status with ID: /order-status/:id or /order/:id or /orders/:id
  const orderStatusMatch = cleanPath.match(/^\/(?:order-status|orders|order)\/([^/]+)$/);
  if (orderStatusMatch && orderStatusMatch[1]) {
    return {
      route: 'order-status',
      state: { ...stateFromQuery, orderId: decodeURIComponent(orderStatusMatch[1]) }
    };
  }

  // 3. Admin subroutes: /admin/*, /manager/*, /operations/*
  if (cleanPath.startsWith('/admin') || cleanPath.startsWith('/manager') || cleanPath.startsWith('/operations')) {
    const subPath = cleanPath.replace(/^\/(?:admin|manager|operations)/, '').replace(/^\/+/, '').toLowerCase();
    let tab: string | undefined = undefined;

    if (stateFromQuery.tab) {
      const qTab = stateFromQuery.tab.toLowerCase();
      if (qTab === 'reservations' || qTab === 'bookings' || qTab === 'booking') tab = 'BOOKINGS';
      else if (qTab === 'orders' || qTab === 'order') tab = 'ORDERS';
      else if (qTab === 'pos' || qTab === 'pos_order' || qTab === 'pos-order' || qTab === 'take-order') tab = 'POS_ORDER';
      else if (qTab === 'dashboard' || qTab === 'dash') tab = 'DASHBOARD';
      else if (qTab === 'tables' || qTab === 'table' || qTab === 'qr' || qTab === 'table-qr') tab = 'TABLES';
      else if (qTab === 'menu' || qTab === 'menu-items' || qTab === 'dishes') tab = 'MENU';
      else if (qTab === 'categories' || qTab === 'category') tab = 'CATEGORIES';
      else if (qTab === 'inventory' || qTab === 'stock') tab = 'INVENTORY';
      else if (qTab === 'employees' || qTab === 'staff' || qTab === 'users') tab = 'EMPLOYEES';
      else if (qTab === 'billing') tab = 'BILLING';
      else if (qTab === 'billing-settings' || qTab === 'billingsettings') tab = 'BILLING_SETTINGS';
      else if (qTab === 'billing-reports' || qTab === 'reports' || qTab === 'report') tab = 'BILLING_REPORTS';
      else if (qTab === 'payments' || qTab === 'payment') tab = 'PAYMENTS';
      else if (qTab === 'payment-settings' || qTab === 'paymentsettings') tab = 'PAYMENT_SETTINGS';
      else if (qTab === 'kds' || qTab === 'kitchen' || qTab === 'kitchen-kds') tab = 'KITCHEN_KDS';
      else if (qTab === 'delivery' || qTab === 'delivery-portal' || qTab === 'rider') tab = 'DELIVERY_PORTAL';
    }

    if (!tab && subPath) {
      if (subPath === 'reservations' || subPath === 'bookings' || subPath === 'table-reservations') {
        tab = 'BOOKINGS';
      } else if (subPath === 'orders' || subPath === 'view-orders' || subPath === 'all-orders') {
        tab = 'ORDERS';
      } else if (subPath === 'pos' || subPath === 'take-order' || subPath === 'pos-order' || subPath === 'takeorder') {
        tab = 'POS_ORDER';
      } else if (subPath === 'dashboard' || subPath === 'overview') {
        tab = 'DASHBOARD';
      } else if (subPath === 'tables' || subPath === 'table-qr' || subPath === 'qr' || subPath === 'qr-config') {
        tab = 'TABLES';
      } else if (subPath === 'menu' || subPath === 'menu-items' || subPath === 'dishes') {
        tab = 'MENU';
      } else if (subPath === 'categories' || subPath === 'category') {
        tab = 'CATEGORIES';
      } else if (subPath === 'inventory' || subPath === 'stock') {
        tab = 'INVENTORY';
      } else if (subPath === 'employees' || subPath === 'staff' || subPath === 'users') {
        tab = 'EMPLOYEES';
      } else if (subPath === 'billing' || subPath === 'invoices') {
        tab = 'BILLING';
      } else if (subPath === 'billing-settings' || subPath === 'billingsettings') {
        tab = 'BILLING_SETTINGS';
      } else if (subPath === 'billing-reports' || subPath === 'reports' || subPath === 'financial-reports') {
        tab = 'BILLING_REPORTS';
      } else if (subPath === 'payments' || subPath === 'payments-audit') {
        tab = 'PAYMENTS';
      } else if (subPath === 'payment-settings' || subPath === 'paymentsettings') {
        tab = 'PAYMENT_SETTINGS';
      } else if (subPath === 'kds' || subPath === 'kitchen' || subPath === 'kitchen-kds') {
        tab = 'KITCHEN_KDS';
      } else if (subPath === 'delivery' || subPath === 'delivery-portal') {
        tab = 'DELIVERY_PORTAL';
      }
    }

    return { route: 'admin', state: { ...stateFromQuery, ...(tab ? { tab } : {}) } };
  }

  // 4. Exact route path mappings (supports standard names and canonical aliases)
  switch (cleanPath) {
    case '':
    case '/':
    case '/home':
      return { route: 'home', state: stateFromQuery };

    case '/login':
    case '/customer-auth':
    case '/customerlogin':
    case '/signin':
      return {
        route: 'login',
        state: {
          defaultMode: 'login',
          returnTo: stateFromQuery.returnTo,
          message: stateFromQuery.message,
          ...stateFromQuery
        }
      };

    case '/register':
    case '/customer-register':
    case '/customer-signup':
    case '/signup':
      return {
        route: 'register',
        state: {
          defaultMode: 'register',
          returnTo: stateFromQuery.returnTo,
          message: stateFromQuery.message,
          ...stateFromQuery
        }
      };

    case '/stafflogin':
    case '/staff-login':
    case '/employee-login':
    case '/staff':
      return { route: 'staff-login', state: stateFromQuery };

    case '/menu':
    case '/food-menu':
    case '/dishes':
      return { route: 'menu', state: stateFromQuery };

    case '/orders':
    case '/my-orders':
    case '/order-history':
      return { route: 'my-orders', state: stateFromQuery };

    case '/order-status':
      return {
        route: 'order-status',
        state: {
          orderId: stateFromQuery.orderId || stateFromQuery.id,
          ...stateFromQuery
        }
      };

    case '/bookings':
    case '/my-bookings':
    case '/reservations':
      return { route: 'my-bookings', state: stateFromQuery };

    case '/book-table':
    case '/booktable':
    case '/reserve':
    case '/table-booking':
      return { route: 'book-table', state: stateFromQuery };

    case '/cart':
      return { route: 'cart', state: stateFromQuery };

    case '/checkout':
      return { route: 'checkout', state: stateFromQuery };

    case '/dashboard':
    case '/account':
      return { route: 'dashboard', state: stateFromQuery };

    case '/profile':
      return { route: 'profile', state: stateFromQuery };

    case '/admin':
    case '/manager':
    case '/operations':
      return { route: 'admin', state: stateFromQuery };

    case '/kitchen':
    case '/kds':
      return { route: 'kitchen', state: stateFromQuery };

    case '/delivery':
    case '/rider':
      return { route: 'delivery', state: stateFromQuery };

    case '/api-docs':
    case '/swagger':
      return { route: 'api-docs', state: stateFromQuery };

    case '/system-docs':
    case '/docs':
      return { route: 'system-docs', state: stateFromQuery };

    case '/system-tests':
    case '/tests':
      return { route: 'system-tests', state: stateFromQuery };

    default:
      return { route: 'home', state: stateFromQuery };
  }
}

/**
 * Convert internal route name and optional state into a browser URL pathname and search query
 */
export function routeToUrl(route: string, state?: any): string {
  switch (route) {
    case 'home':
      return '/';

    case 'menu':
      return '/menu';

    case 'login':
    case 'customer-auth': {
      const params = new URLSearchParams();
      if (state?.returnTo) params.set('returnTo', state.returnTo);
      if (state?.message) params.set('message', state.message);
      const query = params.toString();
      return query ? `/login?${query}` : '/login';
    }

    case 'register':
    case 'customer-register':
    case 'customer-signup': {
      const params = new URLSearchParams();
      if (state?.returnTo) params.set('returnTo', state.returnTo);
      if (state?.message) params.set('message', state.message);
      const query = params.toString();
      return query ? `/register?${query}` : '/register';
    }

    case 'staff-login':
    case 'stafflogin':
      return '/stafflogin';

    case 'my-orders':
    case 'orders':
      return '/orders';

    case 'my-bookings':
    case 'bookings':
      return '/bookings';

    case 'book-table':
      return '/book-table';

    case 'cart':
      return '/cart';

    case 'checkout':
      return '/checkout';

    case 'order-status':
      if (state?.orderId) {
        return `/order-status/${encodeURIComponent(state.orderId)}`;
      }
      return '/order-status';

    case 'dashboard':
      return '/dashboard';

    case 'profile':
      return '/profile';

    case 'admin': {
      if (state?.tab) {
        const tabUpper = String(state.tab).toUpperCase();
        switch (tabUpper) {
          case 'BOOKINGS':
            return '/admin/reservations';
          case 'ORDERS':
            return '/admin/orders';
          case 'POS_ORDER':
            return '/admin/pos';
          case 'DASHBOARD':
            return '/admin/dashboard';
          case 'TABLES':
            return '/admin/tables';
          case 'MENU':
            return '/admin/menu';
          case 'CATEGORIES':
            return '/admin/categories';
          case 'INVENTORY':
            return '/admin/inventory';
          case 'EMPLOYEES':
            return '/admin/employees';
          case 'BILLING':
            return '/admin/billing';
          case 'BILLING_SETTINGS':
            return '/admin/billing-settings';
          case 'BILLING_REPORTS':
            return '/admin/billing-reports';
          case 'PAYMENTS':
            return '/admin/payments';
          case 'PAYMENT_SETTINGS':
            return '/admin/payment-settings';
          case 'KITCHEN_KDS':
            return '/admin/kds';
          case 'DELIVERY_PORTAL':
            return '/admin/delivery';
        }
      }
      return '/admin';
    }

    case 'kitchen':
      return '/kitchen';

    case 'delivery':
      return '/delivery';

    case 'api-docs':
      return '/api-docs';

    case 'system-docs':
      return '/system-docs';

    case 'system-tests':
      return '/system-tests';

    case 'invoice-public':
      if (state?.token) {
        return `/invoice/view/${encodeURIComponent(state.token)}`;
      }
      return '/invoice/view';

    default:
      return route.startsWith('/') ? route : `/${route}`;
  }
}
