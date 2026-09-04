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

import java.net.URI;

@Service
public class TwoFactorOtpService {
    private static final Logger log = LoggerFactory.getLogger(TwoFactorOtpService.class);

    public record SendResult(String sessionId, String otp, String status, String details) {}

    private final RestClient client;
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String baseUrl;
    private final String sendPath;
    private final String verifyPath;
    private final String templateName;

    public TwoFactorOtpService(
            ObjectMapper mapper,
            @Value("${app.otp.api-key:}") String apiKey,
            @Value("${app.otp.base-url:https://2factor.in}") String baseUrl,
            @Value("${app.otp.send-path:/API/V1/{api_key}/SMS/{phone_number}/AUTOGEN2/{otp_template_name}}") String sendPath,
            @Value("${app.otp.verify-path:/API/V1/{api_key}/SMS/VERIFY/{session_id}/{otp}}") String verifyPath,
            @Value("${app.otp.template-name:OTP1}") String templateName) {
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.baseUrl = trimTrailingSlash(baseUrl);
        this.sendPath = normalizePath(sendPath);
        this.verifyPath = normalizePath(verifyPath);
        this.templateName = templateName;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public SendResult send(String phone) {
        requireConfigured();
        log.info("OTP send requested for phone ending {}", lastFour(phone));

        String url = buildSendUrl(phone);
        try {
            String body = client.get()
                    .uri(URI.create(url))
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(String.class);

            JsonNode response = parseResponse(body);
            String status = firstText(response, "Status", "status");
            String sessionId = firstText(response, "Details", "details", "session_id", "sessionId", "UID", "uid");
            String providerOtp = firstText(response, "OTP", "otp");

            if (!isSuccessfulSend(status) || sessionId == null || sessionId.isBlank()) {
                String message = firstText(response, "Details", "details", "message", "Message", "error", "Error");
                throw new IllegalArgumentException(message == null || message.isBlank()
                        ? "Unable to send OTP."
                        : "Unable to send OTP: " + message);
            }

            log.info("2Factor AUTOGEN2 OTP send accepted: status={}, sessionPresent={}, otpPresent={}",
                    status, true, providerOtp != null && !providerOtp.isBlank());
            return new SendResult(sessionId, providerOtp, status, firstText(response, "Details", "details"));
        } catch (RestClientResponseException e) {
            log.error("2Factor OTP send HTTP error: status={}", e.getStatusCode().value());
            throw providerHttpError(e.getStatusCode().value());
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("2Factor OTP send connection error: {}", e.getMessage(), e);
            throw new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
        }
    }

    public void verify(String sessionId, String otp) {
        requireConfigured();
        if (sessionId == null || sessionId.isBlank() || otp == null || !otp.trim().matches("\\d{4,8}")) {
            throw new IllegalArgumentException("Invalid OTP.");
        }

        log.info("OTP verification requested");
        String url = buildVerifyUrl(sessionId.trim(), otp.trim());
        try {
            String body = client.get()
                    .uri(URI.create(url))
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(String.class);

            JsonNode response = parseResponse(body);
            if (isSuccessfulVerification(response)) {
                log.info("2Factor OTP verification succeeded");
                return;
            }
        } catch (RestClientResponseException e) {
            log.warn("2Factor OTP verification HTTP error: status={}", e.getStatusCode().value());
        } catch (Exception e) {
            log.error("2Factor OTP verification connection error: {}", e.getMessage());
        }

        throw new IllegalArgumentException("Invalid or expired OTP");
    }

    private String buildSendUrl(String phone) {
        return baseUrl + sendPath
                .replace("{api_key}", encodePath(apiKey))
                .replace("{phone_number}", encodePath(phone))
                .replace("{otp_template_name}", encodePath(templateName));
    }

    private String buildVerifyUrl(String sessionId, String otp) {
        return baseUrl + verifyPath
                .replace("{api_key}", encodePath(apiKey))
                .replace("{session_id}", encodePath(sessionId))
                .replace("{otp}", encodePath(otp));
    }

    private JsonNode parseResponse(String body) throws Exception {
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("OTP service returned an empty response.");
        }
        JsonNode response = mapper.readTree(body);
        if (response == null || !response.isObject()) {
            throw new IllegalArgumentException("OTP service returned an invalid response.");
        }
        return response;
    }

    private boolean isSuccessfulSend(String status) {
        return "Success".equalsIgnoreCase(status) || "success".equalsIgnoreCase(status)
                || "sent".equalsIgnoreCase(status);
    }

    private boolean isSuccessfulVerification(JsonNode response) {
        if (response == null) return false;
        if (response.path("verified").isBoolean()) return response.path("verified").asBoolean();
        if (response.path("isValid").isBoolean()) return response.path("isValid").asBoolean();
        if (response.path("success").isBoolean()) return response.path("success").asBoolean();

        String status = firstText(response, "Status", "status");
        String details = firstText(response, "Details", "details", "message", "Message");
        return ("Success".equalsIgnoreCase(status) || "success".equalsIgnoreCase(status))
                && (details == null || "OTP Matched".equalsIgnoreCase(details) || "verified".equalsIgnoreCase(details));
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

    private IllegalArgumentException providerHttpError(int status) {
        if (status == 401 || status == 403) {
            return new IllegalArgumentException("OTP provider rejected the API key or request.");
        }
        if (status == 429) {
            return new IllegalArgumentException("OTP service rate limit reached. Please try again later.");
        }
        if (status == 404) {
            return new IllegalArgumentException("OTP provider endpoint is unavailable. Please check the 2Factor API configuration.");
        }
        return new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
    }

    private String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private String normalizePath(String value) {
        if (value == null || value.isBlank()) return "";
        return value.startsWith("/") ? value : "/" + value;
    }

    private String encodePath(String value) {
        if (value == null) return "";
        return value
                .replace("%", "%25")
                .replace("/", "%2F")
                .replace("?", "%3F")
                .replace("#", "%23")
                .replace(" ", "%20");
    }

    private String lastFour(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(phone.length() - 4);
    }
}
