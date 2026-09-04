package com.wissfind.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class TwoFactorOtpService {
    private static final Logger log = LoggerFactory.getLogger(TwoFactorOtpService.class);

    private final RestClient client;
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String baseUrl;
    private final String sendPath;
    private final String verifyPath;

    public TwoFactorOtpService(
            ObjectMapper mapper,
            @Value("${app.otp.api-key:}") String apiKey,
            @Value("${app.otp.base-url:https://api.2factor.in/v1}") String baseUrl,
            @Value("${app.otp.send-path:/sms/otp}") String sendPath,
            @Value("${app.otp.verify-path:/sms/otp/verify}") String verifyPath) {
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.baseUrl = trimTrailingSlash(baseUrl);
        this.sendPath = normalizePath(sendPath);
        this.verifyPath = normalizePath(verifyPath);

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public String send(String phone) {
        requireConfigured();
        log.info("OTP send requested for phone ending {}", lastFour(phone));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("apiKey", apiKey);
        payload.put("to", phone);

        JsonNode response = post(sendPath, payload);
        String uid = firstText(response, "UID", "uid", "sessionId", "session_id", "Details", "details");

        log.info("2Factor OTP send response received: sessionPresent={}", uid != null && !uid.isBlank());
        if (uid == null || uid.isBlank()) {
            String message = firstText(response, "message", "Message", "error", "Error");
            throw new IllegalArgumentException(message == null || message.isBlank()
                    ? "OTP provider did not return a verification session."
                    : "Unable to send OTP: " + message);
        }
        return uid;
    }

    public void verify(String sessionId, String otp) {
        requireConfigured();
        if (sessionId == null || sessionId.isBlank() || otp == null || !otp.matches("\\d{4,8}")) {
            throw new IllegalArgumentException("Invalid OTP.");
        }

        log.info("OTP verification requested");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("apiKey", apiKey);
        payload.put("UID", sessionId);
        payload.put("otp", otp.trim());

        JsonNode response = post(verifyPath, payload);
        if (isSuccessfulVerification(response)) {
            log.info("2Factor OTP verification succeeded");
            return;
        }

        String message = firstText(response, "message", "Message", "error", "Error", "Details", "details");
        log.warn("2Factor OTP verification failed: {}", message == null ? "provider rejected OTP" : message);
        throw new IllegalArgumentException("Invalid or expired OTP");
    }

    private JsonNode post(String path, Map<String, Object> payload) {
        String url = baseUrl + normalizePath(path);
        try {
            String body = client.post()
                    .uri(url)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .body(payload)
                    .retrieve()
                    .body(String.class);

            if (body == null || body.isBlank()) {
                throw new IllegalArgumentException("OTP service returned an empty response.");
            }

            JsonNode response = mapper.readTree(body);
            if (response == null || !response.isObject()) {
                throw new IllegalArgumentException("OTP service returned an invalid response.");
            }
            return response;
        } catch (RestClientResponseException e) {
            log.error("2Factor HTTP error: status={}, path={}, body={}",
                    e.getStatusCode().value(), path, e.getResponseBodyAsString());
            if (e.getStatusCode().value() == 401 || e.getStatusCode().value() == 403) {
                throw new IllegalArgumentException("OTP provider rejected the API credentials or request.");
            }
            if (e.getStatusCode().value() == 429) {
                throw new IllegalArgumentException("OTP service rate limit reached. Please try again later.");
            }
            throw new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("2Factor connection error: {}", e.getMessage(), e);
            throw new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
        }
    }

    private boolean isSuccessfulVerification(JsonNode response) {
        if (response.path("verified").isBoolean()) return response.path("verified").asBoolean();
        if (response.path("isValid").isBoolean()) return response.path("isValid").asBoolean();
        if (response.path("success").isBoolean()) return response.path("success").asBoolean();

        String status = firstText(response, "Status", "status");
        String details = firstText(response, "Details", "details");
        return "Success".equalsIgnoreCase(status)
                && ("OTP Matched".equalsIgnoreCase(details) || "verified".equalsIgnoreCase(details));
    }

    private String firstText(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode value = node.get(name);
            if (value != null && !value.isNull()) {
                String text = value.asText("");
                if (!text.isBlank()) return text;
            }
        }
        return null;
    }

    private void requireConfigured() {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("TWOFACTOR_API_KEY is not configured");
            throw new IllegalStateException("OTP provider is not configured. Set TWOFACTOR_API_KEY.");
        }
    }

    private String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private String normalizePath(String value) {
        if (value == null || value.isBlank()) return "";
        return value.startsWith("/") ? value : "/" + value;
    }

    private String lastFour(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(phone.length() - 4);
    }
}
