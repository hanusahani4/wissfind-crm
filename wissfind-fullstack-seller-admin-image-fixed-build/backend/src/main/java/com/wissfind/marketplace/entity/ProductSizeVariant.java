package com.wissfind.marketplace.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "product_size_variants", indexes = {
        @Index(name = "idx_product_size_variants_color", columnList = "color_variant_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_product_size_variant", columnNames = {"color_variant_id", "size_value"}),
        @UniqueConstraint(name = "uk_product_size_variant_sku", columnNames = "sku")
})
public class ProductSizeVariant extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "color_variant_id", nullable = false)
    public ProductColorVariant colorVariant;

    @Column(name = "size_value", nullable = false, length = 50)
    public String size;

    @Column(nullable = false, length = 80)
    public String sku;

    @Column(nullable = false)
    public double price;

    public double oldPrice;

    @Column(nullable = false)
    public int stock;
}
