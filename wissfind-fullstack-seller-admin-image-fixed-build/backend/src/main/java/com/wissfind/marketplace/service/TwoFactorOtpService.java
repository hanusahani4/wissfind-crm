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
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

@Service
public class TwoFactorOtpService {
    private static final Logger log = LoggerFactory.getLogger(TwoFactorOtpService.class);

    private final RestClient client;
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String baseUrl;

    public TwoFactorOtpService(
            ObjectMapper mapper,
            @Value("${app.otp.api-key:}") String apiKey,
            @Value("${app.otp.base-url:https://2factor.in/API/V1}") String baseUrl) {
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replaceAll("/$", "");

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public String send(String phone) {
        requireConfigured();
        log.info("OTP send requested for phone ending {}", lastFour(phone));
        String url = baseUrl + "/" + enc(apiKey) + "/SMS/" + enc(phone.replace("+", "")) + "/AUTOGEN";
        JsonNode response = get(url);
        String status = response.path("Status").asText("");
        String details = response.path("Details").asText("");
        log.info("2Factor OTP send response: status={}, detailsPresent={}", status, !details.isBlank());
        if (!"Success".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("Unable to send OTP. Please try again.");
        }
        if (details.isBlank()) {
            throw new IllegalArgumentException("OTP provider did not return a session.");
        }
        return details;
    }

    public void verify(String sessionId, String otp) {
        requireConfigured();
        if (sessionId == null || sessionId.isBlank() || otp == null || !otp.matches("\\d{4,8}")) {
            throw new IllegalArgumentException("Invalid OTP.");
        }
        log.info("OTP verification requested");
        String url = baseUrl + "/" + enc(apiKey) + "/SMS/VERIFY/" + enc(sessionId) + "/" + enc(otp);
        JsonNode response = get(url);
        String status = response.path("Status").asText("");
        String details = response.path("Details").asText("");
        log.info("2Factor OTP verify response: status={}, details={}", status, details);
        if (!"Success".equalsIgnoreCase(status) || !"OTP Matched".equalsIgnoreCase(details)) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }
    }

    private JsonNode get(String url) {
        try {
            String body = client.get().uri(url)
                    .header("Accept", "application/json")
                    .retrieve()
                    .body(String.class);
            if (body == null || body.isBlank()) {
                throw new IllegalArgumentException("OTP service returned an empty response.");
            }
            return mapper.readTree(body);
        } catch (RestClientResponseException e) {
            log.error("2Factor HTTP error: status={}, body={}", e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new IllegalArgumentException("OTP provider rejected the request. Please check the OTP provider configuration.");
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("2Factor connection error: {}", e.getMessage(), e);
            throw new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
        }
    }

    private void requireConfigured() {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("TWOFACTOR_API_KEY is not configured");
            throw new IllegalStateException("OTP provider is not configured. Set TWOFACTOR_API_KEY.");
        }
    }

    private String enc(String value) {
        return UriUtils.encodePathSegment(value, StandardCharsets.UTF_8);
    }

    private String lastFour(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return phone.substring(phone.length() - 4);
    }
}
