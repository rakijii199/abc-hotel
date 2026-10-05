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

  // 3. Exact route path mappings (supports standard names and canonical aliases)
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

    case 'admin':
      return '/admin';

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
