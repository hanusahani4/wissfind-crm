package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.ProductCartAdd;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductCartAddRepository extends JpaRepository<ProductCartAdd, Long> {
    long countByProductId(Long productId);

    @Query("select count(e) from ProductCartAdd e where e.productId = :productId and e.createdAt >= :since")
    long countSince(@Param("productId") Long productId, @Param("since") java.time.Instant since);
}
