package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products", uniqueConstraints = {
        @UniqueConstraint(name = "uk_products_sku", columnNames = "sku")
})
public class Product extends BaseEntity {

    @ManyToOne(optional = false)
    public User seller;

    @Column(nullable = false, length = 180)
    public String name;

    @Column(nullable = false, length = 80)
    public String category;

    @Column(length = 120)
    public String subcategory;

    @Column(length = 80)
    public String type;

    @Column(length = 80)
    public String brand;

    @Column(length = 30)
    public String gender;

    @Column(unique = true, length = 80)
    public String sku;

    @Column(length = 5000)
    public String description;

    @Column(length = 1000)
    public String image;

    @Transient
    public List<String> images = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_tags", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "tag", length = 80)
    public List<String> tags = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_colors", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "color", length = 50)
    public List<String> colors = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_sizes", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "size_value", length = 50)
    public List<String> sizes = new ArrayList<>();

    public String material;
    public String warranty;
    public Integer returnDays = 7;
    public Double weight;
    public String dimensions;
    public String hsnCode;
    public boolean taxIncluded = true;
    public boolean featured = false;

    public double gstPercent;
    public double price;
    public double oldPrice;
    public double shippingFee;
    public double platformFee;
    public int stock;
    public int sales;
    public double rating = 0;
    public int reviews = 0;
    public int likes = 0;

    @Enumerated(EnumType.STRING)
    public Status status = Status.PENDING;

    public enum Status {
        DRAFT, PENDING, LIVE, OUT_OF_STOCK, REJECTED
    }
}
