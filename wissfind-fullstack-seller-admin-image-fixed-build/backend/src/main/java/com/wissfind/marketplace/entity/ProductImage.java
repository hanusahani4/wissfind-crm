package com.wissfind.marketplace.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "product_image_data", uniqueConstraints = {
        @UniqueConstraint(name = "uk_product_image_hash", columnNames = {"product_id", "sha256"})
})
public class ProductImage extends BaseEntity {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    public Product product;

    /**
     * Legacy database image bytes. New uploads do not populate this field;
     * images are stored in Cloudinary and only their metadata is kept here.
     * Kept nullable so existing DB rows can continue to work during migration.
     */
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

    /** Cloudinary public ID used when deleting/referencing the asset. */
    @Column(name = "cloudinary_public_id", length = 512)
    public String cloudinaryPublicId;

    /** HTTPS CDN URL returned by Cloudinary. */
    @Column(name = "cloudinary_url", length = 2048)
    public String cloudinaryUrl;
}
