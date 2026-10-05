# Low-Level Design (LLD) — ABC Hotel & Restaurant

## 1. Class & Module Responsibilities

### 1.1 Controllers
- **`AuthController`**: Handles `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.
- **`BookingController`**: Handles `/api/bookings` (create, get user bookings, cancel, get by id).
- **`OrderController`**: Handles `/api/orders` (create order, get user orders, track order status).
- **`MenuController`**: Handles `/api/menu` (list items with filters, get categories, get single dish).
- **`AdminController`**: Handles `/api/admin/*` (analytics stats, dispatch workflow, menu CRUD).

### 1.2 Services
- **`BookingService`**:
  - `calculateEndTime(startTime: string, durationMinutes: number): string`
  - `isWithinOperatingHours(startTime: string, endTime: string): boolean`
  - `isPastDateTime(dateStr: string, timeStr: string): boolean`
  - `getTableAvailability(params): { tables, operatingHours }`
  - `createBooking(params): Promise<TableBooking>` (Atomic lock wrapper)
- **`OrderService`**:
  - `createOrder(params): Promise<Order>` (Server-side price aggregation)
  - `updateOrderStatus(orderId: string, status: OrderStatus): Order`

---

## 2. Sequence Diagram: Booking Creation

```
Customer Client           BookingController          BookingService           BookingRepository       MutexLock
     |                              |                         |                         |                   |
     |--- 1. POST /api/bookings --->|                         |                         |                   |
     |                              |--- 2. createBooking --->|                         |                   |
     |                              |                         |--- 3. Acquire Lock ------------------------>|
     |                              |                         |    for tableId+date     |                   |
     |                              |                         |<-- Lock Granted ----------------------------|
     |                              |                         |                         |                   |
     |                              |                         |--- 4. Verify Capacity --|                   |
     |                              |                         |--- 5. Verify Hours -----|                   |
     |                              |                         |--- 6. hasOverlap? ----->|                   |
     |                              |                         |<-- False (Available) ---|                   |
     |                              |                         |                         |                   |
     |                              |                         |--- 7. Generate BK Ref --|                   |
     |                              |                         |--- 8. create(booking) ->|                   |
     |                              |                         |                         |                   |
     |                              |                         |--- 9. Release Lock ------------------------>|
     |                              |<-- 10. Booking Result --|                         |                   |
     |<-- 11. 201 Created (BK Ref) -|                         |                         |                   |
```

---

## 3. Validation Rules (Zod Schemas)

| Schema | Key Validations |
| :--- | :--- |
| **`registerSchema`** | Email format, password min 8 characters with lowercase, uppercase, and digit; password confirmation match. |
| **`createBookingSchema`** | Date format `YYYY-MM-DD`, time format `HH:mm`, guest count 1 to 20, valid `tableId`. |
| **`createOrderSchema`** | Order type enum (`Dine-in`, `Takeaway`, `Room Service`), minimum 1 item, table/room conditional validation. |
