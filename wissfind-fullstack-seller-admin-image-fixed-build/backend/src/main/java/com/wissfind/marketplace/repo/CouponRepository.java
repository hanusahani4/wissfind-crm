package com.wissfind.marketplace.repo;
import com.wissfind.marketplace.entity.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.*;
public interface CouponRepository extends JpaRepository<Coupon,Long>, JpaSpecificationExecutor<Coupon> {
 boolean existsByCodeIgnoreCase(String code);
 boolean existsByCodeIgnoreCaseAndIdNot(String code,Long id);
 List<Coupon> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
}
