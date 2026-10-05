/**
 * Automated Route Verification Test for ABC Hotel
 * Tests all URL paths, canonical conversions, parameters, and aliases
 */
import { parseUrlToRoute, routeToUrl } from '../src/utils/router.ts';

const testCases = [
  // User specifically requested URLs
  { url: '/login', expectedRoute: 'login', expectedDefaultMode: 'login' },
  { url: '/stafflogin', expectedRoute: 'staff-login' },
  { url: '/staff-login', expectedRoute: 'staff-login' },
  { url: '/menu', expectedRoute: 'menu' },
  { url: '/orders', expectedRoute: 'my-orders' },
  { url: '/my-orders', expectedRoute: 'my-orders' },
  
  // Registration
  { url: '/register', expectedRoute: 'register', expectedDefaultMode: 'register' },
  { url: '/customer-register', expectedRoute: 'register', expectedDefaultMode: 'register' },
  { url: '/signup', expectedRoute: 'register', expectedDefaultMode: 'register' },
  
  // Booking & Table
  { url: '/book-table', expectedRoute: 'book-table' },
  { url: '/booktable', expectedRoute: 'book-table' },
  { url: '/bookings', expectedRoute: 'my-bookings' },
  { url: '/my-bookings', expectedRoute: 'my-bookings' },
  
  // Cart & Checkout
  { url: '/cart', expectedRoute: 'cart' },
  { url: '/checkout', expectedRoute: 'checkout' },
  
  // Customer Profile & Dashboard
  { url: '/dashboard', expectedRoute: 'dashboard' },
  { url: '/profile', expectedRoute: 'profile' },
  
  // Portals & Systems
  { url: '/admin', expectedRoute: 'admin' },
  { url: '/kitchen', expectedRoute: 'kitchen' },
  { url: '/delivery', expectedRoute: 'delivery' },
  { url: '/api-docs', expectedRoute: 'api-docs' },
  { url: '/system-docs', expectedRoute: 'system-docs' },
  { url: '/system-tests', expectedRoute: 'system-tests' },
  
  // Home
  { url: '/', expectedRoute: 'home' },
  { url: '/home', expectedRoute: 'home' },
  
  // Deep Links with Params
  { 
    url: '/login', 
    search: '?returnTo=book-table&message=Please+login+to+book', 
    expectedRoute: 'login', 
    expectedReturnTo: 'book-table' 
  },
  {
    url: '/order-status/ord_demo_987',
    expectedRoute: 'order-status',
    expectedOrderId: 'ord_demo_987'
  },
  {
    url: '/invoice/view/inv_tok_456',
    expectedRoute: 'invoice-public',
    expectedToken: 'inv_tok_456'
  }
];

let failed = 0;
console.log('--- RUNNING URL ROUTE VERIFICATION ---');

for (const tc of testCases) {
  const match = parseUrlToRoute(tc.url, tc.search || '');
  if (match.route !== tc.expectedRoute) {
    console.error(`FAILED: ${tc.url} -> expected route ${tc.expectedRoute}, got ${match.route}`);
    failed++;
    continue;
  }
  if (tc.expectedDefaultMode && match.state?.defaultMode !== tc.expectedDefaultMode) {
    console.error(`FAILED: ${tc.url} -> expected defaultMode ${tc.expectedDefaultMode}, got ${match.state?.defaultMode}`);
    failed++;
    continue;
  }
  if (tc.expectedReturnTo && match.state?.returnTo !== tc.expectedReturnTo) {
    console.error(`FAILED: ${tc.url} -> expected returnTo ${tc.expectedReturnTo}, got ${match.state?.returnTo}`);
    failed++;
    continue;
  }
  if (tc.expectedOrderId && match.state?.orderId !== tc.expectedOrderId) {
    console.error(`FAILED: ${tc.url} -> expected orderId ${tc.expectedOrderId}, got ${match.state?.orderId}`);
    failed++;
    continue;
  }
  if (tc.expectedToken && match.state?.token !== tc.expectedToken) {
    console.error(`FAILED: ${tc.url} -> expected token ${tc.expectedToken}, got ${match.state?.token}`);
    failed++;
    continue;
  }
  console.log(`PASSED: ${tc.url}${tc.search || ''} -> ${match.route}`);
}

// Also test routeToUrl canonical conversions
const canonicalTests = [
  { route: 'home', expectedUrl: '/' },
  { route: 'menu', expectedUrl: '/menu' },
  { route: 'login', expectedUrl: '/login' },
  { route: 'register', expectedUrl: '/register' },
  { route: 'staff-login', expectedUrl: '/stafflogin' },
  { route: 'my-orders', expectedUrl: '/orders' },
  { route: 'orders', expectedUrl: '/orders' },
  { route: 'my-bookings', expectedUrl: '/bookings' },
  { route: 'book-table', expectedUrl: '/book-table' },
  { route: 'cart', expectedUrl: '/cart' },
  { route: 'checkout', expectedUrl: '/checkout' },
  { route: 'admin', expectedUrl: '/admin' },
  { route: 'kitchen', expectedUrl: '/kitchen' },
  { route: 'delivery', expectedUrl: '/delivery' },
  { route: 'order-status', state: { orderId: 'ord_123' }, expectedUrl: '/order-status/ord_123' },
  { route: 'invoice-public', state: { token: 'tok_abc' }, expectedUrl: '/invoice/view/tok_abc' }
];

console.log('--- RUNNING CANONICAL URL GENERATION TESTS ---');
for (const ct of canonicalTests) {
  const url = routeToUrl(ct.route, ct.state);
  if (url !== ct.expectedUrl) {
    console.error(`FAILED: routeToUrl('${ct.route}') -> expected ${ct.expectedUrl}, got ${url}`);
    failed++;
  } else {
    console.log(`PASSED: routeToUrl('${ct.route}') -> ${url}`);
  }
}

if (failed > 0) {
  console.error(`Route verification failed with ${failed} errors.`);
  process.exit(1);
} else {
  console.log('All route tests passed successfully!');
}
