package com.wissfind.marketplace.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "wishlist_items",
        uniqueConstraints = @UniqueConstraint(name = "uk_wishlist_user_product", columnNames = {"user_id", "product_id"}),
        indexes = {
                @Index(name = "idx_wishlist_user_created", columnList = "user_id, created_at"),
                @Index(name = "idx_wishlist_product", columnList = "product_id")
        })
public class WishlistItem extends BaseEntity {
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    public User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    public Product product;
}
