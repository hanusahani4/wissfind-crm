# WissFind — Angular Ecommerce Starter

Modern fashion + electronics ecommerce UI built with Angular 22 standalone components and Supabase phone/password authentication.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:4200`.

## Supabase setup

1. Create a Supabase project.
2. In `src/app/core/supabase.ts`, replace `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
3. In Supabase Dashboard → Authentication → Providers, enable Phone.
4. Configure an SMS provider if phone confirmation is enabled.
5. For production, configure your site URL and redirect URLs.

Supabase supports phone + password signup/sign-in via `signUp()` and `signInWithPassword()`. See the official docs:
- https://supabase.com/docs/guides/auth/passwords

## App features

- Fashion/electronics product grid
- Category filter + sorting
- Product detail pages
- LocalStorage shopping cart
- Login/signup/logout with Supabase phone + password
- Forgot password via phone OTP and password reset
- Returns & refunds tracking with cancellation/return status timeline persisted in LocalStorage
- Auth guard for `/cart` and `/checkout`
- Checkout demo
- Facebook, X and WhatsApp product sharing
- Native Web Share support for sharing product image + name + link when the browser supports it

## Production notes

- Replace sample Unsplash images with your own product/CDN assets.
- Move products/cart/orders to Supabase tables if persistent multi-device ecommerce is required.
- Add RLS policies for user-owned carts/orders.
- For social previews, serve product-specific Open Graph metadata from a server/SSR route; Facebook/X/WhatsApp generate previews from the shared URL.
- Never put a Supabase `service_role` key in the Angular browser bundle; use only the publishable/anon key client-side.

## Latest UI update

- Desktop content width increased to 1340px to reduce left/right whitespace.
- Added ecommerce header search and always-visible cart.
- Cart displays item count and subtotal.
- Header collapses for tablet/mobile.
- Added product search and centered View all products button.

- Desktop layout is now fluid up to 1600px with only a 16px side gutter, so it fills wide monitors instead of staying in a narrow centered column.

## Updated cart
The cart now includes product discount, coupon discount (WISS10), shipping, GST (18% demo), platform fee, handling fee, convenience fee, optional gift wrapping, savings, and total payable. Checkout uses the same CartService calculation.


## WissFind AI Shopping Agent

Open `/ai-shop` or click **AI Shop** in the header.

Examples:
- `₹60,000 mein college + gaming setup chahiye.`
- `₹30,000 ka best phone chahiye.`
- `₹10,000 mein audio setup bana do.`

The current implementation is a local catalog agent: it parses natural-language requirements,
ranks products from the Angular product database, applies compatibility/bundle rules, checks the
budget, and can replace the cart with the recommended bundle. This keeps the app runnable without
an external AI key. The service is isolated in `core/ai-shopping.service.ts` so it can later be
replaced/augmented with a Spring Boot LLM orchestration endpoint without changing the UI.

## Role-based access

The Angular app now uses `user_metadata.role` from Supabase:

- `CUSTOMER` → storefront, product pages, cart, checkout, orders, returns and customer tools.
- `SELLER` → `/seller` Seller Center only.
- `ADMIN` → `/admin` Admin Marketplace only.

A missing/unknown role is treated as `CUSTOMER`. Seller/admin roles must be assigned by an administrator/backend process; do not allow customers to set these roles themselves.

The seller and admin workspaces no longer contain links back to the customer storefront. Route guards redirect a signed-in user to the workspace for their own role if they try to open another role's routes.

## Seller Center functionality

Seller product management now supports add/edit/delete, search, status filters, stock adjustment, local persistence, order status progression, return/refund progression, shipment tracking actions, payout request feedback, coupon creation, dispute response actions, and pagination across list views.

## Admin Marketplace functionality

Admin onboarding supports seller approval/rejection, search and pagination. Admin order and return workspaces have search/pagination, and all role workspaces use role-aware route protection.
