package com.wissfind.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/**
 * Real Indian PIN validation with multiple independent public providers.
 *
 * Providers are queried in parallel so a temporary outage/rate-limit at one
 * provider does not block checkout. Successful responses are cached briefly
 * to avoid hitting external services repeatedly while typing/editing an address.
 * City/town entered by the customer is intentionally NOT compared with the PIN.
 */
@Service
public class PincodeService {
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(4);
    private static final long CACHE_TTL_MS = 10 * 60 * 1000L;

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public Map<String, Object> lookup(String pincode) {
        String pin = normalize(pincode);
        if (!pin.matches("\\d{6}")) {
            throw new IllegalArgumentException("PIN code must be exactly 6 digits");
        }

        CacheEntry cached = cache.get(pin);
        if (cached != null && cached.expiresAt > System.currentTimeMillis()) {
            return cached.value;
        }
        cache.remove(pin, cached);

        List<CompletableFuture<Map<String, Object>>> calls = List.of(
                call("IndiaPost", "https://api.postalpincode.in/pincode/" + pin, this::parseIndiaPost),
                call("IndiaPostFallback", "https://www.postalpincode.in/api/pincode/" + pin, this::parseIndiaPost),
                call("Zippopotam", "https://api.zippopotam.us/IN/" + pin, this::parseZippopotam)
        );

        CompletableFuture<Map<String, Object>> winner = new CompletableFuture<>();
        AtomicCounter failures = new AtomicCounter(calls.size());

        for (CompletableFuture<Map<String, Object>> call : calls) {
            call.whenComplete((value, error) -> {
                if (error == null && value != null && Boolean.TRUE.equals(value.get("valid"))) {
                    winner.complete(value);
                } else if (failures.decrementAndGet() == 0) {
                    winner.completeExceptionally(new IllegalStateException("ALL_PIN_PROVIDERS_FAILED"));
                }
            });
        }

        try {
            Map<String, Object> result = winner.get(REQUEST_TIMEOUT.plusSeconds(1).toMillis(), TimeUnit.MILLISECONDS);
            cache.put(pin, new CacheEntry(result, System.currentTimeMillis() + CACHE_TTL_MS));
            return result;
        } catch (Exception ignored) {
            throw new IllegalArgumentException("PIN_SERVICE_UNAVAILABLE");
        }
    }

    private CompletableFuture<Map<String, Object>> call(
            String provider, String url, java.util.function.Function<JsonNode, Map<String, Object>> parser) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .header("User-Agent", "WissFind/1.0")
                .GET().build();

        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .orTimeout(REQUEST_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)
                .thenApply(response -> {
                    if (response.statusCode() < 200 || response.statusCode() >= 300) {
                        throw new CompletionException(new IllegalStateException(provider + " HTTP " + response.statusCode()));
                    }
                    try {
                        JsonNode root = mapper.readTree(response.body());
                        Map<String, Object> result = parser.apply(root);
                        if (result == null || !Boolean.TRUE.equals(result.get("valid"))) {
                            throw new CompletionException(new IllegalArgumentException("PIN not found"));
                        }
                        result.put("provider", provider);
                        return result;
                    } catch (CompletionException e) {
                        throw e;
                    } catch (Exception e) {
                        throw new CompletionException(e);
                    }
                });
    }

    private Map<String, Object> parseIndiaPost(JsonNode root) {
        JsonNode first = root != null && root.isArray() && root.size() > 0 ? root.get(0) : null;
        if (first == null || !"Success".equalsIgnoreCase(first.path("Status").asText())) return null;
        JsonNode offices = first.get("PostOffice");
        if (offices == null || !offices.isArray() || offices.isEmpty()) return null;

        List<String> postOffices = new ArrayList<>();
        String district = null, state = null, deliveryStatus = null;
        for (JsonNode office : offices) {
            if (district == null) district = text(office, "District");
            if (state == null) state = text(office, "State");
            if (deliveryStatus == null) deliveryStatus = text(office, "DeliveryStatus");
            String name = text(office, "Name");
            if (name != null && !postOffices.contains(name)) postOffices.add(name);
        }
        return result(district, state, deliveryStatus, postOffices);
    }

    private Map<String, Object> parseZippopotam(JsonNode root) {
        JsonNode places = root == null ? null : root.get("places");
        if (places == null || !places.isArray() || places.isEmpty()) return null;

        List<String> postOffices = new ArrayList<>();
        String state = null, district = null;
        for (JsonNode place : places) {
            String name = text(place, "place name");
            if (name != null && !postOffices.contains(name)) postOffices.add(name);
            if (state == null) state = text(place, "state");
            if (district == null) district = name;
        }
        return result(district, state, "", postOffices);
    }

    private Map<String, Object> result(String district, String state, String deliveryStatus, List<String> postOffices) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("valid", true);
        out.put("district", district == null ? "" : district);
        out.put("state", state == null ? "" : state);
        out.put("deliveryStatus", deliveryStatus == null ? "" : deliveryStatus);
        out.put("postOffices", postOffices == null ? List.of() : postOffices);
        return out;
    }

    private String normalize(String pincode) {
        return pincode == null ? "" : pincode.replaceAll("\\D", "");
    }

    private String text(JsonNode node, String key) {
        String value = node == null ? null : node.path(key).asText(null);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record CacheEntry(Map<String, Object> value, long expiresAt) {}

    private static final class AtomicCounter {
        private int value;
        AtomicCounter(int value) { this.value = value; }
        synchronized int decrementAndGet() { return --value; }
    }
}
