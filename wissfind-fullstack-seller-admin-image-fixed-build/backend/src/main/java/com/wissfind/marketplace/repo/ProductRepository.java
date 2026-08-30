package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    Optional<Product> findBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);
    List<Product> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
    List<Product> findByCategoryIgnoreCaseAndStatusAndStockGreaterThan(String category, Product.Status status, int stock);
}
