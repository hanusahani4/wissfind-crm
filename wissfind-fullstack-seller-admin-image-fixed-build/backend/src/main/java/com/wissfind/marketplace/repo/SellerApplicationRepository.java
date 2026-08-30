package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.SellerApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface SellerApplicationRepository extends JpaRepository<SellerApplication, Long>, JpaSpecificationExecutor<SellerApplication> {
    Optional<SellerApplication> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
}
