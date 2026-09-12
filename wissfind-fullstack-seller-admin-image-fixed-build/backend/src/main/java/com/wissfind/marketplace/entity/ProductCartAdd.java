package com.wissfind.marketplace.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "product_cart_adds", indexes = {
        @Index(name = "idx_cart_adds_product", columnList = "product_id"),
        @Index(name = "idx_cart_adds_created", columnList = "created_at")
})
public class ProductCartAdd {
    @jakarta.persistence.Id
    @jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    public Long id;

    @Column(name = "product_id", nullable = false)
    public Long productId;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();
}
