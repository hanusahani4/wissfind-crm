package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name="payments", uniqueConstraints=@UniqueConstraint(name="uk_payment_provider_id", columnNames="provider_payment_id"))
public class Payment extends BaseEntity {
    @ManyToOne(optional=false) public Order order;
    public String provider = "DUMMY";
    /** Razorpay payment id after successful verification. */
    public String providerPaymentId;
    /** Razorpay order id created before checkout. */
    public String providerOrderId;
    public String status;
    public BigDecimal amount;
}
