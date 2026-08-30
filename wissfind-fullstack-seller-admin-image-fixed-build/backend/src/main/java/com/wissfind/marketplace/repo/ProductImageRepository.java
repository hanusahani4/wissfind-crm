package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    List<ProductImage> findByProductIdOrderByDisplayOrderAsc(Long productId);

    @Query("""
        select pi
        from ProductImage pi
        where pi.product.id in :productIds
        order by pi.product.id asc, pi.displayOrder asc
        """)
    List<ProductImage> findByProductIds(@Param("productIds") Collection<Long> productIds);
    Optional<ProductImage> findByProductIdAndSha256(Long productId, String sha256);
    void deleteByProductId(Long productId);
}
