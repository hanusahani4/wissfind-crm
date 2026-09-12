package com.wissfind.marketplace.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "shipping_settings")
public class ShippingSettings extends BaseEntity {
    public BigDecimal freeShippingThreshold = new BigDecimal("200");
    public BigDecimal prepaidShippingCharge = new BigDecimal("20");
    public BigDecimal codShippingCharge = new BigDecimal("70");
    public BigDecimal codMaxOrderAmount = new BigDecimal("2000");
    public boolean codEnabled = true;
}
