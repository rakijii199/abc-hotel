/**
 * Automated Production Security Attack Simulation & Audit Suite
 */
import { AuthService } from '../server/services/authService.ts';
import { db } from '../server/database/db.ts';

const PORT = process.env.PORT || 8080;
const BASE_URL = `http://localhost:${PORT}`;

async function runSecurityAudit() {
  console.log('--- STARTING PRODUCTION SECURITY ATTACK SIMULATION ---');
  let passed = 0;
  let failed = 0;

  await db.initialize();

  // 1. Verify Invalid API route returns JSON 404 (NEVER index.html)
  try {
    const res = await fetch(`${BASE_URL}/api/non_existent_route_12345`);
    const contentType = res.headers.get('content-type') || '';
    const body = await res.json();
    if (res.status === 404 && contentType.includes('application/json') && body.error?.code === 'API_ROUTE_NOT_FOUND') {
      console.log('✅ PASS: Invalid /api/* route returns JSON 404 error (not HTML).');
      passed++;
    } else {
      console.error('❌ FAIL: Invalid /api/* route did not return proper JSON 404 error:', res.status, body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Invalid route check crashed:', err.message);
    failed++;
  }

  // 2. Verify /api/health returns JSON and health status
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const body = await res.json();
    if (res.status === 200 && body.status === 'healthy') {
      console.log('✅ PASS: Health check endpoint is active and returns healthy JSON.');
      passed++;
    } else {
      console.error('❌ FAIL: Health check endpoint failed:', body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Health check crashed:', err.message);
    failed++;
  }

  // 3. Verify Security Headers (Helmet, nosniff, frame protection, referrer policy)
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const nosniff = res.headers.get('x-content-type-options');
    const xss = res.headers.get('x-xss-protection');
    const csp = res.headers.get('content-security-policy');
    const poweredBy = res.headers.get('x-powered-by');

    if (nosniff === 'nosniff' && xss && csp && !poweredBy) {
      console.log('✅ PASS: Security headers properly enforced (nosniff, XSS, CSP active, X-Powered-By removed).');
      passed++;
    } else {
      console.error('❌ FAIL: Security headers incomplete:', { nosniff, xss, hasCsp: !!csp, poweredBy });
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Security headers check crashed:', err.message);
    failed++;
  }

  // 4. Verify Role Escalation Attempt on /api/auth/register (Attacker passes role="ADMIN")
  try {
    const email = `attacker_${Date.now()}@test.com`;
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Malicious',
        lastName: 'Attacker',
        email,
        phone: '+91 9999900000',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'ADMIN' // Malicious escalation attempt
      })
    });
    const body = await res.json();
    if (res.status === 201 && body.data?.user?.role === 'CUSTOMER') {
      console.log('✅ PASS: Privilege escalation blocked; public registration enforced CUSTOMER role.');
      passed++;
    } else {
      console.error('❌ FAIL: Privilege escalation not prevented:', body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Role escalation check crashed:', err.message);
    failed++;
  }

  // 5. Verify Staff Login and RBAC Token
  let staffToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'staff', password: 'Password@123' })
    });
    const body = await res.json();
    if (res.status === 200 && body.data?.token && body.data?.user?.role === 'STAFF') {
      staffToken = body.data.token;
      console.log('✅ PASS: Staff login successful with verified STAFF role token.');
      passed++;
    } else {
      console.error('❌ FAIL: Staff login failed:', body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Staff login check crashed:', err.message);
    failed++;
  }

  // 6. Verify Customer Login and Customer Token
  let customerToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'customer', password: 'Password@123' })
    });
    const body = await res.json();
    if (res.status === 200 && body.data?.token && body.data?.user?.role === 'CUSTOMER') {
      customerToken = body.data.token;
      console.log('✅ PASS: Customer login successful with verified CUSTOMER role token.');
      passed++;
    } else {
      console.error('❌ FAIL: Customer login failed:', body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Customer login check crashed:', err.message);
    failed++;
  }

  // 7. Verify Customer Accessing Manager Endpoint (Blocked with 403 Forbidden)
  try {
    const res = await fetch(`${BASE_URL}/api/manager/employees`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const body = await res.json();
    if (res.status === 403 && body.error?.code === 'FORBIDDEN') {
      console.log('✅ PASS: Customer access to Manager employee API strictly blocked (403 Forbidden).');
      passed++;
    } else {
      console.error('❌ FAIL: Customer was not blocked from Manager API:', res.status, body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Customer access check crashed:', err.message);
    failed++;
  }

  // 8. Verify Staff Accessing Manager Endpoint (Blocked with 403 Forbidden)
  try {
    const res = await fetch(`${BASE_URL}/api/manager/employees`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const body = await res.json();
    if (res.status === 403 && body.error?.code === 'FORBIDDEN') {
      console.log('✅ PASS: Staff access to Manager employee API strictly blocked (403 Forbidden).');
      passed++;
    } else {
      console.error('❌ FAIL: Staff was not blocked from Manager API:', res.status, body);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Staff access check crashed:', err.message);
    failed++;
  }

  // 9. Verify CORS Allowlist Rejection on Unauthorized Origin
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: 'https://malicious-attacker-domain.com' }
    });
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao || acao !== 'https://malicious-attacker-domain.com') {
      console.log('✅ PASS: Unauthorized origin blocked; Access-Control-Allow-Origin withheld.');
      passed++;
    } else {
      console.error('❌ FAIL: Malicious origin was reflected in Access-Control-Allow-Origin:', acao);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: CORS check crashed:', err.message);
    failed++;
  }

  // 10. Verify CORS Allowlist Acceptance on Production Domain
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: 'https://restaurant-com-2a275.web.app' }
    });
    const acao = res.headers.get('access-control-allow-origin');
    if (acao === 'https://restaurant-com-2a275.web.app') {
      console.log('✅ PASS: Authorized production domain accepted in Access-Control-Allow-Origin.');
      passed++;
    } else {
      console.error('❌ FAIL: Authorized production domain was not accepted:', acao);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FAIL: CORS authorized check crashed:', err.message);
    failed++;
  }

  // 11. Verify Unauthenticated Request to Sensitive Order Details is Blocked
  try {
    const existingOrder = Array.from(db.orders.values())[0];
    if (existingOrder) {
      const res = await fetch(`${BASE_URL}/api/orders/${existingOrder.id}`);
      if (res.status === 404 || res.status === 401 || res.status === 400) {
        console.log('✅ PASS: Unauthenticated access to customer order details rejected.');
        passed++;
      } else {
        console.error('❌ FAIL: Unauthenticated order access was not rejected:', res.status);
        failed++;
      }
    } else {
      console.log('ℹ️ SKIP: No orders present to test order isolation.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Order access check crashed:', err.message);
    failed++;
  }

  console.log(`\n--- AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit();
