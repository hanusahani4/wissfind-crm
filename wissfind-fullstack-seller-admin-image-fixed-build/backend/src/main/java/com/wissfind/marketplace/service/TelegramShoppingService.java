package com.wissfind.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.repo.ProductRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Customer-facing Telegram product discovery. Checkout is intentionally handed
 * off to the existing website so existing auth, cart, variant, COD and payment
 * validation remain authoritative.
 */
@Service
public class TelegramShoppingService {
    private static final int MAX_PRODUCTS = 10;
    private final ProductRepository products;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private final String token;
    private final String websiteUrl;

    public TelegramShoppingService(
            ProductRepository products,
            ObjectMapper mapper,
            @Value("${app.telegram.bot-token:}") String token,
            @Value("${app.telegram.website-url:}") String websiteUrl) {
        this.products = products;
        this.mapper = mapper;
        this.token = token == null ? "" : token.trim();
        this.websiteUrl = normalizeWebsiteUrl(websiteUrl);
    }

    public void showHome(String chatId) {
        List<String> categories = products.findDistinctLiveCategories(Product.Status.LIVE, 0)
                .stream().filter(Objects::nonNull).map(String::trim)
                .filter(s -> !s.isBlank()).distinct().toList();

        List<List<Map<String, String>>> rows = new ArrayList<>();
        for (String category : categories) {
            rows.add(List.of(callbackButton(category, "cat:" + slug(category))));
        }
        if (!websiteUrl.isBlank()) rows.add(List.of(urlButton("🛍 Browse all products", websiteUrl)));
        String message = categories.isEmpty()
                ? "Welcome to WissFind Fashion 👋\n\nNo in-stock products are available right now. Please check back later."
                : (websiteUrl.isBlank()
                    ? "Welcome to WissFind Fashion 👋\n\nChoose a category below. Website checkout link is not configured yet."
                    : "Welcome to WissFind Fashion 👋\n\nChoose a category or browse the full collection.");
        sendMessage(chatId, message, keyboard(rows));
    }

    public boolean handleCommand(String chatId, String text) {
        if (text == null) return false;
        String command = text.trim().split("\\s+", 2)[0].toLowerCase(Locale.ROOT);
        if (command.equals("/shop") || command.equals("/help")
                || command.equals("/categories") || command.equals("/products")) {
            showHome(chatId);
            return true;
        }
        return false;
    }

    public void handleCallback(JsonNode callback) {
        String callbackId = callback.path("id").asText("");
        String data = callback.path("data").asText("");
        String chatId = callback.path("message").path("chat").path("id").asText("");
        if (callbackId.isBlank() || chatId.isBlank() || data.length() > 64) return;

        if (data.equals("shop:home")) {
            answerCallback(callbackId, "Loading categories");
            showHome(chatId);
            return;
        }

        if (data.startsWith("cat:")) {
            String categorySlug = data.substring(4);
            String categoryName = products.findDistinctLiveCategories(Product.Status.LIVE, 0).stream()
                    .filter(name -> slug(name).equals(categorySlug)).findFirst().orElse("");
            List<Product> matches = categoryName.isBlank() ? List.of()
                    : products.findByCategoryIgnoreCaseAndStatusAndStockGreaterThan(
                            categoryName, Product.Status.LIVE, 0).stream().limit(MAX_PRODUCTS).toList();
            answerCallback(callbackId, matches.isEmpty() ? "No products found" : "Products loaded");
            sendProductList(chatId, matches);
            return;
        }

        if (data.startsWith("prod:")) {
            long id;
            try {
                id = Long.parseLong(data.substring(5));
            } catch (NumberFormatException ex) {
                answerCallback(callbackId, "Invalid product");
                return;
            }

            Optional<Product> found = products.findById(id)
                    .filter(p -> p.status == Product.Status.LIVE && p.stock > 0);
            if (found.isEmpty()) {
                answerCallback(callbackId, "Product unavailable");
                sendMessage(chatId, "This product is no longer available. Please browse the latest collection.",
                        keyboard(List.of(List.of(callbackButton("⬅️ Categories", "shop:home")))));
                return;
            }

            Product p = found.get();
            answerCallback(callbackId, "Opening product");
            String text = "🛍 " + safe(p.name)
                    + (p.brand == null || p.brand.isBlank() ? "" : "\nBrand: " + safe(p.brand))
                    + "\nPrice: ₹" + String.format(Locale.ROOT, "%.2f", p.price)
                    + "\nIn stock: " + p.stock
                    + "\n\nView sizes/colours and complete checkout securely on WissFind.";
            List<List<Map<String, String>>> rows = new ArrayList<>();
            if (!websiteUrl.isBlank()) {
                rows.add(List.of(urlButton("🛒 View & Buy on WissFind", websiteUrl + "/product/" + p.id)));
            }
            rows.add(List.of(callbackButton("⬅️ Categories", "shop:home")));
            if (websiteUrl.isBlank()) text += "\n\nWebsite checkout is not configured yet. Please contact the store admin.";
            Map<String, Object> replyKeyboard = keyboard(rows);
            String imageUrl = productImage(p);
            if (!imageUrl.isBlank()) {
                sendPhoto(chatId, imageUrl, text, replyKeyboard);
            } else {
                sendMessage(chatId, text, replyKeyboard);
            }
            return;
        }

        answerCallback(callbackId, "Unknown action");
    }

    private List<Product> liveProducts() {
        return products.findLiveInStock(Product.Status.LIVE, 0, PageRequest.of(0, 50))
                .getContent().stream()
                .filter(p -> p.status == Product.Status.LIVE && p.stock > 0)
                .toList();
    }

    private void sendProductList(String chatId, List<Product> matches) {
        if (matches.isEmpty()) {
            sendMessage(chatId, "No in-stock products were found in this category.",
                    keyboard(List.of(List.of(callbackButton("⬅️ Categories", "shop:home")))));
            return;
        }
        sendMessage(chatId, "Choose a product. Price and availability are checked again on the website.", null);
        for (Product p : matches) {
            String label = truncate(safe(p.name) + " — ₹"
                    + String.format(Locale.ROOT, "%.2f", p.price), 60);
            Map<String, Object> productKeyboard = keyboard(List.of(
                    List.of(callbackButton(label, "prod:" + p.id))));
            String imageUrl = productImage(p);
            String caption = "🛍 " + safe(p.name) + "\\nPrice: ₹"
                    + String.format(Locale.ROOT, "%.2f", p.price)
                    + "\\nIn stock: " + p.stock;
            if (!imageUrl.isBlank()) {
                sendPhoto(chatId, imageUrl, caption, productKeyboard);
            } else {
                sendMessage(chatId, caption, productKeyboard);
            }
        }
        sendMessage(chatId, "Browse another category:",
                keyboard(List.of(List.of(callbackButton("⬅️ Categories", "shop:home")))));
    }

    private void answerCallback(String callbackId, String text) {
        if (token.isBlank()) return;
        try {
            post("answerCallbackQuery", Map.of("callback_query_id", callbackId,
                    "text", truncate(text, 180)));
        } catch (Exception ignored) {
            // Callback may have expired; do not interrupt shopping.
        }
    }

    private void sendMessage(String chatId, String text, Map<String, Object> keyboard) {
        if (token.isBlank() || chatId == null || chatId.isBlank()) return;
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("chat_id", chatId);
            payload.put("text", truncate(text, 3900));
            if (keyboard != null) payload.put("reply_markup", keyboard);
            post("sendMessage", payload);
        } catch (Exception ex) {
            // Isolate Telegram errors from seller order notifications.
        }
    }

    private void sendPhoto(String chatId, String photoUrl, String caption, Map<String, Object> keyboard) {
        if (token.isBlank() || chatId == null || chatId.isBlank() || photoUrl == null || photoUrl.isBlank()) return;
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("chat_id", chatId);
            payload.put("photo", photoUrl);
            payload.put("caption", truncate(caption, 1000));
            if (keyboard != null) payload.put("reply_markup", keyboard);
            post("sendPhoto", payload);
        } catch (Exception ex) {
            // If Telegram cannot fetch an image URL, keep shopping usable with text fallback.
            sendMessage(chatId, caption + "\\n(Image preview unavailable)", keyboard);
        }
    }

    private String productImage(Product product) {
        String candidate = product == null ? "" : safe(product.image);
        if ((candidate.isBlank() || candidate.equalsIgnoreCase("null"))
                && product != null && product.images != null && !product.images.isEmpty()) {
            candidate = safe(product.images.get(0));
        }
        if (candidate.isBlank() || candidate.equalsIgnoreCase("null")) return "";
        if (candidate.startsWith("//")) candidate = "https:" + candidate;
        else if (candidate.startsWith("/") && !websiteUrl.isBlank()) candidate = websiteUrl + candidate;
        try {
            URI uri = URI.create(candidate);
            String scheme = uri.getScheme();
            return uri.isAbsolute() && scheme != null
                    && (scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http"))
                    ? candidate : "";
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }

    private void post(String method, Object payload) throws Exception {
        String body = mapper.writeValueAsString(payload);
        HttpRequest request = HttpRequest.newBuilder(
                URI.create("https://api.telegram.org/bot" + token + "/" + method))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("Telegram API HTTP " + response.statusCode());
        }
        JsonNode result = mapper.readTree(response.body());
        if (!result.path("ok").asBoolean(false)) {
            throw new IllegalStateException("Telegram API request failed");
        }
    }

    private Map<String, Object> keyboard(List<List<Map<String, String>>> rows) {
        return Map.of("inline_keyboard", rows);
    }

    private Map<String, String> callbackButton(String text, String data) {
        return Map.of("text", truncate(text, 60), "callback_data", data);
    }

    private Map<String, String> urlButton(String text, String url) {
        return Map.of("text", text, "url", url);
    }

    private String normalizeWebsiteUrl(String value) {
        if (value == null || value.isBlank()) return "";
        String url = value.trim();
        if (!(url.startsWith("https://") || url.startsWith("http://localhost")
                || url.startsWith("http://127.0.0.1"))) {
            throw new IllegalArgumentException("Telegram website URL must use HTTPS outside local development");
        }
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    private String slug(String value) {
        String valueSlug = value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        return truncate(valueSlug, 45);
    }

    private String safe(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n\\t]", " ").trim();
    }

    private String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
