package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.entity.ProductColorVariant;
import com.wissfind.marketplace.entity.ProductSizeVariant;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.entity.WishlistItem;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.repo.WishlistItemRepository;
import com.wissfind.marketplace.service.CurrentUser;
import jakarta.persistence.EntityManager;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wishlist")
@PreAuthorize("hasRole('CUSTOMER')")
public class WishlistController {
    private final WishlistItemRepository wishlist;
    private final ProductRepository products;
    private final ProductImageRepository images;
    private final UserRepository users;
    private final EntityManager entityManager;

    public WishlistController(WishlistItemRepository wishlist, ProductRepository products,
                              ProductImageRepository images, UserRepository users, EntityManager entityManager) {
        this.wishlist = wishlist;
        this.products = products;
        this.images = images;
        this.users = users;
        this.entityManager = entityManager;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<WishlistProduct> mine() {
        Long userId = CurrentUser.id();
        List<WishlistProduct> result = new ArrayList<>();
        for (WishlistItem item : wishlist.findByUserIdOrderByCreatedAtDesc(userId)) {
            Product p = item.product;
            if (p == null) continue;
            result.add(toView(p));
        }
        return result;
    }

    @GetMapping("/count")
    @Transactional(readOnly = true)
    public Map<String, Object> count() {
        return Map.of("count", wishlist.findByUserIdOrderByCreatedAtDesc(CurrentUser.id()).size());
    }

    @GetMapping("/{productId}")
    @Transactional(readOnly = true)
    public Map<String, Object> exists(@PathVariable Long productId) {
        return Map.of("wishlisted", wishlist.existsByUserIdAndProductId(CurrentUser.id(), productId));
    }

    @PostMapping("/{productId}")
    @Transactional
    public Map<String, Object> add(@PathVariable Long productId) {
        Long userId = CurrentUser.id();
        if (!products.existsById(productId)) throw new IllegalArgumentException("Product not found");
        if (wishlist.existsByUserIdAndProductId(userId, productId)) {
            return Map.of("wishlisted", true);
        }
        User user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("Customer not found"));
        Product product = products.findById(productId).orElseThrow(() -> new IllegalArgumentException("Product not found"));
        WishlistItem item = new WishlistItem();
        item.user = user;
        item.product = product;
        wishlist.save(item);
        return Map.of("wishlisted", true);
    }

    @DeleteMapping("/{productId}")
    @Transactional
    public Map<String, Object> remove(@PathVariable Long productId) {
        wishlist.deleteByUserIdAndProductId(CurrentUser.id(), productId);
        return Map.of("wishlisted", false);
    }

    private WishlistProduct toView(Product p) {
        List<ProductImage> stored = images.findByProductIdOrderByDisplayOrderAsc(p.id);
        String image = stored.isEmpty() ? p.image : imageDisplayUrl(p.id, stored.get(0));
        double price = p.price;
        double oldPrice = p.oldPrice;
        Double salePrice = p.salePrice;
        int stock = Math.max(0, p.stock);

        // Variant products can have zero parent stock even though an individual
        // color/size is purchasable. Resolve the same first usable variant used
        // by the storefront so Wishlist shows the correct image, price and stock.
        List<ProductColorVariant> variants = entityManager.createQuery(
                "select distinct cv from ProductColorVariant cv left join fetch cv.sizes where cv.product.id = :id order by cv.id asc",
                ProductColorVariant.class
        ).setParameter("id", p.id).getResultList();
        for (ProductColorVariant colorVariant : variants) {
            if (colorVariant.images == null || colorVariant.images.isEmpty()) continue;
            ProductSizeVariant chosen = colorVariant.sizes == null ? null : colorVariant.sizes.stream()
                    .filter(Objects::nonNull)
                    .filter(v -> v.stock > 0)
                    .findFirst()
                    .orElse(null);
            if (chosen == null) continue;
            image = colorVariant.images.get(0);
            price = chosen.price;
            oldPrice = chosen.oldPrice;
            salePrice = null;
            stock = Math.max(0, chosen.stock);
            break;
        }

        return new WishlistProduct(
                p.id, p.name, p.category, p.subcategory, price, oldPrice,
                salePrice, image, stock, p.rating, p.reviews
        );
    }

    private String imageDisplayUrl(Long productId, ProductImage image) {
        if (image.cloudinaryUrl != null && !image.cloudinaryUrl.isBlank()) return image.cloudinaryUrl;
        return "/api/products/" + productId + "/images/" + image.id;
    }

    public record WishlistProduct(Long id, String name, String category, String subcategory,
                                  double price, double oldPrice, Double salePrice,
                                  String image, int stock, double rating, int reviews) {}
}
