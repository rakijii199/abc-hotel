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

  // ---- Workflow 9: configurable menu items (portions + add-ons) ----
  const cats = await api('GET', '/menu/categories');
  const cfgCategoryId = (cats.data || [])[0]?.id;
  const biryaniBody = {
    categoryId: cfgCategoryId,
    name: `Config Biryani ${stamp}`,
    description: 'Configurable dish created by the workflow test',
    price: 200,
    imageUrl: 'https://images.unsplash.com/photo-1',
    vegetarian: false,
    spicy: true,
    spiceLevel: 'Medium',
    prepTimeMinutes: 20,
    portions: [
      { id: 'HALF', label: 'Half', price: 150, active: true },
      { id: 'FULL', label: 'Full', price: 270, active: true }
    ],
    addonGroups: [
      {
        id: 'grp-extras', name: 'Extras', required: false, minSelect: 0, maxSelect: 2, active: true,
        addons: [
          { id: 'add-egg', name: 'Extra Egg', price: 20, active: true },
          { id: 'add-chicken', name: 'Extra Chicken', price: 60, active: true },
          { id: 'add-gravy', name: 'Extra Gravy', price: 25, active: true }
        ]
      },
      {
        id: 'grp-spice', name: 'Spice Level', required: true, minSelect: 1, maxSelect: 1, active: true,
        addons: [
          { id: 'add-mild', name: 'Mild', price: 0, active: true },
          { id: 'add-hot', name: 'Hot', price: 0, active: true }
        ]
      }
    ]
  };
  let biryaniId = '';
  let cfgOrderId = '';
  const cfgOrderBody = (items: Json[], key: string) => ({
    token: tokens.customer,
    headers: { 'Idempotency-Key': key },
    body: { orderType: 'Takeaway', customerName: 'Config Guest', customerPhone: '+91 9700000001', customerEmail: `config.guest.${stamp}@example.com`, paymentMethod: 'Pay at Exit', items }
  });

  await step('Menu config: kitchen and customers cannot configure menu items', async () => {
    const k = await api('POST', '/admin/menu', { token: tokens.kitchen, body: biryaniBody });
    const c = await api('POST', '/admin/menu', { token: tokens.customer, body: biryaniBody });
    return (k.status === 403 && c.status === 403) || `kitchen ${k.status}, customer ${c.status}`;
  });
  await step('Menu config: invalid configurations are rejected (required group without add-ons, min > max, duplicate ids)', async () => {
    const bad1 = await api('POST', '/admin/menu', { token: tokens.manager, body: { ...biryaniBody, addonGroups: [{ id: 'g1', name: 'Sauce', required: true, minSelect: 1, maxSelect: 1, active: true, addons: [] }] } });
    const bad2 = await api('POST', '/admin/menu', { token: tokens.manager, body: { ...biryaniBody, addonGroups: [{ id: 'g1', name: 'Sauce', required: false, minSelect: 3, maxSelect: 1, active: true, addons: [{ id: 'a1', name: 'A', price: 1, active: true }] }] } });
    const bad3 = await api('POST', '/admin/menu', { token: tokens.manager, body: { ...biryaniBody, addonGroups: [{ id: 'g1', name: 'S', required: false, minSelect: 0, maxSelect: 0, active: true, addons: [{ id: 'dup', name: 'A', price: 1, active: true }, { id: 'dup', name: 'B', price: 2, active: true }] }] } });
    const bad4 = await api('POST', '/admin/menu', { token: tokens.manager, body: { ...biryaniBody, portions: [{ id: 'HALF', label: 'Half', price: -5, active: true }] } });
    return [bad1, bad2, bad3, bad4].every((r) => r.status === 400) || `statuses ${[bad1, bad2, bad3, bad4].map((r) => r.status).join('/')}`;
  });
  await step('Menu config: manager creates a dish with Half/Full portions and two add-on groups', async () => {
    const res = await api('POST', '/admin/menu', { token: tokens.manager, body: biryaniBody });
    biryaniId = res.data?.id;
    if (!biryaniId) return `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
    const pub = await api('GET', `/menu/${biryaniId}`);
    return (pub.data?.portions?.length === 2 && pub.data?.addonGroups?.length === 2) || `public view: ${JSON.stringify(pub.data?.portions)}`;
  });
  await step('Menu config: order without a required portion or required add-on is rejected', async () => {
    const noPortion = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, addonIds: ['add-mild'] }], `cfg-${stamp}-a`));
    const noSpice = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF' }], `cfg-${stamp}-b`));
    return (noPortion.status === 400 && noSpice.status === 400) || `no portion ${noPortion.status}, no spice ${noSpice.status}`;
  });
  await step('Menu config: duplicate, unknown, over-limit and two-from-single-choice add-ons are rejected', async () => {
    const dup = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-mild', 'add-egg', 'add-egg'] }], `cfg-${stamp}-c`));
    const unknown = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-mild', 'add-caviar'] }], `cfg-${stamp}-d`));
    const tooMany = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-mild', 'add-egg', 'add-chicken', 'add-gravy'] }], `cfg-${stamp}-e`));
    const twoSpice = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-mild', 'add-hot'] }], `cfg-${stamp}-f`));
    const badPortion = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'JUMBO', addonIds: ['add-mild'] }], `cfg-${stamp}-g`));
    const all = [dup, unknown, tooMany, twoSpice, badPortion];
    return all.every((r) => r.status === 400) || `statuses ${all.map((r) => r.status).join('/')}`;
  });
  await step('Menu config: Half + Extra Egg + Extra Gravy priced 150+20+25 = 195 each, 390 for two (client prices ignored)', async () => {
    const res = await api('POST', '/orders', cfgOrderBody([
      { menuItemId: biryaniId, quantity: 2, portionId: 'HALF', addonIds: ['add-egg', 'add-gravy', 'add-mild'], unitPrice: 1, totalPrice: 2, price: 1 }
    ], `cfg-${stamp}-ok`));
    cfgOrderId = res.data?.id;
    const line = res.data?.items?.[0];
    if (!line) return `HTTP ${res.status}: ${JSON.stringify(res.json?.error)}`;
    const ok = line.unitPrice === 195 && line.totalPrice === 390 && res.data.subtotal === 390 && line.basePrice === 150 &&
      line.portionId === 'HALF' && line.portionLabel === 'Half' && line.addons?.length === 3 &&
      line.addons.find((a: Json) => a.addonId === 'add-egg')?.price === 20;
    // Takeaway: no service charge; 5% GST on (390 - 10% WELCOME10 when applied) per existing rules.
    return ok || JSON.stringify({ unit: line.unitPrice, total: line.totalPrice, subtotal: res.data.subtotal, base: line.basePrice, addons: line.addons });
  });
  await step('Menu config: Full portion with no extras is 270', async () => {
    const res = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'FULL', addonIds: ['add-hot'] }], `cfg-${stamp}-full`));
    return res.data?.items?.[0]?.unitPrice === 270 || `HTTP ${res.status}, unit ${res.data?.items?.[0]?.unitPrice}, ${JSON.stringify(res.json?.error)}`;
  });
  await step('Menu config: simple items still order without any options', async () => {
    const res = await api('POST', '/orders', cfgOrderBody([{ menuItemId: 'itm-001', quantity: 1 }], `cfg-${stamp}-simple`));
    const portionOnSimple = await api('POST', '/orders', cfgOrderBody([{ menuItemId: 'itm-001', quantity: 1, portionId: 'HALF' }], `cfg-${stamp}-simple2`));
    return (res.status === 201 && !res.data.items[0].portionId && portionOnSimple.status === 400) || `simple ${res.status}, portion on simple ${portionOnSimple.status}`;
  });
  await step('Menu config: kitchen ticket and customer order show the chosen portion and add-ons', async () => {
    const kitchen = await api('GET', '/kitchen/orders', { token: tokens.kitchen });
    const ticket = (kitchen.data || []).find((o: Json) => o.id === cfgOrderId);
    const mine = await api('GET', `/orders/${cfgOrderId}`, { token: tokens.customer });
    const kLine = ticket?.items?.[0];
    return (kLine?.portionLabel === 'Half' && kLine?.addons?.length === 3 && mine.data?.items?.[0]?.addons?.length === 3) || `kitchen line ${JSON.stringify(kLine)?.slice(0, 160)}`;
  });
  await step('Menu config: changing prices or disabling an add-on never changes an existing order', async () => {
    const cfg = JSON.parse(JSON.stringify(biryaniBody));
    cfg.portions[0].price = 999;
    cfg.addonGroups[0].addons[0].active = false; // Extra Egg disabled
    const upd = await api('PUT', `/admin/menu/${biryaniId}`, { token: tokens.manager, body: { portions: cfg.portions, addonGroups: cfg.addonGroups } });
    if (upd.status !== 200) return `update ${upd.status}: ${JSON.stringify(upd.json?.error)}`;
    const order = await api('GET', `/orders/${cfgOrderId}`, { token: tokens.customer });
    const line = order.data?.items?.[0];
    const disabledNow = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-egg', 'add-mild'] }], `cfg-${stamp}-after`));
    const newHalf = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-mild'] }], `cfg-${stamp}-after2`));
    return (line?.unitPrice === 195 && order.data?.subtotal === 390 && disabledNow.status === 400 && newHalf.data?.items?.[0]?.unitPrice === 999) ||
      `old unit ${line?.unitPrice}, disabled egg ${disabledNow.status}, new half ${newHalf.data?.items?.[0]?.unitPrice}`;
  });
  await step('Menu config: payment amount uses the order snapshot, not the new menu price', async () => {
    const pay = await api('POST', '/payments/create', { token: tokens.customer, body: { orderId: cfgOrderId, paymentMethod: 'UPI' } });
    const order = await api('GET', `/orders/${cfgOrderId}`, { token: tokens.customer });
    return (pay.status === 200 && pay.data?.amountInRupees === order.data?.total && order.data?.subtotal === 390) || `pay ${pay.status}, amount ${pay.data?.amountInRupees}, order total ${order.data?.total}, subtotal ${order.data?.subtotal}`;
  });
  await step('Menu config: invoice lines carry the portion and add-on snapshot and match the order', async () => {
    const gen = await api('POST', `/billing/generate/${cfgOrderId}`, { token: tokens.staff });
    const inv = gen.data?.invoice;
    const order = (await api('GET', `/orders/${cfgOrderId}`, { token: tokens.customer })).data;
    const line = inv?.items?.[0];
    return (line?.portionLabelSnapshot === 'Half' && line?.addonsSnapshot?.length === 3 && line?.unitPriceSnapshot === 195 && inv.grandTotal === order.total) ||
      `invoice line ${JSON.stringify(line)?.slice(0, 200)}, grand ${inv?.grandTotal} vs ${order?.total}`;
  });
  await step('Menu config: adding a configured dish to an open order validates and prices it', async () => {
    const dineIn = await api('POST', '/orders', {
      token: tokens.customer,
      headers: { 'Idempotency-Key': `cfg-${stamp}-dine` },
      body: { orderType: 'Dine-in', tableNumber: 'Table 03', customerName: 'Config Guest', customerPhone: '+91 9700000001', customerEmail: `config.guest.${stamp}@example.com`, paymentMethod: 'Pay at Exit', items: [{ menuItemId: 'itm-001', quantity: 1 }] }
    });
    const id = dineIn.data?.id;
    const bad = await api('POST', `/orders/${id}/items`, { token: tokens.customer, body: { items: [{ menuItemId: biryaniId, quantity: 1 }] } });
    const good = await api('POST', `/orders/${id}/items`, { token: tokens.customer, body: { items: [{ menuItemId: biryaniId, quantity: 1, portionId: 'FULL', addonIds: ['add-chicken', 'add-hot'] }] } });
    const added = good.data?.items?.find((i: Json) => i.menuItemId === biryaniId);
    return (bad.status === 400 && added?.unitPrice === 330 && added?.isAddon === true) || `bad ${bad.status}, good ${good.status}, unit ${added?.unitPrice}, ${JSON.stringify(good.json?.error)}`;
  });
  await step('Menu config: staff POS order and staff add-items support configured dishes', async () => {
    const pos = await api('POST', '/admin/orders', { token: tokens.manager, body: { orderType: 'Takeaway', customerName: 'POS Config', paymentMethod: 'Cash', items: [{ menuItemId: biryaniId, quantity: 2, portionId: 'FULL', addonIds: ['add-gravy', 'add-mild'] }] } });
    const line = pos.data?.items?.[0];
    if (line?.unitPrice !== 295) return `POS ${pos.status}, unit ${line?.unitPrice}, ${JSON.stringify(pos.json?.error)}`;
    const add = await api('POST', `/admin/orders/${pos.data.id}/items`, { token: tokens.manager, body: { itemsToAdd: [{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-hot'] }] } });
    const addBad = await api('POST', `/admin/orders/${pos.data.id}/items`, { token: tokens.manager, body: { itemsToAdd: [{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF' }] } });
    const added = add.data?.items?.find((i: Json) => i.isAddon);
    return (added?.unitPrice === 999 && addBad.status === 400) || `staff add ${add.status} unit ${added?.unitPrice}, invalid ${addBad.status}`;
  });
  await step('Menu config: Full-only and Half-only dishes accept only their portion', async () => {
    const fullOnly = await api('POST', '/admin/menu', { token: tokens.admin, body: { ...biryaniBody, name: `Full Only ${stamp}`, portions: [{ id: 'FULL', label: 'Full', price: 300, active: true }], addonGroups: [] } });
    const halfOnly = await api('POST', '/admin/menu', { token: tokens.admin, body: { ...biryaniBody, name: `Half Only ${stamp}`, portions: [{ id: 'HALF', label: 'Half', price: 110, active: true }], addonGroups: [] } });
    const f1 = await api('POST', '/orders', cfgOrderBody([{ menuItemId: fullOnly.data?.id, quantity: 1, portionId: 'FULL' }], `cfg-${stamp}-fo1`));
    const f2 = await api('POST', '/orders', cfgOrderBody([{ menuItemId: fullOnly.data?.id, quantity: 1, portionId: 'HALF' }], `cfg-${stamp}-fo2`));
    const h1 = await api('POST', '/orders', cfgOrderBody([{ menuItemId: halfOnly.data?.id, quantity: 1, portionId: 'HALF' }], `cfg-${stamp}-ho1`));
    const h2 = await api('POST', '/orders', cfgOrderBody([{ menuItemId: halfOnly.data?.id, quantity: 1, portionId: 'FULL' }], `cfg-${stamp}-ho2`));
    return (f1.data?.items?.[0]?.unitPrice === 300 && f2.status === 400 && h1.data?.items?.[0]?.unitPrice === 110 && h2.status === 400) ||
      `full-only ${f1.status}/${f2.status}, half-only ${h1.status}/${h2.status}`;
  });
  await step('Menu config: removing all portions and add-ons turns the dish back into a simple item', async () => {
    const upd = await api('PUT', `/admin/menu/${biryaniId}`, { token: tokens.admin, body: { portions: [], addonGroups: [] } });
    const res = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1 }], `cfg-${stamp}-cleared`));
    return (upd.status === 200 && res.data?.items?.[0]?.unitPrice === 200) || `update ${upd.status}, order ${res.status} unit ${res.data?.items?.[0]?.unitPrice}`;
  });
  await step('Menu config: same order with different add-ons gets a different idempotency fingerprint', async () => {
    const key = `cfg-${stamp}-fp`;
    await api('PUT', `/admin/menu/${biryaniId}`, { token: tokens.admin, body: { portions: biryaniBody.portions, addonGroups: biryaniBody.addonGroups } });
    const first = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-mild'] }], key));
    const changed = await api('POST', '/orders', cfgOrderBody([{ menuItemId: biryaniId, quantity: 1, portionId: 'HALF', addonIds: ['add-hot'] }], key));
    return (first.status === 201 && changed.status === 409) || `first ${first.status}, changed choices with same key ${changed.status}`;
  });

  // ---- Workflow 10: users, roles, privileges and access control ----
  const me = async (token: string) => (await api('GET', '/auth/me', { token })).data;

  await step('Access: overview lists the five predefined roles and all sections (Super Admin)', async () => {
    const res = await api('GET', '/manager/access', { token: tokens.manager });
    const names = (res.data?.roles || []).map((r: Json) => r.name);
    return (JSON.stringify(names) === JSON.stringify(['Owner', 'Manager', 'Staff', 'Kitchen Staff', 'Delivery Staff']) && res.data?.sections?.length >= 15) || `${res.status} ${JSON.stringify(names)}`;
  });
  await step('Access: non-admin roles cannot open user/role/access management', async () => {
    const s1 = await api('GET', '/manager/access', { token: tokens.staff });
    const s2 = await api('GET', '/manager/employees', { token: tokens.kitchen });
    return (s1.status === 403 && s2.status === 403) || `staff ${s1.status}, kitchen ${s2.status}`;
  });
  await step('Access: existing accounts get default privileges from their role (no stored field needed)', async () => {
    const [o, m, s, k, d] = await Promise.all([me(tokens.admin), me(tokens.manager), me(tokens.staff), me(tokens.kitchen), me(tokens.delivery)]);
    const ok = o.effectivePrivilege === 'SUPER_ADMIN' && m.effectivePrivilege === 'SUPER_ADMIN' &&
      s.effectivePrivilege === 'USER' && k.effectivePrivilege === 'USER' && d.effectivePrivilege === 'USER' &&
      !o.privilege && !s.privilege;
    return ok || JSON.stringify([o, m, s, k, d].map((u) => `${u.role}:${u.effectivePrivilege}`));
  });
  await step('Access: default section access per role', async () => {
    const [s, k, d] = await Promise.all([me(tokens.staff), me(tokens.kitchen), me(tokens.delivery)]);
    const ok = s.access.POS === 'FULL' && s.access.MENU === 'VIEW' && s.access.DASHBOARD === 'NONE' && s.access.USERS === 'NONE' &&
      k.access.KITCHEN === 'FULL' && k.access.ORDERS === 'VIEW' && k.access.POS === 'NONE' &&
      d.access.DELIVERY === 'FULL' && d.access.ORDERS === 'VIEW' && d.access.MENU === 'NONE';
    return ok || JSON.stringify({ staff: s.access, kitchen: k.access, delivery: d.access });
  });
  await step('Access: View Access reads but cannot modify, even via direct API calls', async () => {
    const read = await api('GET', '/admin/menu', { token: tokens.staff });
    const write = await api('POST', '/admin/menu/categories', { token: tokens.staff, body: { name: 'Staff Attempt' } });
    const toggle = await api('PATCH', '/admin/menu/itm-001/toggle-availability', { token: tokens.staff });
    const invWrite = await api('POST', '/inventory/wastage', { token: tokens.kitchen, body: { inventoryItemId: 'inv-001', quantity: 1, reason: 'x' } });
    return (read.status === 200 && write.status === 403 && write.json?.error?.code === 'VIEW_ONLY_ACCESS' && toggle.status === 403 && invWrite.status === 403) ||
      `read ${read.status}, write ${write.status}/${write.json?.error?.code}, toggle ${toggle.status}, kitchen inventory write ${invWrite.status}`;
  });
  await step('Access: No Access sections are blocked; Full Access sections work', async () => {
    const dash = await api('GET', '/admin/dashboard', { token: tokens.staff });
    const cust = await api('GET', '/admin/customers', { token: tokens.kitchen });
    const pos = await api('POST', '/admin/orders', { token: tokens.staff, body: { orderType: 'Takeaway', customerName: 'Access POS', paymentMethod: 'Cash', items: [{ menuItemId: 'itm-001', quantity: 1 }] } });
    const deliveryOrders = await api('GET', '/admin/orders', { token: tokens.delivery });
    return (dash.status === 403 && dash.json?.error?.code === 'FORBIDDEN' && cust.status === 403 && (pos.status === 201 || pos.status === 200) && deliveryOrders.status === 200) ||
      `dashboard ${dash.status}, kitchen customers ${cust.status}, staff POS ${pos.status}, delivery orders ${deliveryOrders.status}`;
  });

  const accessUser = `acl_user_${stamp.slice(-6)}`;
  let accessUserId = '';
  let accessUserToken = '';
  await step('Access: Super Admin creates a Staff user with custom section overrides; summary resolves correctly', async () => {
    const created = await api('POST', '/manager/employees', {
      token: tokens.manager,
      body: { firstName: 'Access', lastName: 'Tester', username: accessUser, email: `${accessUser}@example.com`, phone: `97${stamp.slice(-8)}`, password: 'Acc3ss!Pass', confirmPassword: 'Acc3ss!Pass', role: 'STAFF', privilege: 'USER', sectionAccess: { MENU: 'FULL', BOOKINGS: 'NONE' } }
    });
    accessUserId = created.data?.id;
    if (!accessUserId) return `create ${created.status}: ${JSON.stringify(created.json?.error)}`;
    accessUserToken = await login(accessUser, 'Acc3ss!Pass');
    const u = await me(accessUserToken);
    const menuWrite = await api('POST', '/admin/menu/categories', { token: accessUserToken, body: { name: `ACL Cat ${stamp.slice(-4)}` } });
    const bookings = await api('GET', '/admin/bookings', { token: accessUserToken });
    return (u.access.MENU === 'FULL' && u.access.BOOKINGS === 'NONE' && u.access.POS === 'FULL' && menuWrite.status === 201 && bookings.status === 403) ||
      `access ${JSON.stringify(u?.access)}, menu write ${menuWrite.status}, bookings ${bookings.status}`;
  });
  await step('Access: permission changes apply immediately and can be reset to role defaults', async () => {
    const upd = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.manager, body: { sectionAccess: { BOOKINGS: 'FULL' } } });
    const bookings = await api('GET', '/admin/bookings', { token: accessUserToken });
    const reset = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.manager, body: { sectionAccess: null } });
    const u = await me(accessUserToken);
    return (upd.status === 200 && bookings.status === 200 && reset.status === 200 && u.access.MENU === 'VIEW' && Object.keys(u.sectionAccess || {}).length === 0) ||
      `update ${upd.status}, bookings ${bookings.status}, reset ${reset.status}, menu ${u?.access?.MENU}`;
  });
  await step('Access: a User cannot escalate privileges or edit access through the API', async () => {
    const selfEscalate = await api('PUT', `/manager/employees/${accessUserId}`, { token: accessUserToken, body: { privilege: 'SUPER_ADMIN' } });
    const otherEscalate = await api('PUT', `/manager/employees/usr-staff-alias-001`, { token: tokens.staff, body: { privilege: 'SUPER_ADMIN', sectionAccess: { USERS: 'FULL' } } });
    const roleTemplate = await api('PUT', '/manager/access/roles/STAFF', { token: tokens.staff, body: { access: { DASHBOARD: 'FULL' } } });
    const createAdmin = await api('POST', '/manager/employees', { token: tokens.kitchen, body: { firstName: 'X', lastName: 'Y', username: 'xy_attack', email: 'xy@example.com', phone: '9800000001', password: 'Att4ck!Pass', confirmPassword: 'Att4ck!Pass', role: 'MANAGER' } });
    const all = [selfEscalate, otherEscalate, roleTemplate, createAdmin];
    return all.every((r) => r.status === 403) || `statuses ${all.map((r) => r.status).join('/')}`;
  });
  await step('Access: Super Admins cannot change their own role, privilege or access', async () => {
    const managerId = (await me(tokens.manager)).id;
    const demote = await api('PUT', `/manager/employees/${managerId}`, { token: tokens.manager, body: { privilege: 'USER' } });
    const role = await api('PUT', `/manager/employees/${managerId}`, { token: tokens.manager, body: { role: 'STAFF' } });
    const deactivate = await api('PATCH', `/manager/employees/${managerId}/status`, { token: tokens.manager, body: { status: 'INACTIVE' } });
    return (demote.status === 403 && demote.json?.error?.code === 'CANNOT_CHANGE_OWN_ACCESS' && role.status === 403 && deactivate.status >= 400) ||
      `demote ${demote.status}/${demote.json?.error?.code}, role ${role.status}, deactivate ${deactivate.status}`;
  });
  await step('Access: only an Owner can assign the Owner role or modify Owner accounts', async () => {
    const promote = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.manager, body: { role: 'ADMIN' } });
    const editOwner = await api('PUT', '/manager/employees/usr-admin-001', { token: tokens.manager, body: { privilege: 'USER' } });
    const ownerPromotes = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.admin, body: { role: 'ADMIN' } });
    const after = await me(accessUserToken);
    return (promote.status === 403 && editOwner.status === 404 && ownerPromotes.status === 200 && after.role === 'ADMIN' && after.effectivePrivilege === 'USER') ||
      `manager promote ${promote.status}, manager edit owner ${editOwner.status}, owner promote ${ownerPromotes.status}, after ${after?.role}/${after?.effectivePrivilege}`;
  });
  await step('Access: invalid sections, levels and privileges are rejected', async () => {
    const badSection = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.admin, body: { sectionAccess: { SECRET_ADMIN: 'FULL' } } });
    const badLevel = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.admin, body: { sectionAccess: { MENU: 'ROOT' } } });
    const badPrivilege = await api('PUT', `/manager/employees/${accessUserId}`, { token: tokens.admin, body: { privilege: 'GOD' } });
    const badRoleTemplate = await api('PUT', '/manager/access/roles/STAFF', { token: tokens.admin, body: { access: { MENU: 'EVERYTHING' } } });
    const all = [badSection, badLevel, badPrivilege, badRoleTemplate];
    return all.every((r) => r.status === 400) || `statuses ${all.map((r) => r.status).join('/')}`;
  });
  await step('Access: editing a role template changes access for users relying on it', async () => {
    const before = await api('GET', '/admin/dashboard', { token: tokens.staff });
    const overview = await api('GET', '/manager/access', { token: tokens.manager });
    const staffAccess = overview.data.roles.find((r: Json) => r.code === 'STAFF').access;
    const upd = await api('PUT', '/manager/access/roles/STAFF', { token: tokens.manager, body: { access: { ...staffAccess, DASHBOARD: 'VIEW' } } });
    const after = await api('GET', '/admin/dashboard', { token: tokens.staff });
    const audit = await api('GET', '/admin/audit-logs', { token: tokens.manager });
    const audited = JSON.stringify(audit.data || '').includes('ROLE_ACCESS_UPDATED');
    await api('PUT', '/manager/access/roles/STAFF', { token: tokens.manager, body: { access: staffAccess } });
    return (before.status === 403 && upd.status === 200 && after.status === 200 && audited) || `before ${before.status}, update ${upd.status}, after ${after.status}, audited ${audited}`;
  });
  await step('Access: the last active Super Admin cannot be demoted, deactivated or removed', async () => {
    // Leave the Owner as the only Super Admin, then try to remove that status via the rules engine.
    const managerId = (await me(tokens.manager)).id;
    const demoteManager = await api('PUT', `/manager/employees/${managerId}`, { token: tokens.admin, body: { privilege: 'USER' } });
    const { AccessControlService } = await import('../server/services/accessControlService.ts');
    const { UserRepository } = await import('../server/repositories/userRepository.ts');
    const owner = (await UserRepository.findById('usr-admin-001'))!;
    const otherSuperAdmin = { id: 'usr-external-auditor', role: 'ADMIN', status: 'ACTIVE', email: 'x@example.com' } as any;
    const codes: string[] = [];
    for (const change of [{ privilege: 'USER' as const }, { status: 'INACTIVE' }, { deleting: true }, { role: 'STAFF' }]) {
      try {
        await AccessControlService.assertChangeAllowed(otherSuperAdmin, owner, change);
        codes.push('allowed');
      } catch (err: any) {
        codes.push(err.code);
      }
    }
    await api('PUT', `/manager/employees/${managerId}`, { token: tokens.admin, body: { privilege: 'SUPER_ADMIN' } });
    return (demoteManager.status === 200 && codes.every((c) => c === 'LAST_SUPER_ADMIN')) || `demote manager ${demoteManager.status}, rule results ${codes.join(',')}`;
  });
  await step('Access: deactivated users lose access immediately', async () => {
    const deact = await api('PATCH', `/manager/employees/${accessUserId}/status`, { token: tokens.admin, body: { status: 'INACTIVE' } });
    const blocked = await api('GET', '/admin/orders', { token: accessUserToken });
    return (deact.status === 200 && (blocked.status === 401 || blocked.status === 403)) || `deactivate ${deact.status}, request ${blocked.status}`;
  });

  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n--- API WORKFLOWS: ${results.length - failed} PASSED, ${failed} FAILED ---`);
  return { passed: results.length - failed, failed, results };
}
