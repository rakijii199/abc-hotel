# 💳 ABC Hotel — Production-Ready Online Payment Module Documentation

---

## 1. System Overview & Architecture

The ABC Hotel payment module is built with a **provider-agnostic payment architecture**, decouples **Payment Status** from **Order Status**, enforces **Server-Side Trusted Amount Calculation**, and requires **Authoritative Backend Verification (HMAC-SHA256)** before confirming online orders.

```
                  ┌──────────────────────────────┐
                  │    PaymentProvider (Interface)│
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                   RazorpayPaymentProvider
```

### Core Architecture Highlights
* **Extensible Abstraction**: All payment operations adhere to the `PaymentProvider` interface. Integrating another gateway (e.g. Stripe, PayU, Cashfree) in the future requires creating a new provider class without touching checkout or order business logic.
* **Payment-First Authoritative Flow**: Frontend callbacks or redirects are **never** trusted as proof of payment. Payment status is only updated after backend HMAC-SHA256 signature verification or webhook validation.
* **Separation of Concerns**:
  * **Order Status**: `PLACED` $\to$ `CONFIRMED` $\to$ `PREPARING` $\to$ `READY` $\to$ `SERVED` $\to$ `WAITING_FOR_PAYMENT` $\to$ `COMPLETED`
  * **Payment Status**: `PENDING` $\to$ `PAID` / `CAPTURED` or `FAILED` / `REFUNDED`
* **Zero Sensitive Data Storage**: Card numbers, CVVs, card PINs, and UPI PINs are handled exclusively inside the payment gateway's secure SDK/iframe. No PCI data touches the application database.

---

## 2. End-to-End Payment Sequence

```
Customer ──> Cart ──> Checkout Selects UPI/Card ──> Backend Creates Unpaid Order (PENDING)
                                                                 │
Customer <── Razorpay Gateway Checkout <── Backend Creates Gateway Order (Server Calculated Total)
    │
Pays on Gateway
    │
    ▼
Frontend Callback ──> POST /api/payments/verify ──> HMAC-SHA256 Signature Verification
                                                                 │
                                                       Valid? ───┴─── Valid
                                                         │              │
                                                       Failed           ▼
                                                         │       Mark Payment CAPTURED
                                                         │       Mark Order PAID & CONFIRMED
                                                         ▼              │
                                                Order Remains PENDING ◄─┘
                                                Customer Can Retry
```

---

## 3. Database Design

### Payment Table (`Payment`)
| Column | Type | Description |
|---|---|---|
| `id` | String (PK) | Internal unique payment ID (`pay-xxx`) |
| `orderId` | String (FK) | Relational reference to `Order.id` |
| `provider` | String | Gateway provider name (`razorpay`, `offline`) |
| `providerOrderId` | String | Gateway order reference (`order_xxx`) |
| `providerPaymentId` | String (Unique Index) | Gateway payment reference (`pay_xxx`) |
| `providerSignature` | String | HMAC SHA256 signature |
| `amount` | Number | Total amount in Rupees |
| `currency` | String | Currency code (`INR`) |
| `paymentMethod` | String | `UPI`, `Card`, `Cash` |
| `status` | String | `CREATED`, `PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `REFUNDED` |
| `failureCode` | String | Gateway error code (if failed) |
| `failureMessage` | String | Error description (if failed) |
| `createdAt` | ISO Timestamp | Payment creation timestamp |
| `updatedAt` | ISO Timestamp | Last modification timestamp |

### PaymentAttempt Table (`PaymentAttempt`)
Tracks complete audit history of payment attempts per order (first failed attempt, retry attempt, final captured payment).

---

## 4. API Reference Contracts

### 1. Create Payment Order
`POST /api/payments/create-order` (Auth Required)
* **Request**:
  ```json
  {
    "orderId": "ord-1727400000-abcd",
    "paymentMethod": "UPI"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "orderId": "ord-1727400000-abcd",
      "orderNumber": "ABC-10245",
      "paymentId": "pay-1727400000-xyz",
      "providerOrderId": "order_Pxxxxxx",
      "amount": 36100,
      "amountInRupees": 361,
      "currency": "INR",
      "keyId": "rzp_test_abchotel_demo",
      "environment": "test"
    }
  }
  ```

### 2. Verify Payment
`POST /api/payments/verify` (Auth Required)
* **Request**:
  ```json
  {
    "orderId": "ord-1727400000-abcd",
    "providerOrderId": "order_Pxxxxxx",
    "providerPaymentId": "pay_Pxxxxxx",
    "providerSignature": "c00f...3f12"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "alreadyProcessed": false,
      "order": { ... },
      "payment": { ... }
    },
    "message": "Payment verified successfully. Order confirmed!"
  }
  ```

### 3. Gateway Webhook
`POST /api/payments/webhook`
* **Headers**: `x-razorpay-signature: <hmac_hex>`
* **Features**: Signature verification & Idempotency. Ignores duplicate events if payment is already marked `CAPTURED`.

### 4. Admin Get All Payments
`GET /api/payments/admin/all` (Admin Auth Required)

### 5. Admin Refund Payment
`POST /api/payments/admin/:id/refund` (Admin Auth Required)

---

## 5. Environment Variables & Credentials

Create `.env` file in application root:

```env
PAYMENT_ENVIRONMENT=test # 'test' or 'production'

# Razorpay Credentials (from Razorpay Dashboard -> API Keys)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
```

---

## 6. Webhook Setup & Idempotency

1. In **Razorpay Dashboard** $\to$ **Settings** $\to$ **Webhooks**:
   * **Webhook URL**: `https://<your-domain>/api/payments/webhook`
   * **Secret**: Set `RAZORPAY_WEBHOOK_SECRET`
   * **Active Events**: `payment.captured`, `payment.failed`, `order.paid`
2. **Idempotency Guarantee**: If the backend receives duplicate webhook payloads for an event that has already been verified and marked `CAPTURED`, it responds with `200 OK` without duplicating audit logs or updating order state twice.

---

## 7. Security Checklist

- [x] **Amount Security**: Client sends only `orderId`. Backend calculates trusted total from DB Menu item prices, taxes, and discounts before generating gateway order.
- [x] **Signature Verification**: Signature checked using `HMAC-SHA256(providerOrderId + "|" + providerPaymentId, keySecret)`.
- [x] **No Hardcoded Secrets**: Secrets loaded strictly from environment variables.
- [x] **Authorization Checks**: Customer can only pay or view status for their own orders.

---

## 8. Production Deployment Checklist

1. [ ] Configure production HTTPS domain.
2. [ ] Complete Razorpay KYC activation and switch account to Live Mode.
3. [ ] Generate live API Keys (`rzp_live_...`) in Razorpay Dashboard.
4. [ ] Set `PAYMENT_ENVIRONMENT=production` in environment variables.
5. [ ] Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in environment variables.
6. [ ] Configure production Webhook endpoint URL in Razorpay Dashboard.
7. [ ] Perform test transaction in Live mode using a real small order (e.g. ₹10) and verify end-to-end reconciliation.
