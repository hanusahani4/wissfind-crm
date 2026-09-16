package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.ProductColorVariant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductColorVariantRepository extends JpaRepository<ProductColorVariant, Long> {
    List<ProductColorVariant> findByProductIdOrderByIdAsc(Long productId);
    void deleteByProductId(Long productId);
}
