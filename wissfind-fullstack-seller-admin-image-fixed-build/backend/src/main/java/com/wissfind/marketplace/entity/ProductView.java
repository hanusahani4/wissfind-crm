package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "product_views", indexes = {
        @Index(name = "idx_product_views_product", columnList = "product_id"),
        @Index(name = "idx_product_views_created", columnList = "created_at")
})
public class ProductView {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "product_id", nullable = false)
    public Long productId;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();
}
