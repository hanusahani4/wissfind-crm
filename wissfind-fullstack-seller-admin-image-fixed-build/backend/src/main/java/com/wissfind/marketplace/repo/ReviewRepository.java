package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review,Long>, JpaSpecificationExecutor<Review> {
    List<Review> findByProductIdOrderByCreatedAtDesc(Long productId);
    List<Review> findByProductSellerIdOrderByCreatedAtDesc(Long sellerId);
    boolean existsByProductIdAndCustomerId(Long productId, Long customerId);
}
