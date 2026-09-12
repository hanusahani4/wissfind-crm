package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.HomepageConfiguration;
import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.repo.HomepageConfigurationRepository;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.ProductViewRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/homepage")
public class HomepageController {
    private final ProductRepository products;
    private final ProductImageRepository images;
    private final ProductViewRepository views;
    private final HomepageConfigurationRepository configRepo;

    public HomepageController(ProductRepository products, ProductImageRepository images,
                              ProductViewRepository views, HomepageConfigurationRepository configRepo) {
        this.products = products;
        this.images = images;
        this.views = views;
        this.configRepo = configRepo;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Page<Product> homepage(@RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "8") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(24, Math.max(1, size)));
        List<Product> ranked = rank(liveProducts(), config());
        int from = Math.min((int) pageable.getOffset(), ranked.size());
        int to = Math.min(from + pageable.getPageSize(), ranked.size());
        List<Product> slice = ranked.subList(from, to);
        populateImages(slice);
        return new PageImpl<>(slice, pageable, ranked.size());
    }

    @GetMapping("/candidates")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> candidates() {
        return liveProducts().stream().map(this::candidate).toList();
    }

    @GetMapping("/config")
    @PreAuthorize("hasRole('ADMIN')")
    public HomepageConfiguration getConfig() {
        return config();
    }

    @PutMapping("/config")
    @PreAuthorize("hasRole('ADMIN')")
    public HomepageConfiguration saveConfig(@RequestBody HomepageConfiguration input) {
        HomepageConfiguration c = config();
        c.mode = input.mode == null ? HomepageConfiguration.Mode.AUTOMATIC : input.mode;
        c.manualProductIds = input.manualProductIds == null ? "" : input.manualProductIds.trim();
        c.ordersWeight = Math.max(0, input.ordersWeight);
        c.ratingsWeight = Math.max(0, input.ratingsWeight);
        c.viewsWeight = Math.max(0, input.viewsWeight);
        double total = c.ordersWeight + c.ratingsWeight + c.viewsWeight;
        if (total == 0) { c.ordersWeight = .50; c.ratingsWeight = .30; c.viewsWeight = .20; }
        else { c.ordersWeight /= total; c.ratingsWeight /= total; c.viewsWeight /= total; }
        return configRepo.save(c);
    }

    private HomepageConfiguration config() {
        return configRepo.findById(1L).orElseGet(() -> configRepo.save(new HomepageConfiguration()));
    }

    private List<Product> liveProducts() {
        return products.findAll().stream()
                .filter(p -> p.status == Product.Status.LIVE && p.stock > 0)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private List<Product> rank(List<Product> source, HomepageConfiguration c) {
        if (c.mode == HomepageConfiguration.Mode.MANUAL) {
            Map<Long, Integer> manual = manualOrder(c.manualProductIds);
            return source.stream().sorted(Comparator
                    .comparingInt((Product p) -> manual.getOrDefault(p.id, Integer.MAX_VALUE))
                    .thenComparingDouble(this::automaticScore).reversed()).toList();
        }

        if (c.mode == HomepageConfiguration.Mode.HYBRID) {
            Map<Long, Integer> manual = manualOrder(c.manualProductIds);
            return source.stream().sorted(Comparator.comparingDouble((Product p) ->
                    automaticScore(p, c) + manualBoost(manual.get(p.id), source.size())).reversed()).toList();
        }

        return source.stream().sorted(Comparator.comparingDouble((Product p) -> automaticScore(p, c)).reversed()).toList();
    }

    private double automaticScore(Product p) { return automaticScore(p, config()); }

    private double automaticScore(Product p, HomepageConfiguration c) {
        double maxSales = Math.max(1, sourceMaxSales);
        double maxViews = Math.max(1, sourceMaxViews);
        return c.ordersWeight * p.sales / maxSales
                + c.ratingsWeight * Math.max(0, Math.min(5, p.rating)) / 5.0
                + c.viewsWeight * views.countByProductId(p.id) / maxViews;
    }

    private int sourceMaxSales;
    private long sourceMaxViews;

    private List<Product> prepare(List<Product> source) {
        sourceMaxSales = source.stream().mapToInt(p -> Math.max(0, p.sales)).max().orElse(1);
        sourceMaxViews = source.stream().mapToLong(p -> views.countByProductId(p.id)).max().orElse(1);
        return source;
    }

    private double manualBoost(Integer position, int total) {
        if (position == null) return 0;
        return 0.50 * (1.0 - ((double) position / Math.max(1, total)));
    }

    private Map<Long, Integer> manualOrder(String ids) {
        Map<Long, Integer> result = new HashMap<>();
        if (ids == null || ids.isBlank()) return result;
        int index = 0;
        for (String token : ids.split(",")) {
            try { Long id = Long.valueOf(token.trim()); if (!result.containsKey(id)) result.put(id, index++); }
            catch (Exception ignored) { }
        }
        return result;
    }

    private Map<String, Object> candidate(Product p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id); m.put("name", p.name); m.put("category", p.category);
        m.put("price", p.price); m.put("rating", p.rating); m.put("reviews", p.reviews);
        m.put("sales", p.sales); m.put("views", views.countByProductId(p.id));
        m.put("image", imageUrl(p));
        return m;
    }

    private void populateImages(List<Product> rows) {
        for (Product p : rows) {
            List<ProductImage> imgs = images.findByProductIdOrderByDisplayOrderAsc(p.id);
            List<String> urls = imgs.stream().map(x -> x.cloudinaryUrl != null && !x.cloudinaryUrl.isBlank()
                    ? x.cloudinaryUrl : "/api/products/" + p.id + "/images/" + x.id).toList();
            p.images = urls;
            if ((p.image == null || p.image.isBlank()) && !urls.isEmpty()) p.image = urls.get(0);
        }
    }

    private String imageUrl(Product p) {
        List<ProductImage> imgs = images.findByProductIdOrderByDisplayOrderAsc(p.id);
        if (!imgs.isEmpty() && imgs.get(0).cloudinaryUrl != null && !imgs.get(0).cloudinaryUrl.isBlank()) return imgs.get(0).cloudinaryUrl;
        return p.image;
    }
}
