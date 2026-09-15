package com.wissfind.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wissfind.marketplace.entity.Order;
import com.wissfind.marketplace.entity.OrderItem;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.OrderRepository;
import com.wissfind.marketplace.repo.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Service
public class TelegramNotificationService {
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

    public String getConnectUrl(Long sellerId) {
        if (token.isBlank() || username.isBlank()) {
            throw new IllegalStateException("Telegram notifications are not configured");
        }
        return "https://t.me/" + username + "?start=seller_" + sellerId;
    }

    /** Telegram bot receives /start seller_<sellerId> and links the private chat to that seller. */
    @Scheduled(fixedDelayString = "${app.telegram.poll-ms:3000}")
    public void pollTelegramUpdates() {
        if (token.isBlank()) return;
        try {
            String url = "https://api.telegram.org/bot" + token + "/getUpdates?timeout=1&allowed_updates=%5B%22message%22%5D&offset=" + updateOffset;
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return;
            JsonNode root = mapper.readTree(response.body());
            if (!root.path("ok").asBoolean(false)) return;
            for (JsonNode update : root.path("result")) {
                updateOffset = Math.max(updateOffset, update.path("update_id").asLong() + 1);
                JsonNode message = update.path("message");
                String text = message.path("text").asText("").trim();
                if (!text.startsWith("/start")) continue;
                String payload = text.length() > 6 ? text.substring(6).trim() : "";
                if (payload.startsWith("seller_")) {
                    try {
                        Long sellerId = Long.parseLong(payload.substring("seller_".length()));
                        String chatId = message.path("chat").path("id").asText("");
                        if (!chatId.isBlank()) linkSeller(sellerId, chatId);
                    } catch (NumberFormatException ignored) { }
                }
            }
        } catch (Exception ignored) {
            // Telegram must never break the marketplace request flow.
        }
    }

    private void linkSeller(Long sellerId, String chatId) {
        users.findById(sellerId).filter(u -> u.role == User.Role.SELLER).ifPresent(seller -> {
            seller.telegramChatId = chatId;
            users.save(seller);
            sendText(chatId, "✅ WissFind Telegram notifications connected.\nNew customer orders will be sent here automatically.");
        });
    }

    /** Sends only recent unsent orders so connecting Telegram does not replay an old order history. */
    @Scheduled(fixedDelayString = "${app.telegram.order-poll-ms:5000}")
    public void sendPendingOrderNotifications() {
        if (token.isBlank()) return;
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(10));
        for (Order order : orders.findAllByOrderByCreatedAtDesc()) {
            if (order.id == null || order.telegramNotificationSent || order.createdAt == null || order.createdAt.isBefore(cutoff)) continue;
            if (order.createdAt.isBefore(startedAt.minus(Duration.ofMinutes(1)))) continue;
            if (order.seller == null || order.seller.telegramChatId == null || order.seller.telegramChatId.isBlank()) continue;
            if (sendText(order.seller.telegramChatId, formatOrder(order))) {
                order.telegramNotificationSent = true;
                orders.save(order);
            }
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
            String json = mapper.createObjectNode().put("chat_id", chatId).put("text", text).toString();
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot" + token + "/sendMessage"))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() / 100 == 2 && mapper.readTree(response.body()).path("ok").asBoolean(false);
        } catch (Exception ignored) {
            return false;
        }
    }

    private String safe(Object value) {
        return value == null ? "-" : String.valueOf(value).replace("<", "").replace(">", "");
    }
}
