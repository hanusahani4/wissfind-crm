package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders", uniqueConstraints = @UniqueConstraint(name = "uk_order_number", columnNames = "order_number"))
public class Order extends BaseEntity {

    @ManyToOne(optional = false)
    public User customer;

    @ManyToOne(optional = false)
    public User seller;

    public String orderNumber;
    public String deliveryStatus;
    public String paymentStatus;
    /** COD or RAZORPAY, persisted so customer/seller/admin see the exact method used. */
    public String paymentMethod;
    public String address;

    public BigDecimal subtotal;
    public BigDecimal total;
    public BigDecimal shipping;
    public BigDecimal gst;
    public BigDecimal discount;
    public BigDecimal commission = BigDecimal.ZERO;

    // Cancellation is persisted on the order so customer, seller and admin
    // always see the same state.
    public String cancellationReason;
    @Column(length = 2000)
    public String cancellationNote;
    public LocalDateTime cancelledAt;

    /** Product snapshots belonging to this order. */
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id ASC")
    public List<OrderItem> items = new ArrayList<>();
}
