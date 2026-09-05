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
import java.security.SecureRandom;
import java.util.UUID;

@Service
public class TwoFactorOtpService {
    private static final Logger log = LoggerFactory.getLogger(TwoFactorOtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    public record SendResult(String sessionId, String otp, String status, String details) {}

    private final RestClient client;
    private final ObjectMapper mapper;
    private final String authorization;
    private final String senderId;
    private final String baseUrl;

    public TwoFactorOtpService(
            ObjectMapper mapper,
            @Value("${app.otp.ninza.authorization:}") String authorization,
            @Value("${app.otp.ninza.sender-id:}") String senderId,
            @Value("${app.otp.ninza.base-url:https://ninzasms.in.net/auth/send_sms.php}") String baseUrl) {
        this.mapper = mapper;
        this.authorization = authorization;
        this.senderId = senderId;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public SendResult send(String phone) {
        requireConfigured();

        String normalizedPhone = normalizePhone(phone);
        String otp = generateOtp();
        String requestId = UUID.randomUUID().toString();

        log.info("Ninza OTP send requested for phone ending {}", lastFour(normalizedPhone));

        try {
            String body = client.post()
                    .uri(URI.create(baseUrl))
                    .header("Authorization", authorization)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .body(new SendRequest(senderId, normalizedPhone, "sms", otp))
                    .retrieve()
                    .body(String.class);

            JsonNode response = parseResponse(body);
            String status = firstText(response, "Status", "status", "success");
            String details = firstText(response, "Details", "details", "message", "Message", "error", "Error");

            if (response.path("success").isBoolean() && !response.path("success").asBoolean()) {
                throw new IllegalArgumentException(details == null ? "Unable to send OTP." : "Unable to send OTP: " + details);
            }
            if ("false".equalsIgnoreCase(status) || "failed".equalsIgnoreCase(status)
                    || "failure".equalsIgnoreCase(status) || "error".equalsIgnoreCase(status)) {
                throw new IllegalArgumentException(details == null ? "Unable to send OTP." : "Unable to send OTP: " + details);
            }

            log.info("Ninza OTP send accepted: status={}, requestId={}", status == null ? "HTTP_SUCCESS" : status, requestId);
            return new SendResult(requestId, otp, status == null ? "Success" : status, details);
        } catch (RestClientResponseException e) {
            log.error("Ninza OTP send HTTP error: status={}", e.getStatusCode().value());
            throw providerHttpError(e.getStatusCode().value());
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Ninza OTP send connection error: {}", e.getMessage(), e);
            throw new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
        }
    }

    /**
     * Ninza does not require a provider-side verification call for this flow.
     * The generated six-digit OTP is stored in the OTP challenge and compared by AuthService.
     */
    public void verify(String sessionId, String otp) {
        if (sessionId == null || sessionId.isBlank() || otp == null || !otp.trim().matches("\\d{6}")) {
            throw new IllegalArgumentException("Invalid OTP.");
        }
        log.info("Ninza OTP verification requested");
    }

    private String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private String normalizePhone(String phone) {
        if (phone == null) throw new IllegalArgumentException("Phone number is required");

        String digits = phone.trim().replaceAll("\\D", "");

        // Accept 0XXXXXXXXXX, 91XXXXXXXXXX, +91XXXXXXXXXX and XXXXXXXXXX.
        if (digits.startsWith("0") && digits.length() == 11) digits = digits.substring(1);
        if (digits.startsWith("91") && digits.length() == 12) digits = digits.substring(2);

        if (digits.length() != 10 || digits.charAt(0) < '6' || digits.charAt(0) > '9') {
            throw new IllegalArgumentException("Enter a valid 10-digit Indian mobile number");
        }

        // Ninza receives the local 10-digit mobile number.
        return digits;
    }

    private JsonNode parseResponse(String body) throws Exception {
        if (body == null || body.isBlank()) return mapper.createObjectNode();
        JsonNode response = mapper.readTree(body);
        return response == null || !response.isObject() ? mapper.createObjectNode() : response;
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
        if (authorization == null || authorization.isBlank()) {
            log.error("NINZA_SMS_AUTH is not configured");
            throw new IllegalStateException("OTP provider is not configured. Set NINZA_SMS_AUTH.");
        }
        if (senderId == null || senderId.isBlank()) {
            log.error("NINZA_SMS_SENDER_ID is not configured");
            throw new IllegalStateException("OTP provider is not configured. Set NINZA_SMS_SENDER_ID.");
        }
    }

    private IllegalArgumentException providerHttpError(int status) {
        if (status == 401 || status == 403) {
            return new IllegalArgumentException("Ninza SMS provider rejected the API authorization.");
        }
        if (status == 429) {
            return new IllegalArgumentException("OTP service rate limit reached. Please try again later.");
        }
        return new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
    }

    private String lastFour(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(phone.length() - 4);
    }

    private record SendRequest(String sender_id, String numbers, String rout, String variables_values) {}
}
