# WissFind Telegram Shopping Bot

This feature extends the existing Telegram polling service instead of starting a second `getUpdates` consumer. It keeps the existing seller connection and seller order notifications working while adding customer product discovery.

## Customer flow

1. Customer opens the bot and sends `/start` or `/shop`.
2. Bot shows categories based on currently live products.
3. Customer chooses a category, then a product.
4. Bot shows the product name, indicative base price and stock state.
5. **View & Buy on WissFind** opens the existing product detail page at `/product/{id}`.
6. Customer uses the existing website cart and checkout. The website remains authoritative for authentication, variant/size selection, address, shipping, stock, COD eligibility, order creation and Razorpay verification.

This first version deliberately does not create orders directly from Telegram. The current checkout requires an authenticated website customer and a saved shipping address; bypassing those validations would be unsafe. The bot must not claim an order was placed until the existing website order/payment flow confirms it.

## Configuration

Set these values in the backend environment or ignored local `.env` file. Never commit real tokens or payment secrets.

```dotenv
TELEGRAM_BOT_TOKEN=your_botfather_token
TELEGRAM_BOT_USERNAME=your_bot_username_without_at
TELEGRAM_WEBSITE_URL=https://wissfind.com
TELEGRAM_POLL_MS=3000
TELEGRAM_ORDER_POLL_MS=5000
```

`TELEGRAM_WEBSITE_URL` must be the canonical customer storefront origin. Use `http://localhost:4200` only for local development.

## BotFather setup

1. Open Telegram and chat with [@BotFather](https://t.me/BotFather).
2. Create a bot with `/newbot` (or reuse the existing WissFind seller-notification bot).
3. Copy its token into the backend environment as `TELEGRAM_BOT_TOKEN`.
4. Set `TELEGRAM_BOT_USERNAME` to the bot username without `@`.
5. Start the backend and send `/start` to the bot.
6. Existing seller users can still use the Seller Dashboard's **Connect Telegram** flow. It uses a one-time `/start connect_<token>` deep link.

## Important deployment constraints

- The existing bot uses long polling. Do not set a Telegram webhook for this token while polling is enabled; Telegram does not allow `getUpdates` and a webhook to consume updates simultaneously.
- Run only one application instance with this bot token while the in-memory polling offset is used. Multiple replicas can compete for updates. For horizontal scaling, move polling to one dedicated worker and persist/deduplicate update IDs.
- Product buttons only use server-generated product IDs and configured website URLs. Prices and availability must be checked again on the website.
- The bot only lists `LIVE` products with positive stock, and product detail links open the existing `/product/{id}` route.
- Telegram shopping messages do not collect address, phone, card details, or OTP.
- Existing seller order notification behavior remains in the current `TelegramNotificationService`.

## Smoke test

1. Start MySQL and the backend with the same environment variables used by the website.
2. Run `mvn clean test` from the backend directory, then `mvn spring-boot:run`.
3. Send `/start` to the bot. Verify category buttons appear when live in-stock products exist.
4. Tap a category and then a product. Verify the product name and price appear.
5. Tap **View & Buy on WissFind**. Verify the URL is `TELEGRAM_WEBSITE_URL/product/{id}` and the existing product detail page loads.
6. Add the item to the website cart, sign in, and test checkout with Razorpay Test Mode and COD only where enabled.
7. Verify the seller still receives the existing new-order notification.
8. Test an empty catalogue and an out-of-stock/non-live product. They should not be offered for purchase by the bot.

## Current scope and next step

This is product discovery + website checkout hand-off, not a Telegram-native cart. A Telegram-native cart needs a verified account-linking flow to a WissFind customer, server-side cart persistence, size/color variant selection, and a one-time checkout session exchange. Implement that only after confirming the current website cart/session contract.
