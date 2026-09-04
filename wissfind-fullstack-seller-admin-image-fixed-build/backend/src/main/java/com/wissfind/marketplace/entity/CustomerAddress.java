package com.wissfind.marketplace.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.*;

@Entity
@Table(name = "customer_addresses", indexes = {
        @Index(name = "idx_customer_address_customer", columnList = "customer_id"),
        @Index(name = "idx_customer_address_pincode", columnList = "pincode")
})
public class CustomerAddress extends BaseEntity {
    @JsonIgnore
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    public User customer;

    @Column(nullable = false, length = 30)
    public String label;
    @Column(nullable = false, length = 100)
    public String fullName;
    @Column(nullable = false, length = 15)
    public String phone;
    @Column(nullable = false, length = 250)
    public String line1;
    @Column(length = 250)
    public String line2;
    @Column(nullable = false, length = 100)
    public String city;
    @Column(nullable = false, length = 100)
    public String district;
    @Column(nullable = false, length = 100)
    public String state;
    @Column(nullable = false, length = 6)
    public String pincode;
    @Column(nullable = false)
    public boolean pinVerified = false;
    @Column(nullable = false, length = 50)
    public String country = "India";
    @Column(nullable = false)
    public boolean defaultAddress = false;
}
