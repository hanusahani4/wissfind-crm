# WissFind Telegram Shopping Bot

This feature extends the existing Telegram long-polling service rather than starting a second `getUpdates` consumer. Seller account linking and seller order notifications remain in `TelegramNotificationService`.

## Customer flow

1. Customer sends `/start` or `/shop`.
2. Bot displays categories derived from currently live, in-stock products.
3. Customer chooses a product and sees its name, base price and stock.
4. **View & Buy on WissFind** opens the existing Angular product route `/product/{id}`.
5. Customer completes cart, sign-in, shipping, COD or Razorpay checkout on the website.

This version is product discovery plus website checkout hand-off. It does not create orders directly from Telegram or implement a Telegram-native cart. The website remains authoritative for authentication, variant selection, stock, shipping, order creation, COD eligibility and payment verification.

## Configuration

Set these values in the backend environment or ignored local `.env` file:

```dotenv
TELEGRAM_BOT_TOKEN=your_botfather_token
TELEGRAM_BOT_USERNAME=your_bot_username_without_at
TELEGRAM_WEBSITE_URL=https://your-canonical-storefront-domain
TELEGRAM_POLL_MS=3000
TELEGRAM_ORDER_POLL_MS=5000
```

Use your actual production storefront domain for `TELEGRAM_WEBSITE_URL`; do not confuse it with the backend API base URL. The configured URL must use HTTPS in production.

## Setup

1. Open [@BotFather](https://t.me/BotFather) and create a bot with `/newbot`, or reuse the existing seller-notification bot.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in the backend environment. Never commit real secrets.
3. Set `TELEGRAM_WEBSITE_URL` to the actual customer-facing Angular storefront URL.
4. Deploy/restart the backend and open the bot in Telegram.
5. Send `/start` or `/shop`, choose a category and a product, then open its website link.
6. Existing sellers can continue using the Seller Dashboard's **Connect Telegram** button, which uses a one-time `/start connect_<token>` deep link.

## Important deployment constraints

- This bot uses long polling. Do not configure a Telegram webhook for the same token while `getUpdates` polling is active.
- Run only one backend instance polling this bot token until update offsets are persisted and a single-consumer strategy is configured.
- The bot lists only `LIVE` products with positive stock. Prices and availability must be rechecked by the website checkout.
- Telegram messages must never ask for passwords, OTPs, card details or full payment credentials.
- Test seller notifications after deployment to ensure existing seller linking and order notifications still work.

## Smoke tests

From the backend directory run:

```bash
mvn clean test
```

Then start the backend using the same environment as the existing website and test:

- `/start` and `/shop` display categories or a useful empty-catalogue message.
- Category selection displays only live, in-stock products.
- Product selection displays details and opens `TELEGRAM_WEBSITE_URL/product/{id}`.
- Existing website sign-in, cart, variant selection, shipping and checkout work.
- Razorpay Test Mode verifies online payment; COD is offered only when the website allows it.
- Existing seller Telegram connection and new-order notifications continue working.
- Empty catalogue and out-of-stock products cannot be purchased from the bot.

## Next phase

A Telegram-native cart requires a verified Telegram-to-WissFind customer account-linking flow, server-side cart ownership, size/colour variant selection and a one-time checkout session exchange. Implement that only after confirming the current website session/cart contract.
