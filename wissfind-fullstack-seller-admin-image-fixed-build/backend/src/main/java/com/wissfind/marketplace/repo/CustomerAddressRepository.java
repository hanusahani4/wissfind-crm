package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.CustomerAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, Long> {
    List<CustomerAddress> findByCustomerIdOrderByDefaultAddressDescUpdatedAtDesc(Long customerId);
    Optional<CustomerAddress> findByIdAndCustomerId(Long id, Long customerId);
    long countByCustomerId(Long customerId);
}
