package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Category;
import com.wissfind.marketplace.entity.HomepageSection;
import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductCartAdd;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.repo.CategoryRepository;
import com.wissfind.marketplace.repo.HomepageSectionRepository;
import com.wissfind.marketplace.repo.ProductCartAddRepository;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.ProductViewRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/homepage")
public class HomepageController {
    private final ProductRepository products;
    private final ProductImageRepository images;
    private final ProductViewRepository views;
    private final ProductCartAddRepository cartAdds;
    private final HomepageSectionRepository sections;
    private final CategoryRepository categories;

    public HomepageController(ProductRepository products, ProductImageRepository images, ProductViewRepository views,
                              ProductCartAddRepository cartAdds, HomepageSectionRepository sections, CategoryRepository categories) {
        this.products = products; this.images = images; this.views = views; this.cartAdds = cartAdds; this.sections = sections; this.categories = categories;
    }

    @PostConstruct
    @Transactional
    public void seedDefaultSections() {
        if (sections.count() > 0) return;
        saveDefault("🔥 Trending Now", "trending-now", HomepageSection.SectionType.TRENDING, 1);
        saveDefault("⭐ Best Sellers", "best-sellers", HomepageSection.SectionType.BEST_SELLERS, 2);
        saveDefault("💥 Today's Deals", "todays-deals", HomepageSection.SectionType.DEALS, 3);
        saveDefault("👗 Banarasi Sarees", "banarasi-sarees", HomepageSection.SectionType.CATEGORY, 4);
        saveDefault("🆕 New Arrivals", "new-arrivals", HomepageSection.SectionType.NEW_ARRIVALS, 5);
        saveDefault("❤️ Customers Love These", "customers-love-these", HomepageSection.SectionType.TOP_RATED, 6);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> homepage() {
        List<Product> all = liveProducts(); Analytics analytics = analytics();
        List<Map<String, Object>> result = sections.findByActiveTrueOrderByDisplayOrderAsc().stream().filter(this::withinSchedule)
                .map(section -> responseSection(section, selectProducts(section, all, analytics))).toList();
        return Map.of("sections", result);
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public Map<String, Object> adminData() {
        List<Product> all = liveProducts(); Analytics analytics = analytics();
        List<Map<String, Object>> rows = sections.findAllByOrderByDisplayOrderAsc().stream()
                .map(s -> adminSection(s, selectProducts(s, all, analytics))).toList();
        List<Map<String, Object>> categoryRows = categories.findAll().stream().map(c -> {
            Map<String, Object> row = new LinkedHashMap<>(); row.put("id", c.id); row.put("name", c.name); row.put("slug", c.slug); row.put("active", c.active); return row;
        }).toList();
        return Map.of("sections", rows, "products", all.stream().map(p -> candidate(p, analytics)).toList(), "categories", categoryRows);
    }

    @PutMapping("/sections/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public HomepageSection saveSection(@PathVariable Long id, @RequestBody HomepageSection input) {
        HomepageSection s = sections.findById(id).orElseThrow(() -> new IllegalArgumentException("Homepage section not found"));
        s.title = safe(input.title, s.title); s.slug = safe(input.slug, s.slug).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]", "-");
        s.sectionType = input.sectionType == null ? s.sectionType : input.sectionType;
        s.productMode = input.productMode == null ? HomepageSection.ProductMode.AUTOMATIC : input.productMode;
        s.displayOrder = Math.max(1, input.displayOrder); s.active = input.active; s.maxProducts = Math.min(30, Math.max(1, input.maxProducts));
        s.showViewAll = input.showViewAll; s.categoryId = input.categoryId; s.manualProductIds = normalizeIds(input.manualProductIds);
        s.startDate = input.startDate; s.endDate = input.endDate; return sections.save(s);
    }

    @PutMapping("/sections/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public List<HomepageSection> reorder(@RequestBody List<Long> ids) {
        List<HomepageSection> all = sections.findAll(); Map<Long, HomepageSection> byId = all.stream().collect(Collectors.toMap(x -> x.id, x -> x));
        int order = 1; for (Long id : ids == null ? List.<Long>of() : ids) { HomepageSection s = byId.remove(id); if (s != null) s.displayOrder = order++; }
        for (HomepageSection s : byId.values()) s.displayOrder = order++; return sections.saveAll(all);
    }

    @PostMapping("/events/cart-add")
    public void cartAdd(@RequestBody Map<String, Object> body) {
        Object raw = body == null ? null : body.get("productId"); if (raw == null) return;
        try { Long id = Long.valueOf(String.valueOf(raw)); if (products.existsById(id)) { ProductCartAdd e = new ProductCartAdd(); e.productId = id; cartAdds.save(e); } }
        catch (NumberFormatException ignored) { }
    }

    private void saveDefault(String title, String slug, HomepageSection.SectionType type, int order) {
        HomepageSection s = new HomepageSection(); s.title = title; s.slug = slug; s.sectionType = type; s.displayOrder = order;
        s.productMode = HomepageSection.ProductMode.AUTOMATIC; s.maxProducts = 10; s.active = true; s.showViewAll = true; sections.save(s);
    }
    private List<Product> liveProducts() { return products.findAll().stream().filter(p -> p.status == Product.Status.LIVE && p.stock > 0).collect(Collectors.toCollection(ArrayList::new)); }
    private Analytics analytics() { return new Analytics(grouped(views.countGroupedByProduct()), grouped(cartAdds.countGroupedByProduct())); }
    private Map<Long, Long> grouped(List<Object[]> rows) { Map<Long, Long> result = new HashMap<>(); for (Object[] row : rows) if (row != null && row.length >= 2 && row[0] != null) result.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue()); return result; }

    private List<Product> selectProducts(HomepageSection section, List<Product> all, Analytics a) {
        List<Product> automatic = switch (section.sectionType) {
            case TRENDING -> all.stream().sorted(Comparator.comparingDouble((Product p) -> trendingScore(p, a)).reversed()).toList();
            case BEST_SELLERS -> all.stream().sorted(Comparator.comparingInt((Product p) -> p.sales).reversed()).toList();
            case DEALS -> all.stream().filter(this::isActiveDeal).sorted(Comparator.comparingDouble(this::discountPercent).reversed()).toList();
            case CATEGORY -> categoryProducts(section, all);
            case NEW_ARRIVALS -> all.stream().sorted(Comparator.comparing((Product p) -> p.createdAt).reversed()).toList();
            case TOP_RATED -> all.stream().filter(p -> p.rating >= 4.0 && p.reviews >= 5)
                    .sorted(Comparator.comparingDouble((Product p) -> p.rating).reversed().thenComparing(Comparator.comparingInt((Product p) -> p.reviews).reversed())).toList();
        };
        List<Long> manualIds = parseIds(section.manualProductIds); Map<Long, Product> byId = all.stream().collect(Collectors.toMap(p -> p.id, p -> p, (a1, b1) -> a1));
        List<Product> manual = manualIds.stream().map(byId::get).filter(Objects::nonNull).toList(); int max = Math.max(1, Math.min(30, section.maxProducts));
        if (section.productMode == HomepageSection.ProductMode.MANUAL) return manual.stream().limit(max).toList();
        if (section.productMode == HomepageSection.ProductMode.HYBRID) {
            Set<Long> selected = manual.stream().map(p -> p.id).collect(Collectors.toSet()); List<Product> merged = new ArrayList<>(manual);
            automatic.stream().filter(p -> !selected.contains(p.id)).limit(Math.max(0, max - merged.size())).forEach(merged::add); return merged.stream().limit(max).toList();
        }
        return automatic.stream().limit(max).toList();
    }

    private List<Product> categoryProducts(HomepageSection section, List<Product> all) {
        if (section.categoryId == null) return List.of(); Optional<Category> c = categories.findById(section.categoryId); if (c.isEmpty()) return List.of();
        String name = c.get().name == null ? "" : c.get().name.trim(); String slug = c.get().slug == null ? "" : c.get().slug.trim();
        return all.stream().filter(p -> equalsIgnoreCase(p.category, name) || equalsIgnoreCase(p.category, slug)).sorted(Comparator.comparing((Product p) -> p.createdAt).reversed()).toList();
    }
    private double trendingScore(Product p, Analytics a) { return a.views.getOrDefault(p.id, 0L) + Math.max(0, p.likes) * 3.0 + a.cartAdds.getOrDefault(p.id, 0L) * 5.0 + Math.max(0, p.sales) * 10.0; }
    private boolean isActiveDeal(Product p) { Instant now = Instant.now(); return p.salePrice != null && p.salePrice > 0 && p.dealStart != null && p.dealEnd != null && !p.dealStart.isAfter(now) && !p.dealEnd.isBefore(now); }
    private double discountPercent(Product p) { if (p.discountPercent != null) return Math.max(0, p.discountPercent); if (p.oldPrice > p.price && p.oldPrice > 0) return (p.oldPrice - p.price) * 100.0 / p.oldPrice; return 0; }

    private Map<String, Object> responseSection(HomepageSection s, List<Product> selected) {
        populateImages(selected); Map<String, Object> row = new LinkedHashMap<>(); row.put("id", s.id); row.put("title", s.title); row.put("type", s.sectionType); row.put("slug", s.slug); row.put("showViewAll", s.showViewAll); row.put("products", selected); return row;
    }
    private Map<String, Object> adminSection(HomepageSection s, List<Product> selected) {
        Map<String, Object> row = new LinkedHashMap<>(responseSection(s, selected)); row.put("productMode", s.productMode); row.put("displayOrder", s.displayOrder); row.put("active", s.active); row.put("maxProducts", s.maxProducts); row.put("categoryId", s.categoryId); row.put("manualProductIds", parseIds(s.manualProductIds)); row.put("startDate", s.startDate); row.put("endDate", s.endDate); return row;
    }
    private Map<String, Object> candidate(Product p, Analytics a) {
        Map<String, Object> row = new LinkedHashMap<>(); row.put("id", p.id); row.put("name", p.name); row.put("category", p.category); row.put("price", p.price); row.put("salePrice", p.salePrice); row.put("rating", p.rating); row.put("reviews", p.reviews); row.put("sales", p.sales); row.put("likes", p.likes); row.put("views", a.views.getOrDefault(p.id, 0L)); row.put("cartAdds", a.cartAdds.getOrDefault(p.id, 0L)); row.put("image", imageUrl(p)); return row;
    }
    private void populateImages(List<Product> rows) { for (Product p : rows) { List<ProductImage> imgs = images.findByProductIdOrderByDisplayOrderAsc(p.id); List<String> urls = imgs.stream().map(x -> x.cloudinaryUrl != null && !x.cloudinaryUrl.isBlank() ? x.cloudinaryUrl : "/api/products/" + p.id + "/images/" + x.id).toList(); p.images = urls; if ((p.image == null || p.image.isBlank()) && !urls.isEmpty()) p.image = urls.get(0); } }
    private String imageUrl(Product p) { List<ProductImage> imgs = images.findByProductIdOrderByDisplayOrderAsc(p.id); if (!imgs.isEmpty() && imgs.get(0).cloudinaryUrl != null && !imgs.get(0).cloudinaryUrl.isBlank()) return imgs.get(0).cloudinaryUrl; return p.image; }
    private boolean withinSchedule(HomepageSection s) { Instant now = Instant.now(); return (s.startDate == null || !now.isBefore(s.startDate)) && (s.endDate == null || !now.isAfter(s.endDate)); }
    private String normalizeIds(String value) { return parseIds(value).stream().map(String::valueOf).collect(Collectors.joining(",")); }
    private List<Long> parseIds(String value) { if (value == null || value.isBlank()) return List.of(); List<Long> ids = new ArrayList<>(); for (String token : value.split(",")) try { Long id = Long.valueOf(token.trim()); if (!ids.contains(id)) ids.add(id); } catch (NumberFormatException ignored) { } return ids; }
    private String safe(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
    private boolean equalsIgnoreCase(String a, String b) { return a != null && b != null && a.trim().equalsIgnoreCase(b.trim()); }
    private record Analytics(Map<Long, Long> views, Map<Long, Long> cartAdds) { }
}
