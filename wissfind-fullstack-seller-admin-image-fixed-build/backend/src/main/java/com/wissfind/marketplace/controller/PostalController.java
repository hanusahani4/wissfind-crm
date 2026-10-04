package com.wissfind.marketplace.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/postal")
public class PostalController {
    private final RestClient client = RestClient.builder()
            .baseUrl("https://api.postalpincode.in")
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    @GetMapping("/pincode/{pincode}")
    public ResponseEntity<Map<String, Object>> lookup(@PathVariable String pincode) {
        if (pincode == null || !pincode.matches("\\d{6}")) {
            return ResponseEntity.badRequest().body(result(false, "Invalid PIN code."));
        }

        try {
            String body = client.get()
                    .uri("/pincode/{pincode}", pincode)
                    .retrieve()
                    .body(String.class);

            JsonNode root = mapper.readTree(body);
            JsonNode first = root.isArray() && !root.isEmpty() ? root.get(0) : null;
            JsonNode offices = first == null ? null : first.get("PostOffice");

            if (first == null || !"Success".equalsIgnoreCase(first.path("Status").asText())
                    || offices == null || !offices.isArray() || offices.isEmpty()) {
                return ResponseEntity.ok(result(false, "PIN code could not be verified."));
            }

            JsonNode office = offices.get(0);
            Map<String, Object> out = result(true, "PIN code verified.");
            out.put("pincode", pincode);
            out.put("district", office.path("District").asText(""));
            out.put("state", office.path("State").asText(""));
            out.put("country", office.path("Country").asText("India"));
            out.put("postOffices", offices);
            return ResponseEntity.ok(out);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(result(false, "PIN code service is temporarily unavailable."));
        }
    }

    private Map<String, Object> result(boolean valid, String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("valid", valid);
        out.put("message", message);
        return out;
    }
}
