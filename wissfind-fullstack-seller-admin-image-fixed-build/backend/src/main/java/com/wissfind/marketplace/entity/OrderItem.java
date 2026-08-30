package com.wissfind.marketplace.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

/**
 * Immutable-at-checkout snapshot of a product in an order.
 *
 * We intentionally store product information here instead of serialising a
 * live Product entity from Order. Product price/name/image can change later,
 * but an order must always show what the customer actually bought.
 */
@Entity
@Table(name = "order_items", indexes = {
        @Index(name = "idx_order_items_order_id", columnList = "order_id"),
        @Index(name = "idx_order_items_product_id", columnList = "product_id")
})
public class OrderItem extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    public Order order;

    @Column(name = "product_id", nullable = false)
    public Long productId;

    @Column(nullable = false, length = 180)
    public String name;

    @Column(length = 120)
    public String category;

    @Column(length = 1000)
    public String image;

    @Column(nullable = false)
    public int quantity;

    @Column(nullable = false, precision = 15, scale = 2)
    public BigDecimal price;

    @Column(length = 120)
    public String variant;
}
