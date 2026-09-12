package com.wissfind.marketplace.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(name = "homepage_sections", indexes = {
        @Index(name = "idx_homepage_sections_order", columnList = "display_order, is_active"),
        @Index(name = "idx_homepage_sections_dates", columnList = "start_date, end_date")
})
public class HomepageSection extends BaseEntity {
    public enum SectionType { TRENDING, BEST_SELLERS, DEALS, CATEGORY, NEW_ARRIVALS, TOP_RATED }
    public enum ProductMode { AUTOMATIC, MANUAL, HYBRID }

    @Column(nullable = false, length = 140)
    public String title;

    @Column(nullable = false, unique = true, length = 160)
    public String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "section_type", nullable = false, length = 40)
    public SectionType sectionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "product_mode", nullable = false, length = 20)
    public ProductMode productMode = ProductMode.AUTOMATIC;

    @Column(name = "display_order", nullable = false)
    public int displayOrder = 1;

    @Column(name = "is_active", nullable = false)
    public boolean active = true;

    @Column(name = "max_products", nullable = false)
    public int maxProducts = 10;

    @Column(name = "show_view_all", nullable = false)
    public boolean showViewAll = true;

    @Column(name = "category_id")
    public Long categoryId;

    @Column(name = "manual_product_ids", length = 4000)
    public String manualProductIds = "";

    @Column(name = "start_date")
    public java.time.Instant startDate;

    @Column(name = "end_date")
    public java.time.Instant endDate;
}
