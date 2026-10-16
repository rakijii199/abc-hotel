/**
 * HTTP-level functional tests: every read endpoint for every role, plus the
 * main business workflows end to end through the real routes/controllers.
 *
 * The service-level suite (testRunner.ts) calls services directly, so it
 * cannot catch controller bugs such as a missing `await` that serialises a
 * Promise as `{}`. This suite exercises the HTTP layer the UI actually uses.
 *
 * Runs via `npm run test:api` against an in-process server backed by the
 * isolated test database (cleaned up afterwards).
 */

type Json = any;

interface StepResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export async function runApiWorkflows(baseUrl: string): Promise<{ passed: number; failed: number; results: StepResult[] }> {
  if (!process.env.ABC_DB_FILE || process.env.IS_TEST_RUN !== 'true') {
    throw new Error('[TEST SAFETY] Run with `npm run test:api` (isolated test database + cleanup).');
  }

  const results: StepResult[] = [];
  const record = (name: string, passed: boolean, detail?: unknown) => {
    results.push({ name, passed, detail: detail === undefined ? undefined : typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400) });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name}${!passed && detail !== undefined ? ` → ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}` : ''}`);
  };

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
    let json: Json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json, data: json?.data };
  };

  const step = async (name: string, fn: () => Promise<boolean | string | void>) => {
    try {
      const out = await fn();
      if (out === true || out === undefined) record(name, true);
      else record(name, false, out === false ? 'assertion failed' : out);
    } catch (err: any) {
      record(name, false, `crashed: ${err?.message || err}`);
    }
  };

  /** A `{}` where data is expected almost always means a Promise was serialised (missing await). */
  const findEmptyObjects = (value: unknown, path = 'data', depth = 0, out: string[] = []): string[] => {
    if (depth > 2 || value === null || typeof value !== 'object') return out;
    if (!Array.isArray(value) && Object.keys(value as object).length === 0) {
      out.push(path);
      return out;
    }
    if (!Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as object)) findEmptyObjects(v, `${path}.${k}`, depth + 1, out);
    }
    return out;
  };

  const login = async (username: string, password = 'Password@123') => (await api('POST', '/auth/login', { body: { username, password } })).data?.token as string;
  const stamp = Date.now().toString();
  const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  // ---- Sessions ----
  const tokens: Record<string, string> = {
    admin: await login('admin'),
    manager: await login('manager'),
    staff: await login('staff'),
    kitchen: await login('kitchen'),
    delivery: await login('delivery')
  };
  const reg = await api('POST', '/auth/register', {
    body: {
      firstName: 'Workflow',
      lastName: 'Guest',
      email: `workflow.guest.${stamp}@example.com`,
      phone: `+91 97${stamp.slice(-8)}`,
      password: 'Workfl0w!Pass',
      confirmPassword: 'Workfl0w!Pass'
    }
  });
  tokens.customer = reg.data?.token;
  const customerId = reg.data?.user?.id;
  await step('Sessions: every role can sign in', async () => {
    const missing = Object.entries(tokens).filter(([, t]) => !t).map(([r]) => r);
    return missing.length === 0 || `no token for: ${missing.join(', ')}`;
  });

  // ---- Read sweep: every GET endpoint per role ----
  const sweep: Array<{ role: string; paths: string[] }> = [
    { role: 'public', paths: ['/health', '/health/ready', '/menu', '/menu/categories', '/menu/itm-001', '/tables', `/tables/availability?bookingDate=${tomorrow}&startTime=13:00&guestCount=2`, '/payments/config'] },
    { role: 'customer', paths: ['/auth/me', '/users/me', '/bookings', '/bookings/my-bookings', '/orders', '/orders/my-orders'] },
    {
      role: 'admin',
      paths: [
        '/admin/dashboard', '/admin/dashboard/aggregated', '/admin/stats', '/admin/reports', '/admin/retention/config', '/admin/retention/logs',
        '/admin/archive/orders', '/admin/orders', '/admin/orders/paginated', '/admin/bookings', '/admin/menu', '/admin/menu/categories',
        '/admin/tables', '/admin/customers', '/admin/audit-logs', '/admin/notifications', '/admin/payment-settings', '/admin/payments',
        '/payments/admin/all', '/payments/admin/payment-settings', '/billing/requests', '/billing/history', '/billing/settings',
        '/billing/reports', '/billing/audits', '/inventory/items', '/inventory/recipes', '/inventory/recipes/itm-001', '/inventory/movements',
        '/inventory/stats', `/inventory/daily?date=${tomorrow}`, `/inventory/monthly?month=${tomorrow.slice(0, 7)}`, '/kitchen/orders', '/kitchen/stats', '/manager/stats', '/manager/employees'
      ]
    },
    { role: 'manager', paths: ['/admin/dashboard', '/admin/orders', '/admin/bookings', '/manager/stats', '/manager/employees', '/inventory/items', '/billing/history'] },
    { role: 'kitchen', paths: ['/kitchen/orders', '/kitchen/stats', '/inventory/items', '/inventory/stats'] },
    { role: 'staff', paths: ['/kitchen/orders', '/inventory/items', '/billing/requests'] },
    { role: 'delivery', paths: ['/auth/me', '/admin/orders'] }
  ];
  for (const group of sweep) {
    for (const path of group.paths) {
      await step(`GET ${path} as ${group.role}`, async () => {
        const res = await api('GET', path, { token: group.role === 'public' ? undefined : tokens[group.role] });
        if (res.status >= 500) return `HTTP ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}`;
        if (group.role === 'delivery' && path === '/admin/orders') return res.status === 403 || `delivery should be refused admin orders, got ${res.status}`;
        if (res.status !== 200 || res.json?.success === false) return `HTTP ${res.status}: ${JSON.stringify(res.json?.error || res.json).slice(0, 200)}`;
        const empties = findEmptyObjects(res.json?.data);
        return empties.length === 0 || `empty object at ${empties.join(', ')} (likely an un-awaited Promise)`;
      });
    }
  }

  // ---- Workflow 1: table booking ----
  let bookingId = '';
  await step('Booking: availability lists tables with at least one free table', async () => {
    const res = await api('GET', `/tables/availability?bookingDate=${tomorrow}&startTime=13:00&guestCount=2`);
    const tables = res.data?.tables;
    if (!Array.isArray(tables) || tables.length === 0) return `tables: ${JSON.stringify(tables)}`;
    return tables.some((t: Json) => t.isAvailable) || 'no table available';
  });
  await step('Booking: customer reserves a free table', async () => {
    const avail = await api('GET', `/tables/availability?bookingDate=${tomorrow}&startTime=13:00&guestCount=2`);
    const table = avail.data?.tables?.find((t: Json) => t.isAvailable);
    const res = await api('POST', '/bookings', { token: tokens.customer, body: { bookingDate: tomorrow, startTime: '13:00', guestCount: 2, tableId: table?.id, specialRequest: 'workflow test' } });
    bookingId = res.data?.id;
    if (!bookingId) return `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
    const again = await api('GET', `/tables/availability?bookingDate=${tomorrow}&startTime=13:00&guestCount=2`);
    const sameTable = again.data?.tables?.find((t: Json) => t.id === table.id);
    return sameTable?.isAvailable === false || 'booked table still shows as available';
  });
  await step('Booking: appears in My Bookings and staff reservations', async () => {
    const mine = await api('GET', '/bookings/my-bookings', { token: tokens.customer });
    const staff = await api('GET', '/admin/bookings', { token: tokens.admin });
    const inMine = (mine.data || []).some((b: Json) => b.id === bookingId);
    const inStaff = JSON.stringify(staff.data || '').includes(bookingId);
    return (inMine && inStaff) || `in my bookings: ${inMine}, in staff list: ${inStaff}`;
  });
  await step('Booking: staff confirms, customer can view it', async () => {
    const upd = await api('PUT', `/admin/bookings/${bookingId}/status`, { token: tokens.admin, body: { status: 'CONFIRMED' } });
    const view = await api('GET', `/bookings/${bookingId}`, { token: tokens.customer });
    return (upd.status === 200 && view.data?.status === 'CONFIRMED') || `update ${upd.status}, view status ${view.data?.status}`;
  });
  await step('Booking: customer cancels', async () => {
    const res = await api('POST', `/bookings/${bookingId}/cancel`, { token: tokens.customer });
    const view = await api('GET', `/bookings/${bookingId}`, { token: tokens.customer });
    return (res.status === 200 && view.data?.status === 'CANCELLED') || `cancel ${res.status}, status ${view.data?.status}`;
  });

  // ---- Workflow 2: dine-in order through kitchen and billing ----
  let orderId = '';
  await step('Order: customer places a dine-in order (server-priced)', async () => {
    const res = await api('POST', '/orders', {
      token: tokens.customer,
      headers: { 'Idempotency-Key': `wf-${stamp}-1` },
      body: { orderType: 'Dine-in', tableNumber: 'Table 01', customerName: 'Workflow Guest', customerPhone: '+91 9700000000', customerEmail: `workflow.guest.${stamp}@example.com`, paymentMethod: 'Pay at Exit', items: [{ menuItemId: 'itm-001', quantity: 2 }] }
    });
    orderId = res.data?.id;
    if (!orderId) return `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
    const expected = res.data.items.reduce((s: number, i: Json) => s + i.unitPrice * i.quantity, 0);
    return res.data.subtotal === expected || `subtotal ${res.data.subtotal} vs items ${expected}`;
  });
  await step('Order: same idempotency key does not create a duplicate', async () => {
    const res = await api('POST', '/orders', {
      token: tokens.customer,
      headers: { 'Idempotency-Key': `wf-${stamp}-1` },
      body: { orderType: 'Dine-in', tableNumber: 'Table 01', customerName: 'Workflow Guest', customerPhone: '+91 9700000000', customerEmail: `workflow.guest.${stamp}@example.com`, paymentMethod: 'Pay at Exit', items: [{ menuItemId: 'itm-001', quantity: 2 }] }
    });
    return res.data?.id === orderId || `second id ${res.data?.id}, status ${res.status}`;
  });
  await step('Order: visible in My Orders, order detail and kitchen queue', async () => {
    const mine = await api('GET', '/orders/my-orders', { token: tokens.customer });
    const detail = await api('GET', `/orders/${orderId}`, { token: tokens.customer });
    const kitchen = await api('GET', '/kitchen/orders', { token: tokens.kitchen });
    const inMine = (mine.data || []).some((o: Json) => o.id === orderId);
    const inKitchen = JSON.stringify(kitchen.data || '').includes(orderId);
    return (inMine && detail.data?.id === orderId && inKitchen) || `mine ${inMine}, detail ${detail.status}, kitchen ${inKitchen}`;
  });
  await step('Order: customer adds an item to their own order', async () => {
    const res = await api('POST', `/orders/${orderId}/items`, { token: tokens.customer, body: { items: [{ menuItemId: 'itm-002', quantity: 1 }] } });
    return (res.status === 200 && res.data?.items?.length === 2) || `HTTP ${res.status}, items ${res.data?.items?.length}, ${JSON.stringify(res.json?.error)}`;
  });
  for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'SERVED']) {
    await step(`Order: kitchen moves order to ${status}`, async () => {
      const res = await api('PUT', `/kitchen/orders/${orderId}/status`, { token: tokens.kitchen, body: { status } });
      return (res.status === 200 && res.data?.status === status) || `HTTP ${res.status}, status ${res.data?.status}, ${JSON.stringify(res.json?.error)}`;
    });
  }
  let invoiceId = '';
  let publicToken = '';
  await step('Billing: customer requests the bill', async () => {
    const res = await api('POST', `/orders/${orderId}/request-bill`, { token: tokens.customer });
    return res.status === 200 || `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
  });
  await step('Billing: staff generates invoice; totals match the order', async () => {
    const res = await api('POST', `/billing/generate/${orderId}`, { token: tokens.staff });
    const inv = res.data?.invoice;
    invoiceId = inv?.id;
    publicToken = inv?.publicToken;
    if (!invoiceId) return `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
    const order = (await api('GET', `/orders/${orderId}`, { token: tokens.customer })).data;
    return inv.grandTotal === order.total || `invoice grandTotal ${inv.grandTotal} vs order total ${order.total}`;
  });
  await step('Billing: public invoice link works without exposing contact details', async () => {
    const res = await api('GET', `/billing/public/${publicToken}`);
    const d = res.data || {};
    return (res.status === 200 && d.invoiceNumber && !d.customerEmail && !String(d.customerPhone || '').match(/\d{6,}/)) || `HTTP ${res.status}, email ${!!d.customerEmail}, phone ${d.customerPhone}`;
  });
  await step('Billing: cashier collects payment; order completes', async () => {
    const res = await api('POST', `/billing/invoice/${invoiceId}/pay`, { token: tokens.staff, body: { paymentMethod: 'Cash' } });
    const order = (await api('GET', `/orders/${orderId}`, { token: tokens.customer })).data;
    return (res.status === 200 && order?.paymentStatus === 'PAID') || `pay ${res.status}, order ${order?.status}/${order?.paymentStatus}, ${JSON.stringify(res.json?.error)}`;
  });
  await step('Billing: customer can open their invoice', async () => {
    const res = await api('GET', `/billing/invoice/${invoiceId}`, { token: tokens.customer });
    return (res.status === 200 && (res.data?.id || res.data?.invoice?.id) === invoiceId) || `HTTP ${res.status}: ${JSON.stringify(res.json?.error || res.data)}`;
  });

  await step('Billing: invoice can be opened by order id (as the order status page does)', async () => {
    const res = await api('GET', `/billing/invoice/${orderId}`, { token: tokens.customer });
    return (res.status === 200 && (res.data?.id || res.data?.invoice?.id) === invoiceId) || `HTTP ${res.status}`;
  });

  // ---- Workflow 3: UPI QR payment awaiting cashier verification ----
  await step('Payment: UPI QR attempt, customer submits UTR, payment stays pending for verification', async () => {
    const order = await api('POST', '/orders', {
      token: tokens.customer,
      headers: { 'Idempotency-Key': `wf-${stamp}-upi` },
      body: { orderType: 'Takeaway', customerName: 'Workflow Guest', customerPhone: '+91 9700000000', customerEmail: `workflow.guest.${stamp}@example.com`, paymentMethod: 'UPI', items: [{ menuItemId: 'itm-003', quantity: 1 }] }
    });
    const oid = order.data?.id;
    const pay = await api('POST', '/payments/create', { token: tokens.customer, body: { orderId: oid, paymentMethod: 'UPI' } });
    const attemptId = pay.data?.attemptId;
    if (!attemptId) return `create payment ${pay.status}: ${JSON.stringify(pay.json?.error)}`;
    const poll = await api('GET', `/payments/attempt/${attemptId}/status`, { token: tokens.customer });
    const confirm = await api('POST', `/payments/attempt/${attemptId}/confirm-upi`, { token: tokens.customer, body: { utrNumber: '412345678901' } });
    const status = await api('GET', `/payments/orders/${oid}/status`, { token: tokens.customer });
    return (poll.status === 200 && confirm.status === 200 && status.data?.paymentStatus === 'PENDING') || `poll ${poll.status}, confirm ${confirm.status}, paymentStatus ${status.data?.paymentStatus}`;
  });

  // ---- Workflow 4: staff POS order ----
  await step('POS: manager creates a walk-in order', async () => {
    const res = await api('POST', '/admin/orders', { token: tokens.manager, body: { orderType: 'Takeaway', customerName: 'POS Walk-in', paymentMethod: 'Cash', items: [{ menuItemId: 'itm-001', quantity: 1 }] } });
    return (res.status === 201 || res.status === 200) && !!res.data?.id || `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
  });

  // ---- Workflow 5: menu, category and table management ----
  await step('Menu admin: create, toggle, update and delete a dish', async () => {
    const cats = await api('GET', '/menu/categories');
    const categoryId = (cats.data || [])[0]?.id;
    const created = await api('POST', '/admin/menu', {
      token: tokens.admin,
      body: { categoryId, name: `Workflow Dish ${stamp}`, description: 'Created by the workflow test', price: 199, imageUrl: 'https://images.unsplash.com/photo-1', vegetarian: true, spicy: false, spiceLevel: 'None', prepTimeMinutes: 10 }
    });
    const id = created.data?.id;
    if (!id) return `create ${created.status}: ${JSON.stringify(created.json?.error)}`;
    const toggled = await api('PATCH', `/admin/menu/${id}/toggle-availability`, { token: tokens.admin });
    const updated = await api('PUT', `/admin/menu/${id}`, { token: tokens.admin, body: { price: 249 } });
    const publicView = await api('GET', `/menu/${id}`);
    const removed = await api('DELETE', `/admin/menu/${id}`, { token: tokens.admin });
    return (toggled.status === 200 && updated.data?.price === 249 && publicView.status === 200 && removed.status === 200) ||
      `toggle ${toggled.status}, update price ${updated.data?.price}, public ${publicView.status}, delete ${removed.status}`;
  });
  await step('Menu admin: create and delete a category', async () => {
    const created = await api('POST', '/admin/menu/categories', { token: tokens.admin, body: { name: `Workflow Cat ${stamp.slice(-5)}` } });
    const id = created.data?.id;
    if (!id) return `create ${created.status}: ${JSON.stringify(created.json?.error)}`;
    const removed = await api('DELETE', `/admin/menu/categories/${id}`, { token: tokens.admin });
    return removed.status === 200 || `delete ${removed.status}: ${JSON.stringify(removed.json?.error)}`;
  });
  await step('Tables admin: create, update and delete a table; it shows in public list', async () => {
    const created = await api('POST', '/admin/tables', { token: tokens.admin, body: { tableNumber: `WF-${stamp.slice(-4)}`, capacity: 4, location: 'Garden Side' } });
    const id = created.data?.id;
    if (!id) return `create ${created.status}: ${JSON.stringify(created.json?.error)}`;
    const listed = await api('GET', '/tables');
    const inList = JSON.stringify(listed.data || '').includes(id);
    const updated = await api('PUT', `/admin/tables/${id}`, { token: tokens.admin, body: { capacity: 6 } });
    const removed = await api('DELETE', `/admin/tables/${id}`, { token: tokens.admin });
    return (inList && updated.data?.capacity === 6 && removed.status === 200) || `listed ${inList}, capacity ${updated.data?.capacity}, delete ${removed.status}`;
  });

  // ---- Workflow 6: employee lifecycle ----
  await step('Employees: manager creates staff, staff signs in, deactivation blocks sign-in', async () => {
    const username = `wf_staff_${stamp.slice(-6)}`;
    const created = await api('POST', '/manager/employees', {
      token: tokens.manager,
      body: { firstName: 'Workflow', lastName: 'Staff', username, email: `${username}@example.com`, phone: `98${stamp.slice(-8)}`, password: 'Staff!Pass9', confirmPassword: 'Staff!Pass9', role: 'STAFF' }
    });
    const id = created.data?.id;
    if (!id) return `create ${created.status}: ${JSON.stringify(created.json?.error)}`;
    const firstLogin = await login(username, 'Staff!Pass9');
    const deact = await api('PATCH', `/manager/employees/${id}/status`, { token: tokens.manager, body: { status: 'INACTIVE' } });
    const secondLogin = await login(username, 'Staff!Pass9');
    return (!!firstLogin && deact.status === 200 && !secondLogin) || `first login ${!!firstLogin}, deactivate ${deact.status}, login after ${!!secondLogin}`;
  });

  // ---- Workflow 7: inventory ----
  await step('Inventory: replenish an item increases stock and records a movement', async () => {
    const items = await api('GET', '/inventory/items', { token: tokens.admin });
    const list = Array.isArray(items.data) ? items.data : items.data?.items || [];
    const item = list[0];
    if (!item) return `no items: ${JSON.stringify(items.data).slice(0, 120)}`;
    const bad = await api('POST', `/inventory/items/${item.id}/replenish`, { token: tokens.admin, body: { quantityAdded: 'abc' } });
    if (bad.status !== 400) return `non-numeric quantity accepted (HTTP ${bad.status})`;
    const res = await api('POST', `/inventory/items/${item.id}/replenish`, { token: tokens.admin, body: { quantityAdded: 2, totalCost: 100, supplier: 'Workflow Supplier', notes: 'workflow test' } });
    const after = await api('GET', '/inventory/items', { token: tokens.admin });
    const afterItem = (Array.isArray(after.data) ? after.data : after.data?.items || []).find((i: Json) => i.id === item.id);
    return (res.status === 200 && Number((afterItem?.currentStock - item.currentStock).toFixed(2)) === 2) || `replenish ${res.status}, stock ${item.currentStock} -> ${afterItem?.currentStock}, ${JSON.stringify(res.json?.error)}`;
  });

  await step('Inventory: editing an item cannot overwrite its stock level', async () => {
    const items = await api('GET', '/inventory/items', { token: tokens.admin });
    const item = (Array.isArray(items.data) ? items.data : items.data?.items || [])[1];
    const res = await api('PUT', `/inventory/items/${item.id}`, { token: tokens.admin, body: { name: item.name, minThreshold: 3, currentStock: 99999 } });
    return (res.status === 200 && res.data?.currentStock === item.currentStock && res.data?.minThreshold === 3) || `HTTP ${res.status}, stock ${item.currentStock} -> ${res.data?.currentStock}`;
  });

  // ---- Workflow 8: profile ----
  await step('Profile: customer reads and updates their profile', async () => {
    const me = await api('GET', '/users/me', { token: tokens.customer });
    const upd = await api('PUT', '/users/me', { token: tokens.customer, body: { firstName: 'Renamed' } });
    const again = await api('GET', '/users/me', { token: tokens.customer });
    return (me.data?.id === customerId && upd.status === 200 && again.data?.firstName === 'Renamed') || `me ${me.data?.id}, update ${upd.status}, name ${again.data?.firstName}`;
  });

  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n--- API WORKFLOWS: ${results.length - failed} PASSED, ${failed} FAILED ---`);
  return { passed: results.length - failed, failed, results };
}
