# Database & Schema Architecture — ABC Hotel

## 1. Entity-Relationship Model (ERD)

```
+------------------------+          +--------------------------+
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
+------------------------+
```

---

## 2. Table Specifications

### Users
- `id` (PK, string)
- `firstName` (string)
- `lastName` (string)
- `email` (string, Unique, Index)
- `phone` (string)
- `passwordHash` (string, bcrypt hashed)
- `role` (ENUM: 'CUSTOMER' | 'ADMIN')
- `status` (ENUM: 'ACTIVE' | 'SUSPENDED')

### Dining Tables
- `id` (PK, string)
- `tableNumber` (string, e.g. "Table 01")
- `capacity` (int, 2, 4, 6, 8 seats)
- `location` (ENUM: 'Window View' | 'Center Terrace' | 'Private Booth' | 'Garden Side' | 'VIP Section')
- `status` (ENUM: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE')

### Table Bookings
- `id` (PK, string)
- `bookingReference` (string, Unique Index, e.g. "BK-20260925-00125")
- `userId` (FK -> Users.id)
- `tableId` (FK -> Tables.id)
- `bookingDate` (string, `YYYY-MM-DD`)
- `startTime` (string, `HH:mm`)
- `endTime` (string, `HH:mm`)
- `guestCount` (int)
- `status` (ENUM: 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED')
