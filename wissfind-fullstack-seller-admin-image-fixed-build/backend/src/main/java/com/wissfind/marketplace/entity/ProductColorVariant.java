package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "product_color_variants", indexes = {
        @Index(name = "idx_product_color_variants_product", columnList = "product_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_product_color_variant", columnNames = {"product_id", "color"})
})
public class ProductColorVariant extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    public Product product;

    @Column(nullable = false, length = 80)
    public String color;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_color_variant_images", joinColumns = @JoinColumn(name = "color_variant_id"))
    @Column(name = "image_url", length = 2048)
    @OrderColumn(name = "display_order")
    public List<String> images = new ArrayList<>();

    @OneToMany(mappedBy = "colorVariant", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id asc")
    public List<ProductSizeVariant> sizes = new ArrayList<>();
}
