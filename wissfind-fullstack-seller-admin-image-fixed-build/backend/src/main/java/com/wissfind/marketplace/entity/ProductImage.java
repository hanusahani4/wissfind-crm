package com.wissfind.marketplace.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "product_image_data", uniqueConstraints = {
        @UniqueConstraint(name = "uk_product_image_hash", columnNames = {"product_id", "sha256"})
}, indexes = {
        @Index(name = "idx_product_images_product_order", columnList = "product_id, display_order")
})
public class ProductImage extends BaseEntity {

    /** Do not eagerly load the parent Product for every image row. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    public Product product;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "image_data", nullable = true, columnDefinition = "LONGBLOB")
    public byte[] imageData;

    @Column(name = "content_type", length = 100)
    public String contentType;

    @Column(name = "file_name", length = 255)
    public String fileName;

    @Column(name = "sha256", nullable = false, length = 64)
    public String sha256;

    @Column(name = "display_order", nullable = false)
    public int displayOrder;

    @Column(name = "cloudinary_public_id", length = 512)
    public String cloudinaryPublicId;

    @Column(name = "cloudinary_url", length = 2048)
    public String cloudinaryUrl;
}
