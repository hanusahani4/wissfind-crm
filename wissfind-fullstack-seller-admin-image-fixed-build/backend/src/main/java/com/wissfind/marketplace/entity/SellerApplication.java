package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "seller_applications", uniqueConstraints = {
        @UniqueConstraint(name = "uk_seller_application_user", columnNames = "user_id")
})
public class SellerApplication extends BaseEntity {

    @OneToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonIgnore
    public User user;

    public String ownerName, phone, email, storeName, category, businessType;
    public String pan, gstin;
    public String pickupAddress, city, state, pincode;
    public String bankAccount, ifsc;

    @Enumerated(EnumType.STRING)
    public Status status = Status.PENDING;

    public enum Status { PENDING, APPROVED, REJECTED, SUSPENDED }
}
