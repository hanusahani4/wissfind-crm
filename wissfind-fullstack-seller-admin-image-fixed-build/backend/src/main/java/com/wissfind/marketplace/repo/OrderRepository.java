package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.math.BigDecimal;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    boolean existsByOrderNumber(String orderNumber);

    List<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    org.springframework.data.domain.Page<Order> findByCustomerId(Long customerId, org.springframework.data.domain.Pageable pageable);
    org.springframework.data.domain.Page<Order> findByCustomerIdAndDeliveryStatus(Long customerId, String deliveryStatus, org.springframework.data.domain.Pageable pageable);

    List<Order> findBySellerIdOrderByCreatedAtDesc(Long sellerId);

    List<Order> findAllByOrderByCreatedAtDesc();

    long countByCustomerId(Long customerId);
    long countByCustomerIdAndDeliveryStatus(Long customerId, String deliveryStatus);
    @Query("select coalesce(sum(o.total),0) from Order o where o.customer.id = :customerId and o.deliveryStatus <> 'Cancelled'")
    BigDecimal sumTotalByCustomerId(@Param("customerId") Long customerId);

    @Query("select count(distinct o.id) from Order o join o.items i where o.customer.id = :customerId and i.productId = :productId and o.deliveryStatus <> 'Cancelled'")
    long countPurchasedProduct(@Param("customerId") Long customerId, @Param("productId") Long productId);
}
