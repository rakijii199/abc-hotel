# Menu Item Configuration (portions & add-ons)

Every menu item can optionally offer portion sizes and add-on groups. Items
without a configuration behave exactly as before.

## Data model (`shared/menuConfig.ts`, stored on the menu item document)

```ts
portions?:    { id: 'HALF' | 'FULL'; label; price; active }[]
addonGroups?: { id; name; required; minSelect; maxSelect /* 0 = any */; active;
                addons: { id; name; price; active }[] }[]
```

* Configured from **Admin → Menu → Add/Edit dish → Portions & Add-ons** (ADMIN and
  MANAGER only; enforced by the existing `/api/admin/menu` routes). The form shows a
  live customer preview.
* Validation (UI and server, same code): unique ids, prices > 0 for portions and ≥ 0
  for add-ons, `minSelect ≤ maxSelect`, required groups need enough active add-ons.
* Disable portions, groups or add-ons with their **Enabled** switch instead of deleting
  them; orders keep their own snapshot either way.

## Pricing rule (one implementation for UI and server)

```
unit price = selected portion price (or the item's base price) + selected add-on prices
line total = unit price × quantity
```

Subtotal, WELCOME10 discount, 5 % GST and the service charge are then applied by the
existing billing rules. The browser previews prices with `resolveItemConfiguration`;
the server recomputes them in `server/services/orderLinePricing.ts` for every ordering
path (customer order, add items, staff POS, staff add items) and ignores any price sent
by the client.

Selections are rejected (HTTP 400, customer-readable message) when a required portion
or group is missing, an add-on is unknown/disabled/duplicated, a group's limit is
exceeded, or a portion is sent for an item without portions.

## Order line snapshot

Order items store `portionId`, `portionLabel`, `basePrice`, `addons[]` (group, id, name,
price at order time), `unitPrice`, `totalPrice`. Invoices copy them as
`portionLabelSnapshot` / `addonsSnapshot`. Payments and "add items" use these
snapshots, so later menu price changes never alter existing orders or invoices.

## API

Order line (customer `/api/orders`, `/api/orders/:id/items`; staff `/api/admin/orders`,
`/api/admin/orders/:id/items`):

```json
{ "menuItemId": "itm-…", "quantity": 2, "portionId": "HALF", "addonIds": ["add-egg", "add-gravy"] }
```

## Notes

* Cart lines are keyed by item + portion + add-ons; the cart refreshes item data from the
  live menu and flags lines whose choices are no longer offered.
* Inventory deduction still uses the item's recipe per unit regardless of portion size.
* Tests: `npm run test:api` (configuration workflow section).
