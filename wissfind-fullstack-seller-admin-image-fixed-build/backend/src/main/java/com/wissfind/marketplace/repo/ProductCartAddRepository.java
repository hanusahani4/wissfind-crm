package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.ProductCartAdd;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ProductCartAddRepository extends JpaRepository<ProductCartAdd, Long> {
    long countByProductId(Long productId);

    @Query("select e.productId, count(e) from ProductCartAdd e group by e.productId")
    List<Object[]> countGroupedByProduct();
}
