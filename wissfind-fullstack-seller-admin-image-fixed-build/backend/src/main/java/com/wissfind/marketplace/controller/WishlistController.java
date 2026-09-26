package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.entity.WishlistItem;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.repo.WishlistItemRepository;
import com.wissfind.marketplace.service.CurrentUser;
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

    public WishlistController(WishlistItemRepository wishlist, ProductRepository products,
                              ProductImageRepository images, UserRepository users) {
        this.wishlist = wishlist;
        this.products = products;
        this.images = images;
        this.users = users;
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
        String image = p.image;
        if ((image == null || image.isBlank()) && !stored.isEmpty()) {
            ProductImage first = stored.get(0);
            image = first.cloudinaryUrl != null && !first.cloudinaryUrl.isBlank()
                    ? first.cloudinaryUrl
                    : "/api/products/" + p.id + "/images/" + first.id;
        }
        return new WishlistProduct(
                p.id, p.name, p.category, p.subcategory, p.price, p.oldPrice,
                p.salePrice, image, p.stock, p.rating, p.reviews
        );
    }

    public record WishlistProduct(Long id, String name, String category, String subcategory,
                                  double price, double oldPrice, Double salePrice,
                                  String image, int stock, double rating, int reviews) {}
}
