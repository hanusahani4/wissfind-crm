# WissFind Marketplace Backend

This version is database-backed. The Angular customer catalog does **not** seed or
fall back to dummy products, reviews, orders or seller/admin rows.

## Database

Create a MySQL database:

```sql
CREATE DATABASE wissfind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Set environment variables before starting:

```text
DB_URL=jdbc:mysql://localhost:3306/wissfind?useSSL=false&serverTimezone=Asia/Kolkata&allowPublicKeyRetrieval=true
DB_USERNAME=root
DB_PASSWORD=your_password

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRATION_MS=86400000

UPLOAD_DIR=uploads/products

# Local testing only:
OTP_EXPOSE_DEV=true

# Production:
OTP_EXPOSE_DEV=false
```

No database password is stored in the project.

## Real customer registration

```text
Angular
  -> POST /api/auth/otp/send
  -> OTP verification
  -> POST /api/auth/register
  -> MySQL users row is created
  -> JWT returned
```

The OTP is randomly generated and stored in MySQL. The current local development
mode prints/returns the OTP so the flow can be tested without an SMS provider.
For production, connect the `sendOtp()` method to your SMS provider and set
`OTP_EXPOSE_DEV=false`.

## Seller onboarding

```text
CUSTOMER
  -> POST /api/sellers/applications
  -> ADMIN /api/sellers/applications
  -> approve/reject
  -> approved user's role becomes SELLER
```

There are no demo seller/customer records.

## Real seller products

Seller endpoints:

```text
GET    /api/products/seller
POST   /api/products
PUT    /api/products/{id}
DELETE /api/products/{id}
PATCH  /api/products/{id}/stock
POST   /api/products/{id}/images
```

Product images are actual multipart files. Each image is validated as an image
and limited to 5 MB. Files are stored under `UPLOAD_DIR`, and are served from:

```text
/uploads/products/<filename>
```

A product can have multiple images; the first image is used as the primary image.

New products are `PENDING` and therefore do not appear in the customer catalog
until an admin approves them.

Admin endpoints:

```text
GET   /api/sellers/applications
PATCH /api/sellers/applications/{id}/approve
PATCH /api/sellers/applications/{id}/reject

GET   /api/products/admin
PATCH /api/products/{id}/approve
PATCH /api/products/{id}/reject

GET   /api/orders
```

## Customer catalog

```text
GET /api/products
GET /api/products/{id}
GET /api/categories/tree
GET /api/reviews/product/{productId}
POST /api/reviews/product/{productId}
```

The Angular `ProductService` loads the real backend catalog. If the backend is
unavailable it shows an empty catalog instead of silently showing fake products.

## Run

Backend:

```bash
mvn clean spring-boot:run
```

Angular:

```bash
cd angular
npm install
npm start
```

Angular expects:

```text
http://localhost:8080/api
```

## Role UI

Customer:
- shopping/catalog
- product detail
- cart
- checkout
- orders
- returns
- AI shopping
- reviews

Seller:
- onboarding status
- product add/edit/delete
- multiple image upload
- inventory
- seller orders
- logout

Admin:
- seller onboarding approval/rejection
- product approval/rejection
- marketplace orders
- logout

Buttons are not merely hidden: backend endpoints are protected by JWT role
authorization as well.

## Important production items

- Connect an SMS provider before production OTP.
- Use HTTPS.
- Store uploads in S3/object storage rather than local disk for multiple
  production servers.
- Add payment webhook idempotency and Razorpay signature verification.
- Use Flyway/Liquibase migrations instead of `ddl-auto=update`.
- Add rate limiting for OTP and authentication endpoints.


## Razorpay checkout
The backend uses Razorpay Standard Checkout. Set these environment variables before starting Spring Boot:
- `RAZORPAY_KEY_ID` — test/live Key ID
- `RAZORPAY_KEY_SECRET` — server-only Key Secret
- `RAZORPAY_WEBHOOK_SECRET` — optional webhook secret

The Angular app only receives the Key ID. The Key Secret is never sent to the browser. The backend creates the Razorpay Order and verifies the payment signature before marking an internal order `PAID`. COD is stored as `COD_PENDING`, so customers/sellers/admin can distinguish COD from online payment.

For local testing use Razorpay Test Mode keys. For production, use HTTPS and configure the webhook endpoint `/api/payments/razorpay/webhook`.
