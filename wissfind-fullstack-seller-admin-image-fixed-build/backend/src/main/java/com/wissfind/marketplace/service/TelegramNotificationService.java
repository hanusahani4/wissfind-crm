package com.wissfind.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wissfind.marketplace.entity.Order;
import com.wissfind.marketplace.entity.OrderItem;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.OrderRepository;
import com.wissfind.marketplace.repo.UserRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TelegramNotificationService {
    private static final Logger log = LoggerFactory.getLogger(TelegramNotificationService.class);
    private static final Pattern START_COMMAND = Pattern.compile("^/start(?:@\\w+)?(?:\\s+(.+))?$", Pattern.CASE_INSENSITIVE);

    private final UserRepository users;
    private final OrderRepository orders;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final String token;
    private final String username;
    private volatile long updateOffset = 0;
    private final Instant startedAt = Instant.now();

    public TelegramNotificationService(UserRepository users, OrderRepository orders, ObjectMapper mapper,
                                       @Value("${app.telegram.bot-token:}") String token,
                                       @Value("${app.telegram.bot-username:}") String username) {
        this.users = users;
        this.orders = orders;
        this.mapper = mapper;
        this.token = token == null ? "" : token.trim();
        this.username = username == null ? "" : username.trim().replaceFirst("^@", "");
    }

    @PostConstruct
    public void validateTelegramConfiguration() {
        if (token.isBlank() || username.isBlank()) {
            log.warn("Telegram notifications are disabled: bot token or username is missing");
            return;
        }
        log.info("Telegram notifications enabled for @{}", username);
        try {
            JsonNode root = callGet("getMe");
            if (root.path("ok").asBoolean(false)) {
                log.info("Telegram bot authenticated successfully as @{}", root.path("result").path("username").asText(username));
            } else {
                log.warn("Telegram getMe failed: {}", root.path("description").asText("unknown error"));
            }

            JsonNode webhook = callGet("getWebhookInfo");
            if (webhook.path("ok").asBoolean(false)) {
                String webhookUrl = webhook.path("result").path("url").asText("");
                if (!webhookUrl.isBlank()) {
                    log.warn("Telegram webhook is configured at {}. getUpdates polling will not receive updates until the webhook is removed.", webhookUrl);
                } else {
                    log.info("Telegram webhook is not configured; getUpdates polling is active");
                }
            }
        } catch (Exception e) {
            log.warn("Telegram startup check failed: {}", e.getMessage());
        }
    }

    /** Creates a one-time secret deep-link token for the currently authenticated seller. */
    public synchronized String getConnectUrl(Long sellerId) {
        if (token.isBlank() || username.isBlank()) {
            throw new IllegalStateException("Telegram notifications are not configured");
        }
        User seller = users.findById(sellerId)
                .filter(u -> u.role == User.Role.SELLER)
                .orElseThrow(() -> new IllegalArgumentException("Seller not found"));
        String connectToken = UUID.randomUUID().toString().replace("-", "");
        seller.telegramConnectToken = connectToken;
        users.save(seller);
        log.info("Generated Telegram connection token for sellerId={}", sellerId);
        return "https://t.me/" + username + "?start=connect_" + connectToken;
    }

    /** Telegram bot receives /start connect_<one-time-token> and links the private chat to that seller. */
    @Scheduled(fixedDelayString = "${app.telegram.poll-ms:3000}")
    public void pollTelegramUpdates() {
        if (token.isBlank()) return;
        try {
            String url = "https://api.telegram.org/bot" + token
                    + "/getUpdates?timeout=1&allowed_updates=%5B%22message%22%5D&offset=" + updateOffset;
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                log.warn("Telegram getUpdates HTTP {}", response.statusCode());
                return;
            }

            JsonNode root = mapper.readTree(response.body());
            if (!root.path("ok").asBoolean(false)) {
                log.warn("Telegram getUpdates failed: {}", root.path("description").asText("unknown error"));
                return;
            }

            int processed = 0;
            for (JsonNode update : root.path("result")) {
                updateOffset = Math.max(updateOffset, update.path("update_id").asLong() + 1);
                processed++;
                handleUpdate(update);
            }
            if (processed > 0) {
                log.info("Telegram polling received {} update(s); next offset={}", processed, updateOffset);
            }
        } catch (Exception e) {
            log.warn("Telegram polling failed: {}", e.getMessage());
        }
    }

    private void handleUpdate(JsonNode update) {
        JsonNode message = update.path("message");
        if (message.isMissingNode()) return;

        String text = message.path("text").asText("").trim();
        if (text.isBlank()) return;

        Matcher matcher = START_COMMAND.matcher(text);
        if (!matcher.matches()) return;

        String payload = matcher.group(1) == null ? "" : matcher.group(1).trim();
        String chatId = message.path("chat").path("id").asText("");
        if (chatId.isBlank()) return;

        if (!payload.startsWith("connect_")) {
            sendText(chatId, "Please use the Connect Telegram button from your WissFind seller dashboard to link this account.");
            log.info("Received plain /start from Telegram chatId={} without a connection payload", chatId);
            return;
        }

        String connectToken = payload.substring("connect_".length()).trim();
        if (connectToken.isBlank()) {
            sendText(chatId, "The WissFind connection link is incomplete. Please generate a new link from your seller dashboard.");
            return;
        }

        log.info("Received Telegram connection request for chatId={} tokenPrefix={}", chatId, tokenPrefix(connectToken));
        linkSeller(connectToken, chatId);
    }

    private void linkSeller(String connectToken, String chatId) {
        users.findByTelegramConnectToken(connectToken)
                .filter(seller -> seller.role == User.Role.SELLER)
                .ifPresentOrElse(seller -> {
                    users.findByTelegramChatId(chatId)
                            .filter(existing -> !existing.id.equals(seller.id))
                            .ifPresent(existing -> {
                                existing.telegramChatId = null;
                                users.save(existing);
                                log.info("Unlinked Telegram chatId={} from previous sellerId={}", chatId, existing.id);
                            });

                    seller.telegramChatId = chatId;
                    seller.telegramConnectToken = null;
                    users.save(seller);
                    log.info("Telegram connected successfully for sellerId={} chatId={}", seller.id, chatId);
                    sendText(chatId, "✅ WissFind Telegram notifications connected.\nNew customer orders will be sent here automatically.");
                }, () -> {
                    log.warn("Telegram connection token not found or expired: tokenPrefix={}", tokenPrefix(connectToken));
                    sendText(chatId, "❌ This WissFind connection link is invalid or expired. Please click Connect Telegram again from your seller dashboard.");
                });
    }

    /** Sends only recent unsent orders so connecting Telegram does not replay an old order history. */
    @Scheduled(fixedDelayString = "${app.telegram.order-poll-ms:5000}")
    @Transactional
    public void sendPendingOrderNotifications() {
        if (token.isBlank()) return;
        try {
            Instant cutoff = Instant.now().minus(Duration.ofMinutes(10));
            for (Order order : orders.findAllByOrderByCreatedAtDesc()) {
                if (order.id == null || order.telegramNotificationSent || order.createdAt == null || order.createdAt.isBefore(cutoff)) continue;
                if (order.createdAt.isBefore(startedAt.minus(Duration.ofMinutes(1)))) continue;
                if (order.seller == null || order.seller.telegramChatId == null || order.seller.telegramChatId.isBlank()) continue;
                if (sendText(order.seller.telegramChatId, formatOrder(order))) {
                    order.telegramNotificationSent = true;
                    orders.save(order);
                    log.info("Telegram order notification sent for orderId={} sellerId={}", order.id, order.seller.id);
                }
            }
        } catch (Exception e) {
            log.warn("Telegram order notification polling failed: {}", e.getMessage());
        }
    }

    private String formatOrder(Order order) {
        StringBuilder b = new StringBuilder();
        b.append("🛒 NEW ORDER — WISSFIND\n\n");
        b.append("Order: #").append(order.orderNumber).append('\n');
        if (order.customer != null) {
            b.append("Customer: ").append(safe(order.customer.name)).append('\n');
            b.append("Phone: ").append(safe(order.customer.phone)).append('\n');
        }
        b.append("\n📦 ITEMS\n");
        for (OrderItem item : order.items) {
            b.append("• ").append(safe(item.name))
                    .append(" × ").append(item.quantity)
                    .append(" — ₹").append(item.price).append('\n');
        }
        b.append("\n💰 Total: ₹").append(order.total).append('\n');
        b.append("💳 Payment: ").append(safe(order.paymentMethod)).append('\n');
        b.append("🚚 Status: ").append(safe(order.deliveryStatus)).append('\n');
        b.append("\n📍 Delivery\n").append(safe(order.address));
        return b.toString();
    }

    private boolean sendText(String chatId, String text) {
        try {
            String json = mapper.createObjectNode()
                    .put("chat_id", chatId)
                    .put("text", text)
                    .toString();
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot" + token + "/sendMessage"))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = mapper.readTree(response.body());
            if (response.statusCode() / 100 == 2 && root.path("ok").asBoolean(false)) return true;
            log.warn("Telegram sendMessage failed HTTP {}: {}", response.statusCode(), root.path("description").asText("unknown error"));
            return false;
        } catch (Exception e) {
            log.warn("Telegram sendMessage failed: {}", e.getMessage());
            return false;
        }
    }

    private JsonNode callGet(String method) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot" + token + "/" + method))
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        return mapper.readTree(response.body());
    }

    private String tokenPrefix(String connectToken) {
        return connectToken.length() <= 8 ? "********" : connectToken.substring(0, 8) + "...";
    }

    private String safe(Object value) {
        return value == null ? "-" : String.valueOf(value).replace("<", "").replace(">", "");
    }
}
