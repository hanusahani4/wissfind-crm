package com.wissfind.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

@Service
public class TwoFactorOtpService {
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

        // Never leave the Angular "Sending OTP..." state hanging indefinitely
        // when the provider or network does not return an HTTP response.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public String send(String phone) {
        requireConfigured();
        String url = baseUrl + "/" + enc(apiKey) + "/SMS/" + enc(phone.replace("+", "")) + "/AUTOGEN";
        JsonNode response = get(url);
        if (!"Success".equalsIgnoreCase(response.path("Status").asText())) {
            throw new IllegalArgumentException("Unable to send OTP. Please try again.");
        }
        String sessionId = response.path("Details").asText("");
        if (sessionId.isBlank()) {
            throw new IllegalArgumentException("OTP provider did not return a session.");
        }
        return sessionId;
    }

    public void verify(String sessionId, String otp) {
        requireConfigured();
        if (sessionId == null || sessionId.isBlank() || otp == null || !otp.matches("\\d{4,8}")) {
            throw new IllegalArgumentException("Invalid OTP.");
        }
        String url = baseUrl + "/" + enc(apiKey) + "/SMS/VERIFY/" + enc(sessionId) + "/" + enc(otp);
        JsonNode response = get(url);
        if (!"Success".equalsIgnoreCase(response.path("Status").asText())
                || !"OTP Matched".equalsIgnoreCase(response.path("Details").asText())) {
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
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("OTP service is temporarily unavailable. Please try again.");
        }
    }

    private void requireConfigured() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("OTP provider is not configured. Set TWOFACTOR_API_KEY.");
        }
    }

    private String enc(String value) {
        return UriUtils.encodePathSegment(value, StandardCharsets.UTF_8);
    }
}
