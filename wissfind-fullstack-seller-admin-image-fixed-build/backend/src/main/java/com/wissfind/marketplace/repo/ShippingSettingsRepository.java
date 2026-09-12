package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.ShippingSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingSettingsRepository extends JpaRepository<ShippingSettings, Long> {
}
