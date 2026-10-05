/**
 * High-Level Design (HLD) & Low-Level Design (LLD) In-App Documentation Viewer
 */
import React, { useState } from 'react';
import { BookOpen, Layers, Database, Shield, Server, ArrowRight } from 'lucide-react';

export const SystemDocsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'HLD' | 'LLD' | 'DATABASE' | 'SECURITY'>('HLD');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-stone-900 text-white rounded-3xl p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <BookOpen className="w-4 h-4" /> System Architecture & Engineering Specifications
          </div>
          <h1 className="font-serif text-3xl font-bold mt-1">
            ABC Hotel Architectural Documentation
          </h1>
          <p className="text-stone-400 text-xs mt-1">
            Official specifications covering High-Level Design (HLD), Low-Level Design (LLD), Database Relational Model, and Security Protocols.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'HLD', label: '1. High-Level Design (HLD)', icon: Layers },
          { id: 'LLD', label: '2. Low-Level Design (LLD)', icon: Server },
          { id: 'DATABASE', label: '3. Database & ERD Schema', icon: Database },
          { id: 'SECURITY', label: '4. Security Architecture', icon: Shield }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: HLD */}
      {activeTab === 'HLD' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-6 text-stone-700 leading-relaxed text-sm">
          <div className="border-b pb-4">
            <h2 className="font-serif font-bold text-2xl text-stone-900">
              High-Level Design (HLD)
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Multi-tiered, layered enterprise architecture with clean separation of concerns.
            </p>
          </div>

          <div className="p-4 bg-stone-900 text-amber-300 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-stone-800">
{`+-------------------------------------------------------------------------+
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
+-------------------------------------------------------------------------+`}
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="font-serif font-bold text-lg text-stone-900">1. Core Architectural Pillars</h3>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-stone-600">
              <li><strong>Zero Frontend Calculation Trust:</strong> All food pricing, subtotal aggregation, discount voucher validation, and GST computations are enforced strictly on the backend.</li>
              <li><strong>Atomic Double-Booking Prevention:</strong> Booking creation acquires an in-memory Mutex Lock for the `tableId-bookingDate` key to eliminate race conditions during simultaneous customer checkout.</li>
              <li><strong>State Machine Discipline:</strong> Order transitions follow strict sequences: `PLACED ➔ CONFIRMED ➔ PREPARING ➔ READY ➔ COMPLETED`. Orders in preparation cannot be arbitrarily cancelled by clients.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: LLD */}
      {activeTab === 'LLD' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-6 text-stone-700 leading-relaxed text-sm">
          <div className="border-b pb-4">
            <h2 className="font-serif font-bold text-2xl text-stone-900">
              Low-Level Design (LLD) & Sequence Flow
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Component contracts, business validation logic, and sequence execution diagrams.
            </p>
          </div>

          <div className="p-4 bg-stone-900 text-amber-300 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-stone-800">
{`SEQUENCE FLOW: TABLE RESERVATION WITH ATOMIC LOCKING

Customer Browser            BookingController          BookingService           BookingRepository       MutexLock
     |                              |                         |                         |                   |
     |--- 1. POST /api/bookings --->|                         |                         |                   |
     |    (date, time, table, guests)                         |                         |                   |
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
     |<-- 11. 201 Created (BK Ref) -|                         |                         |                   |`}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 space-y-2">
              <h4 className="font-bold text-stone-900 text-sm">BookingService Responsibilities</h4>
              <p className="text-xs text-stone-600">
                • <code>calculateEndTime(start, 120m)</code>: Enforces 2-hour dining windows.<br/>
                • <code>isWithinOperatingHours()</code>: Rejects times outside 09:00 - 23:00.<br/>
                • <code>isPastDateTime()</code>: Guards against past reservation booking.<br/>
                • <code>createBooking()</code>: Runs within atomic mutex closure.
              </p>
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 space-y-2">
              <h4 className="font-bold text-stone-900 text-sm">OrderService Responsibilities</h4>
              <p className="text-xs text-stone-600">
                • <code>createOrder()</code>: Resolves prices from Database catalog.<br/>
                • <code>applyDiscount()</code>: Validates promo vouchers (`WELCOME10`).<br/>
                • <code>updateOrderStatus()</code>: Enforces state machine transitions.<br/>
                • <code>recordPayment()</code>: Logs transaction reference for accounting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: DATABASE */}
      {activeTab === 'DATABASE' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-6 text-stone-700 leading-relaxed text-sm">
          <div className="border-b pb-4">
            <h2 className="font-serif font-bold text-2xl text-stone-900">
              Relational Database Model & ERD
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Normalized schema with foreign key integrity and secondary indices.
            </p>
          </div>

          <div className="p-4 bg-stone-900 text-amber-300 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-stone-800">
{`+------------------------+          +--------------------------+
|         users          |          |          hotels          |
+------------------------+          +--------------------------+
| id: PK, VARCHAR(36)    |          | id: PK, VARCHAR(36)      |
| email: UNIQUE, INDEX   |          | name: VARCHAR(100)       |
| passwordHash: VARCHAR  |          | address: VARCHAR(255)    |
| role: ENUM (CUST, ADM) |          +-------------+------------+
| status: ENUM (ACTIVE)  |                        |
+-----------+------------+                        | 1:1
            |                                     v
            | 1:N                          +--------------------------+
            |                              |       restaurants        |
            v                              +--------------------------+
+------------------------+                 | id: PK, VARCHAR(36)      |
|    table_bookings      |                 | hotelId: FK -> hotels    |
+------------------------+                 | openingTime: "09:00"     |
| id: PK, VARCHAR(36)    |                 | closingTime: "23:00"     |
| bookingRef: UNIQUE     |                 +-------------+------------+
| userId: FK -> users    |                               |
| tableId: FK -> tables  |<------------------------------+ 1:N
| bookingDate: DATE      |                               v
| startTime: TIME        |                 +--------------------------+
| status: ENUM           |                 |          tables          |
+------------------------+                 +--------------------------+
                                           | id: PK, VARCHAR(36)      |
+------------------------+                 | tableNumber: VARCHAR(20) |
|         orders         |                 | capacity: INT (2,4,6,8)  |
+------------------------+                 | location: VARCHAR(50)    |
| id: PK, VARCHAR(36)    |                 +--------------------------+
| orderNumber: UNIQUE    |
| userId: FK -> users    |                 +--------------------------+
| total: INT (Calculated)|                 |        menu_items        |
| status: ENUM           |                 +--------------------------+
| paymentStatus: ENUM    |                 | id: PK, VARCHAR(36)      |
+-----------+------------+                 | categoryId: FK -> cats   |
            | 1:N                          | name: VARCHAR(100)       |
            v                              | price: INT (Currency)    |
+------------------------+                 | available: BOOLEAN       |
|      order_items       |                 +--------------------------+
+------------------------+
| id: PK, VARCHAR(36)    |
| orderId: FK -> orders  |
| menuItemId: FK -> items|
| quantity: INT          |
| unitPrice: INT         |
+------------------------+`}
          </div>
        </div>
      )}

      {/* Tab 4: SECURITY */}
      {activeTab === 'SECURITY' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-6 text-stone-700 leading-relaxed text-sm">
          <div className="border-b pb-4">
            <h2 className="font-serif font-bold text-2xl text-stone-900">
              Security Architecture & Best Practices
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Zero-trust security rules, encryption, and authorization layers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-700" /> Password Hashing
              </h4>
              <p className="text-stone-600 leading-relaxed">
                All customer and administrator passwords are encrypted with industry-standard <strong>bcrypt</strong> (cost factor 10). Plain-text passwords are never logged or stored.
              </p>
            </div>

            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-700" /> Stateless JWT Tokens
              </h4>
              <p className="text-stone-600 leading-relaxed">
                Authentication relies on signed <strong>JSON Web Tokens (JWT)</strong> transmitted via standard HTTP <code>Authorization: Bearer &lt;token&gt;</code> headers.
              </p>
            </div>

            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-700" /> Input Schema Validation
              </h4>
              <p className="text-stone-600 leading-relaxed">
                All client payloads pass through strict <strong>Zod schemas</strong> before touching business controllers, preventing injection attacks and malformed payloads.
              </p>
            </div>

            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-700" /> Role-Based Access Control (RBAC)
              </h4>
              <p className="text-stone-600 leading-relaxed">
                Critical endpoints under <code>/api/admin/*</code> enforce explicit <code>requireRole('ADMIN')</code> middleware, rejecting unauthorized token privileges with 403 Forbidden.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
