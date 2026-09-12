package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.ShippingSettings;
import com.wissfind.marketplace.repo.ShippingSettingsRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/shipping-config")
public class ShippingSettingsController {
    private final ShippingSettingsRepository repo;

    public ShippingSettingsController(ShippingSettingsRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public ShippingSettings get() {
        return settings();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ShippingSettings update(@RequestBody ShippingSettings incoming) {
        ShippingSettings current = settings();
        current.freeShippingThreshold = money(incoming.freeShippingThreshold, "Free delivery threshold");
        current.prepaidShippingCharge = money(incoming.prepaidShippingCharge, "Prepaid shipping charge");
        current.codShippingCharge = money(incoming.codShippingCharge, "COD shipping charge");
        current.codMaxOrderAmount = money(incoming.codMaxOrderAmount, "COD maximum order amount");
        current.codEnabled = incoming.codEnabled;
        return repo.save(current);
    }

    private ShippingSettings settings() {
        return repo.findAll().stream().findFirst().orElseGet(() -> repo.save(new ShippingSettings()));
    }

    private BigDecimal money(BigDecimal value, String label) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(label + " cannot be negative");
        }
        return value.setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
