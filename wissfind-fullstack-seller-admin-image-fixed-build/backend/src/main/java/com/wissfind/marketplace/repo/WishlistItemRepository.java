package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
    @Query("select wi from WishlistItem wi join fetch wi.product p where wi.user.id = :userId order by wi.createdAt desc")
    List<WishlistItem> findMine(@Param("userId") Long userId);

    List<WishlistItem> findByUserIdOrderByCreatedAtDesc(Long userId);
    boolean existsByUserIdAndProductId(Long userId, Long productId);
    void deleteByUserIdAndProductId(Long userId, Long productId);
}
