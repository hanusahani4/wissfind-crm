package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

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
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(o.total),0) from Order o where o.customer.id = :customerId and o.deliveryStatus <> 'Cancelled'")
    BigDecimal sumTotalByCustomerId(@org.springframework.data.repository.query.Param("customerId") Long customerId);
}
