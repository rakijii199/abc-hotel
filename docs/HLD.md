# High-Level Design (HLD) — ABC Hotel & Restaurant

## 1. System Overview
**ABC Hotel** is an enterprise-grade hospitality and culinary web platform designed to provide guests with table reservation management, gourmet food ordering, real-time kitchen tracking, and staff operations administration.

---

## 2. Layered Architecture

```
+-------------------------------------------------------------------------+
|                         PRESENTATION LAYER                              |
|   React SPA + TypeScript + Vite + Tailwind CSS + Context Providers      |
|   (AuthContext, CartContext, ToastContext)                              |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTPS / REST JSON API
                                     v
+-------------------------------------------------------------------------+
|                         APPLICATION SERVER (Express.js)                 |
|   - Rate Limiting Middleware (authRateLimiter)                          |
|   - Authentication Middleware (JWT Bearer Verification)                 |
|   - Role-Based Authorization Guard (requireRole: CUSTOMER, ADMIN)       |
|   - Schema Input Validation Middleware (Zod Engine)                     |
|   - Global JSON Error Normalizer                                        |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         CONTROLLER LAYER                                |
|   AuthController | MenuController | TableController                     |
|   BookingController | OrderController | AdminController                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         DOMAIN & BUSINESS SERVICE LAYER                 |
|   AuthService: Password Hashing (bcrypt), Token Lifecycle               |
|   BookingService: Capacity Validation, Operating Hours, Atomic Lock     |
|   OrderService: Server-Side Price Verification, GST Calculation         |
|   AdminService: Operational Metrics, Dispatch Workflow                  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         DATA ACCESS & REPOSITORY LAYER                  |
|   UserRepository | RestaurantRepository | TableRepository               |
|   BookingRepository | MenuRepository | OrderRepository                  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         RELATIONAL PERSISTENCE ENGINE                   |
|   Normalized In-Memory Relational Engine with ACID-like isolation,      |
|   Unique Key Indices (email, bookingReference, orderNumber), Mutex Lock |
+-------------------------------------------------------------------------+
```

---

## 3. Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | High rendering performance, strict type safety, modular component lifecycle. |
| **Styling & Design** | Tailwind CSS v4 | Clean luxury hotel aesthetic, mobile-responsive layout, zero runtime overhead. |
| **Backend Framework** | Node.js + Express.js | Robust REST routing, full-stack middleware pipelines, high throughput. |
| **Authentication** | JWT (JSON Web Tokens) + bcrypt | Secure credential hashing and stateless authorization headers. |
| **Validation** | Zod | Runtime schema validation across API payloads and parameters. |
| **Concurrency Control** | In-Memory Mutex Lock Engine | Eliminates double-booking race conditions during simultaneous customer checkout. |
| **Documentation** | OpenAPI 3.0 / Swagger | Standardized REST API contracts and interactive client explorer. |

---

## 4. Key Subsystems & Design Principles

### 4.1 Table Reservation Subsystem
- **Time Slotting**: Bookings are reserved in 2-hour increments within operating hours (`09:00` to `23:00`).
- **Conflict Prevention**: Overlap detection guarantees `!(newEnd <= existingStart || newStart >= existingEnd)` across active reservations for any given table.
- **Atomic Locking**: Locks key `booking-lock-${tableId}-${date}` during insertion.

### 4.2 Food Ordering & Pricing Subsystem
- **Zero Frontend Calculation Trust**: Item unit prices and sums are strictly pulled from the database repository.
- **Taxes & Surcharges**: Calculates 5% GST and standard ₹40 service fee server-side.
- **State Machine Transitions**: `PLACED ➔ CONFIRMED ➔ PREPARING ➔ READY ➔ COMPLETED`.

### 4.3 Role-Based Access Control (RBAC)
- **Customer**: Access to personal profile, booking reservation, menu ordering, and personal order tracking.
- **Admin**: Staff dashboard metrics, order dispatch management, table reservation overrides, and menu catalog management.
