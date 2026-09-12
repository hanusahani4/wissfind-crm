package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.ProductView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface ProductViewRepository extends JpaRepository<ProductView, Long> {
    long countByProductId(Long productId);

    @Query("select count(v) from ProductView v where v.productId = :productId and v.createdAt >= :since")
    long countSince(@Param("productId") Long productId, @Param("since") Instant since);

    @Query("select v.productId, count(v) from ProductView v group by v.productId")
    List<Object[]> countGroupedByProduct();
}
