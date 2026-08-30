package com.wissfind.marketplace.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "product_image_data", uniqueConstraints = {
        @UniqueConstraint(name = "uk_product_image_hash", columnNames = {"product_id", "sha256"})
})
public class ProductImage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    public Product product;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "image_data", nullable = false, columnDefinition = "LONGBLOB")
    public byte[] imageData;

    @Column(name = "content_type", nullable = false, length = 100)
    public String contentType;

    @Column(name = "file_name", length = 255)
    public String fileName;

    @Column(name = "sha256", nullable = false, length = 64)
    public String sha256;

    @Column(name = "display_order", nullable = false)
    public int displayOrder;
}
