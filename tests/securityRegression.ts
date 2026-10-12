/**
 * Security regression checks for the production-hardening fixes.
 *
 * Runs over HTTP against the in-process test server started by
 * `npm run test:security` (isolated test database, cleaned up afterwards).
 * Each check exercises a vulnerability that existed before the fix.
 */

interface Check {
  name: string;
  run: () => Promise<boolean | string>;
}

export async function runSecurityRegressions(baseUrl: string): Promise<{ passed: number; failed: number }> {
  const setupNotes: string[] = [];
  const api = async (method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers || {})
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  };

  const staffLogin = async (username: string, password: string) =>
    api('POST', '/auth/login', { body: { username, password } });

  const registerCustomer = async (tag: string) => {
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const res = await api('POST', '/auth/register', {
      body: {
        firstName: 'Secreg',
        lastName: tag,
        email: `secreg.${tag}.${stamp}@example.com`,
        phone: `+91 98${stamp.slice(-8)}`,
        password: 'Regress1on!',
        confirmPassword: 'Regress1on!'
      }
    });
    if (!res.json?.data?.token) setupNotes.push(`register ${tag}: ${res.status} ${JSON.stringify(res.json?.error || res.json).slice(0, 160)}`);
    return res.json?.data?.token as string;
  };

  const placeOrder = async (token: string) => {
    const res = await api('POST', '/orders', {
      token,
      headers: { 'Idempotency-Key': `secreg-${Date.now()}-${Math.random().toString(36).slice(2)}` },
      body: {
        orderType: 'Takeaway',
        customerName: 'Secreg Customer',
        customerPhone: '+91 9800000000',
        customerEmail: 'secreg@example.com',
        paymentMethod: 'UPI',
        items: [{ menuItemId: 'itm-001', quantity: 1 }]
      }
    });
    if (!res.json?.data?.id) setupNotes.push(`order: ${res.status} ${JSON.stringify(res.json?.error || res.json).slice(0, 160)}`);
    return res.json?.data as { id: string } | undefined;
  };

  const adminToken = (await staffLogin('admin', 'Password@123')).json?.data?.token as string;
  const managerToken = (await staffLogin('manager', 'Password@123')).json?.data?.token as string;
  const kitchenLogin = await staffLogin('kitchen', 'Password@123');
  const kitchenToken = kitchenLogin.json?.data?.token as string;
  if (!kitchenToken) setupNotes.push(`kitchen login: ${kitchenLogin.status} ${JSON.stringify(kitchenLogin.json?.error).slice(0, 160)}`);
  const customerA = await registerCustomer('a');
  const customerB = await registerCustomer('b');
  const orderA = customerA ? await placeOrder(customerA) : undefined;

  const checks: Check[] = [
    {
      name: 'Staff login rejects hardcoded default passwords (backdoor removed)',
      run: async () => {
        for (const pw of ['Admin@123', 'Password123!']) {
          const res = await staffLogin('admin', pw);
          if (res.status === 200) return `admin accepted "${pw.slice(0, 3)}…"`;
        }
        return !!adminToken || 'control login with the real password failed';
      }
    },
    {
      name: 'Phone OTP login cannot obtain an employee (ADMIN) session',
      run: async () => {
        const res = await api('POST', '/auth/customer/login', {
          body: { idToken: 'mock_valid_token_919876543210_fb-secreg-attacker.header.sig' }
        });
        return (res.status >= 400 && !res.json?.data?.token) || `status ${res.status}, role ${res.json?.data?.user?.role}`;
      }
    },
    {
      name: 'Adding items to an order requires authentication',
      run: async () => {
        const res = await api('POST', `/orders/${orderA?.id || 'x'}/items`, { body: { items: [{ menuItemId: 'itm-001', quantity: 1 }] } });
        return res.status === 401 || `status ${res.status}`;
      }
    },
    {
      name: "A customer cannot add items to another customer's order",
      run: async () => {
        if (!orderA || !customerB) return 'setup failed (order or customer not created)';
        const res = await api('POST', `/orders/${orderA.id}/items`, { token: customerB, body: { items: [{ menuItemId: 'itm-001', quantity: 1 }] } });
        return res.status === 404 || `status ${res.status}`;
      }
    },
    {
      name: 'Add-items rejects absurd quantities (validation)',
      run: async () => {
        if (!orderA || !customerA) return 'setup failed';
        const res = await api('POST', `/orders/${orderA.id}/items`, { token: customerA, body: { items: [{ menuItemId: 'itm-001', quantity: 1e9 }] } });
        return res.status === 400 || `status ${res.status}`;
      }
    },
    {
      name: 'Payment status and attempt status require authentication',
      run: async () => {
        const a = await api('GET', `/payments/orders/${orderA?.id || 'x'}/status`);
        const b = await api('GET', '/payments/attempt/att-unknown/status');
        const c = await api('POST', '/payments/attempt/att-unknown/confirm-upi', { body: { utrNumber: '123456789012' } });
        return (a.status === 401 && b.status === 401 && c.status === 401) || `statuses ${a.status}/${b.status}/${c.status}`;
      }
    },
    {
      name: "A customer cannot read another customer's payment status",
      run: async () => {
        if (!orderA || !customerB) return 'setup failed';
        const res = await api('GET', `/payments/orders/${orderA.id}/status`, { token: customerB });
        return (res.status >= 400 && !res.json?.data) || `status ${res.status}`;
      }
    },
    {
      name: "Payment verification cannot reuse another order's gateway order (replay)",
      run: async () => {
        if (!customerA || !orderA) return 'setup failed';
        const orderB = await placeOrder(customerA);
        if (!orderB) return 'setup failed (second order)';
        const payA = await api('POST', '/payments/create', { token: customerA, body: { orderId: orderA.id, paymentMethod: 'UPI' } });
        const payB = await api('POST', '/payments/create', { token: customerA, body: { orderId: orderB.id, paymentMethod: 'UPI' } });
        const providerOrderIdA = payA.json?.data?.providerOrderId;
        if (!providerOrderIdA || !payB.json?.data?.providerOrderId) return 'setup failed (payment orders)';
        const verify = await api('POST', '/payments/verify', {
          token: customerA,
          body: {
            orderId: orderB.id,
            razorpay_order_id: providerOrderIdA,
            razorpay_payment_id: `pay_secreg_${Date.now()}`,
            razorpay_signature: 'sig_test_secreg_replay',
            providerOrderId: providerOrderIdA,
            providerPaymentId: `pay_secreg_${Date.now()}`,
            providerSignature: 'sig_test_secreg_replay'
          }
        });
        const status = await api('GET', `/payments/orders/${orderB.id}/status`, { token: customerA });
        return (verify.status >= 400 && status.json?.data?.paymentStatus !== 'PAID') || `verify ${verify.status}, B paymentStatus ${status.json?.data?.paymentStatus}`;
      }
    },
    {
      name: 'Customers can only cancel their own order, not set kitchen statuses',
      run: async () => {
        if (!orderA || !customerA) return 'setup failed';
        const res = await api('PUT', `/orders/${orderA.id}/status`, { token: customerA, body: { status: 'READY' } });
        return res.status >= 400 || `status ${res.status}`;
      }
    },
    {
      name: 'Kitchen display cannot complete or cancel orders',
      run: async () => {
        if (!orderA || !kitchenToken) return 'setup failed (kitchen login)';
        const res = await api('PUT', `/kitchen/orders/${orderA.id}/status`, { token: kitchenToken, body: { status: 'COMPLETED' } });
        return res.status === 403 || `status ${res.status}`;
      }
    },
    {
      name: 'Manager cannot reset an ADMIN account password',
      run: async () => {
        if (!managerToken) return 'setup failed (manager login)';
        const res = await api('POST', '/manager/employees/usr-admin-001/reset-password', {
          token: managerToken,
          body: { newPassword: 'Takeover1!x', confirmNewPassword: 'Takeover1!x' }
        });
        const adminStillWorks = (await staffLogin('admin', 'Password@123')).status === 200;
        // 404 (not a validation 400) proves the permission check itself refused it.
        return (res.status === 404 && adminStillWorks) || `status ${res.status}, admin login intact: ${adminStillWorks}`;
      }
    },
    {
      name: 'A settled bill cannot be paid (collected) a second time',
      run: async () => {
        if (!customerA || !adminToken) return 'setup failed';
        const order = await placeOrder(customerA);
        if (!order) return 'setup failed (order)';
        const gen = await api('POST', `/billing/generate/${order.id}`, { token: adminToken });
        const invoiceId = gen.json?.data?.invoice?.id;
        if (!invoiceId) return `setup failed (invoice ${gen.status})`;
        const first = await api('POST', `/billing/invoice/${invoiceId}/pay`, { token: adminToken, body: { paymentMethod: 'Cash' } });
        const second = await api('POST', `/billing/invoice/${invoiceId}/pay`, { token: adminToken, body: { paymentMethod: 'Cash' } });
        return (first.status === 200 && second.status >= 400) || `first ${first.status}, second ${second.status}`;
      }
    },
    {
      name: 'Public health endpoint does not expose environment or memory details',
      run: async () => {
        const res = await api('GET', '/health');
        const text = JSON.stringify(res.json || {});
        return (res.status === 200 && !/environment|heapUsed|rssMb/.test(text)) || text;
      }
    }
  ];

  if (setupNotes.length) console.error('[SECURITY REGRESSION SETUP]', setupNotes.join(' | '));

  let passed = 0;
  let failed = 0;
  for (const check of checks) {
    try {
      const outcome = await check.run();
      if (outcome === true) {
        console.log(`✅ PASS: ${check.name}`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${check.name} → ${outcome}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ FAIL: ${check.name} crashed: ${err?.message || err}`);
      failed++;
    }
  }
  return { passed, failed };
}
