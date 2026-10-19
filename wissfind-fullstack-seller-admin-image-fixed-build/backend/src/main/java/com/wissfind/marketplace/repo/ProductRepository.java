package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    Optional<Product> findBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCase(String sku);
    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);
    List<Product> findBySellerIdOrderByCreatedAtDesc(Long sellerId);
    List<Product> findByCategoryIgnoreCaseAndStatusAndStockGreaterThan(String category, Product.Status status, int stock);

    /** All distinct categories that currently have at least one live, in-stock product. */
    @Query("select distinct p.category from Product p where p.status = :status and p.stock > :stock and p.category is not null and trim(p.category) <> '' order by p.category")
    List<String> findDistinctLiveCategories(@Param("status") Product.Status status,
                                            @Param("stock") int stock);

    /** Database-side filtering + pagination for the customer catalogue. */
    @Query("""
        select p
        from Product p
        where p.status = :status
          and p.stock > :stock
        order by p.createdAt desc
        """)
    Page<Product> findLiveInStock(@Param("status") Product.Status status,
                                  @Param("stock") int stock,
                                  Pageable pageable);
}
