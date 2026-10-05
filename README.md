# ABC Hotel — Full-Stack Hotel & Restaurant Application

**ABC Hotel** is a luxury hotel and restaurant web platform built with a layered architecture, atomic table reservation locking, server-side price calculation, interactive order tracking, and administration management.

---

## 🌟 Key Features

1. **Guest Authentication & RBAC**:
   - Secure registration, login, profile management, and password update.
   - Passwords hashed using `bcryptjs` (cost factor 10).
   - Stateless JWT tokens for API authorization.
   - Dual-role support: **Customer** and **Hotel Staff / Admin**.

2. **Table Reservation Engine**:
   - Live availability floor plan with visual seat capacity and ambiance locations (Terrace, Window View, Private Booth).
   - Atomic Mutex Lock prevents race conditions and double bookings.
   - Unique booking reference generation (`BK-YYYYMMDD-XXXXX`).
   - Operating hours (09:00 - 23:00) and 2-hour dining slot duration calculation.

3. **Gourmet Food Ordering & Cart**:
   - Category filtering (Starters, Main Course, Breads, Rice, Desserts, Beverages).
   - Instant search and dietary filters (Veg / Non-Veg / Spicy).
   - Server-side price calculation (never trusts frontend prices).
   - Promo voucher support (`WELCOME10` for 10% discount).
   - Support for **Dine-in**, **Takeaway**, and **Room Service**.

4. **Live Order Lifecycle Tracking**:
   - Real-time status stepper: `PLACED ➔ CONFIRMED ➔ PREPARING ➔ READY ➔ COMPLETED`.
   - Tax breakdown (5% GST) and printable tax invoice receipt.

5. **Staff Administration Command Center**:
   - Real-time dining revenue and active order metrics.
   - Kitchen dispatch manager with 1-click status transitions.
   - Table reservation status manager (Confirm, Seat, Complete).
   - Menu catalog CRUD with live In-Stock / Sold-Out toggles.

6. **Automated QA Test Suite & OpenAPI Explorer**:
   - Built-in interactive test runner executing unit and integration assertions.
   - Interactive OpenAPI 3.0 REST endpoint explorer.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend**: Node.js, Express.js, TypeScript (`tsx server.ts`).
- **Database**: Normalized relational database engine with transactional locking.
- **Validation**: Zod schema validation.
- **Security**: bcryptjs, jsonwebtoken, sliding-window rate limiting.

---

## 🚀 Quick Start & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Full-Stack Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000` with Express handling `/api/*` and Vite handling client routes.

### 3. Build for Production
```bash
npm run build
npm start
```

---

## 🔑 Default Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Customer** | `john.doe@example.com` | `Customer@ABC2026!` |
| **Admin** | `admin@abchotel.com` | `Admin@ABC2026!` |

*(One-click quick login buttons are also provided in the UI)*
