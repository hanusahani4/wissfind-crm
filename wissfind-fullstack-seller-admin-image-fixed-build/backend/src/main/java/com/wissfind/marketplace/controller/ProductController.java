package com.wissfind.marketplace.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private static final long MAX_IMAGE_SIZE = 5L * 1024 * 1024;

    private final ProductRepository repo;
    private final ProductImageRepository imageRepo;
    private final UserRepository users;
    private final ObjectMapper mapper;

    public ProductController(ProductRepository repo, ProductImageRepository imageRepo,
                              UserRepository users, ObjectMapper mapper) {
        this.repo = repo;
        this.imageRepo = imageRepo;
        this.users = users;
        this.mapper = mapper;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Product> list() {
        List<Product> result = repo.findAll().stream()
                .filter(p -> p.status == Product.Status.LIVE && p.stock > 0)
                .toList();

        populateImages(result);
        return result;
    }

    /** Server-side catalogue pagination used by compare and price-alert pages. */
    @GetMapping("/paged")
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<Product> paged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "") String search) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        var pageable = org.springframework.data.domain.PageRequest.of(
                safePage, safeSize,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        var spec = com.wissfind.marketplace.repo.SearchSpec.<Product>contains(
                search, "name", "sku", "brand", "category", "subcategory", "seller.name");
        var live = (org.springframework.data.jpa.domain.Specification<Product>) (root, query, cb) -> cb.and(
                cb.equal(root.get("status"), Product.Status.LIVE),
                cb.greaterThan(root.get("stock"), 0));
        var combined = spec == null ? live : live.and(spec);

        var result = repo.findAll(combined, pageable);
        populateImages(result.getContent());
        return result;
    }

    @GetMapping("/category/{category}")
    @Transactional(readOnly = true)
    public List<Product> byCategory(@PathVariable String category) {
        List<Product> result = repo.findByCategoryIgnoreCaseAndStatusAndStockGreaterThan(
                        category, Product.Status.LIVE, 0);

        populateImages(result);
        return result;
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Product get(@PathVariable Long id) {
        return withImages(repo.findById(id).orElseThrow());
    }

    @GetMapping("/seller")
    @PreAuthorize("hasRole('SELLER')")
    @Transactional(readOnly = true)
    public List<Product> seller() {
        List<Product> result = repo.findBySellerIdOrderByCreatedAtDesc(CurrentUser.id());
        populateImages(result);
        return result;
    }

    @PostMapping
    @PreAuthorize("hasRole('SELLER')")
    public Product create(@RequestBody Product product) {
        product.id = null;
        product.seller = currentSeller();
        normalizeAndValidate(product, null);
        product.status = statusFor(product.stock);
        normalizeCollections(product);
        return withImages(repo.save(product));
    }

    @Transactional
    @PostMapping(value = "/multipart", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    public Product createMultipart(
            @RequestPart("product") String productJson,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestPart(value = "images", required = false) List<MultipartFile> images) throws IOException {

        Product product = mapper.readValue(productJson, Product.class);
        product.id = null;
        product.seller = currentSeller();
        normalizeAndValidate(product, null);
        product.status = statusFor(product.stock);
        normalizeCollections(product);

        List<MultipartFile> incoming = merge(files, images);
        if (incoming.isEmpty()) {
            throw new IllegalArgumentException("At least one product image is required.");
        }

        Product saved = repo.save(product);
        saveImages(saved, incoming);
        return withImages(repo.save(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SELLER')")
    public Product update(@PathVariable Long id, @RequestBody Product input) {
        Product product = owned(id);
        normalizeAndValidate(input, id);

        product.name = input.name;
        product.category = input.category;
        product.subcategory = input.subcategory;
        product.type = input.type;
        product.brand = input.brand;
        product.gender = input.gender;
        product.material = input.material;
        product.warranty = input.warranty;
        product.returnDays = input.returnDays;
        product.weight = input.weight;
        product.dimensions = input.dimensions;
        product.hsnCode = input.hsnCode;
        product.taxIncluded = input.taxIncluded;
        product.featured = input.featured;
        product.gstPercent = input.gstPercent;
        product.sku = input.sku;
        product.description = input.description;
        product.price = input.price;
        product.oldPrice = input.oldPrice;
        product.shippingFee = input.shippingFee;
        product.platformFee = input.platformFee;
        product.stock = input.stock;
        product.tags = unique(input.tags);
        product.colors = unique(input.colors);
        product.sizes = unique(input.sizes);
        product.status = statusFor(product.stock);

        return withImages(repo.save(product));
    }

    @Transactional
    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    public Product uploadImages(
            @PathVariable Long id,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestPart(value = "images", required = false) List<MultipartFile> images) throws IOException {

        Product product = owned(id);
        List<MultipartFile> incoming = merge(files, images);
        if (incoming.isEmpty()) {
            throw new IllegalArgumentException("No image files were received.");
        }
        saveImages(product, incoming);
        return withImages(repo.save(product));
    }

    @Transactional(readOnly = true)
    @GetMapping("/{productId}/image")
    public ResponseEntity<byte[]> primaryImage(@PathVariable Long productId) {
        ProductImage image = imageRepo.findByProductIdOrderByDisplayOrderAsc(productId)
                .stream()
                .findFirst()
                .orElse(null);

        return imageResponse(image);
    }

    @Transactional(readOnly = true)
    @GetMapping("/{productId}/images/{imageId}")
    public ResponseEntity<byte[]> image(@PathVariable Long productId, @PathVariable Long imageId) {
        ProductImage image = imageRepo.findById(imageId).orElse(null);

        // If an old/stale image URL is present, use the product's current first
        // image instead of returning a broken storefront image.
        if (image == null || image.product == null || !Objects.equals(image.product.id, productId)) {
            image = imageRepo.findByProductIdOrderByDisplayOrderAsc(productId)
                    .stream()
                    .findFirst()
                    .orElse(null);
        }

        return imageResponse(image);
    }

    private ResponseEntity<byte[]> imageResponse(ProductImage image) {
        if (image == null || image.imageData == null || image.imageData.length == 0) {
            return ResponseEntity.notFound().build();
        }

        MediaType type = MediaType.APPLICATION_OCTET_STREAM;
        if (image.contentType != null && !image.contentType.isBlank()) {
            try {
                type = MediaType.parseMediaType(image.contentType);
            } catch (Exception ignored) {
                // Keep safe binary fallback.
            }
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .contentType(type)
                .body(image.imageData);
    }

    @Transactional
    @DeleteMapping("/{productId}/images/{imageId}")
    @PreAuthorize("hasRole('SELLER')")
    public Product deleteImage(@PathVariable Long productId, @PathVariable Long imageId) {
        Product product = owned(productId);
        ProductImage image = imageRepo.findById(imageId).orElseThrow();
        if (image.product == null || !Objects.equals(image.product.id, product.id)) {
            throw new IllegalArgumentException("Image does not belong to this product.");
        }
        imageRepo.delete(image);
        List<ProductImage> remaining = imageRepo.findByProductIdOrderByDisplayOrderAsc(product.id);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).displayOrder = i;
        }
        imageRepo.saveAll(remaining);
        product.image = remaining.isEmpty() ? null : primaryImageUrl(product.id);
        return withImages(repo.save(product));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public List<Product> admin() {
        List<Product> result = repo.findAll();
        populateImages(result);
        return result;
    }

    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public Product approve(@PathVariable Long id) {
        Product product = repo.findById(id).orElseThrow();
        product.status = statusFor(product.stock);
        if (product.status == Product.Status.PENDING) product.status = Product.Status.LIVE;
        return withImages(repo.save(product));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public Product reject(@PathVariable Long id) {
        Product product = repo.findById(id).orElseThrow();
        product.status = Product.Status.REJECTED;
        return withImages(repo.save(product));
    }

    @Transactional
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SELLER')")
    public void delete(@PathVariable Long id) {
        Product product = owned(id);
        imageRepo.deleteByProductId(product.id);
        repo.delete(product);
    }

    @Transactional
    @DeleteMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void adminDelete(@PathVariable Long id) {
        imageRepo.deleteByProductId(id);
        repo.deleteById(id);
    }

    @PatchMapping("/{id}/stock")
    @PreAuthorize("hasRole('SELLER')")
    public Product stock(@PathVariable Long id, @RequestParam int quantity) {
        Product product = owned(id);
        product.stock = Math.max(0, product.stock + quantity);
        if (product.stock == 0) product.status = Product.Status.OUT_OF_STOCK;
        return withImages(repo.save(product));
    }

    private User currentSeller() {
        return users.findById(CurrentUser.id()).orElseThrow();
    }

    private Product.Status statusFor(int stock) {
        return stock <= 0 ? Product.Status.OUT_OF_STOCK : Product.Status.PENDING;
    }

    private List<MultipartFile> merge(List<MultipartFile> files, List<MultipartFile> images) {
        List<MultipartFile> result = new ArrayList<>();
        if (files != null) result.addAll(files);
        if (images != null) result.addAll(images);
        return result.stream().filter(Objects::nonNull).filter(f -> !f.isEmpty()).toList();
    }

    private void saveImages(Product product, List<MultipartFile> files) throws IOException {
        List<ProductImage> existing = imageRepo.findByProductIdOrderByDisplayOrderAsc(product.id);
        int order = existing.size();

        for (MultipartFile file : files) {
            validateImage(file);
            byte[] bytes = file.getBytes();
            String hash = sha256(bytes);
            if (imageRepo.findByProductIdAndSha256(product.id, hash).isPresent()) continue;

            ProductImage image = new ProductImage();
            image.product = product;
            image.imageData = bytes;
            image.contentType = file.getContentType().toLowerCase(Locale.ROOT);
            image.fileName = safeFileName(file);
            image.sha256 = hash;
            image.displayOrder = order++;
            ProductImage saved = imageRepo.save(image);

            if (product.image == null || product.image.isBlank()) {
                product.image = imageUrl(product.id, saved.id);
            }
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Empty image file received.");
        if (file.getSize() > MAX_IMAGE_SIZE) throw new IllegalArgumentException("Each image must be 5 MB or smaller.");
        String type = file.getContentType();
        if (type == null || !Set.of("image/jpeg", "image/png", "image/webp", "image/gif")
                .contains(type.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Only JPG, PNG, WEBP and GIF images are allowed.");
        }
    }

    private String safeFileName(MultipartFile file) {
        return Optional.ofNullable(file.getOriginalFilename()).orElse("image")
                .replace("\\", "_").replace("/", "_");
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to calculate image hash", e);
        }
    }

    private String imageUrl(Long productId, Long imageId) {
        return "/api/products/" + productId + "/images/" + imageId;
    }

    private String primaryImageUrl(Long productId) {
        return "/api/products/" + productId + "/image";
    }

    /**
     * Loads all product images for a page in one query instead of one query
     * per product. This prevents the storefront/admin from becoming slow as
     * the catalog grows.
     */
    private void populateImages(List<Product> products) {
        if (products == null || products.isEmpty()) {
            return;
        }

        List<Long> productIds = products.stream()
                .map(p -> p.id)
                .filter(Objects::nonNull)
                .toList();

        if (productIds.isEmpty()) {
            return;
        }

        Map<Long, List<ProductImage>> imagesByProduct = imageRepo
                .findByProductIds(productIds)
                .stream()
                .collect(Collectors.groupingBy(
                        image -> image.product.id,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        for (Product product : products) {
            List<ProductImage> storedImages =
                    imagesByProduct.getOrDefault(product.id, Collections.emptyList());

            product.images = storedImages.stream()
                    .map(image -> imageUrl(product.id, image.id))
                    .toList();

            product.image = storedImages.isEmpty()
                    ? null
                    : primaryImageUrl(product.id);
        }
    }

    private Product withImages(Product product) {
        List<ProductImage> storedImages = imageRepo.findByProductIdOrderByDisplayOrderAsc(product.id);

        product.images = storedImages.stream()
                .map(x -> imageUrl(product.id, x.id))
                .toList();

        product.image = storedImages.isEmpty()
                ? null
                : primaryImageUrl(product.id);

        return product;
    }

    private void normalizeAndValidate(Product product, Long id) {
        if (product.name == null || product.name.isBlank()) throw new IllegalArgumentException("Product name is required");
        if (product.category == null || product.category.isBlank()) throw new IllegalArgumentException("Category is required");
        if (product.sku == null || product.sku.isBlank()) throw new IllegalArgumentException("SKU is required");
        product.sku = product.sku.trim().toUpperCase(Locale.ROOT);
        boolean duplicate = id == null ? repo.existsBySkuIgnoreCase(product.sku) : repo.existsBySkuIgnoreCaseAndIdNot(product.sku, id);
        if (duplicate) throw new IllegalArgumentException("SKU already exists");
        if (product.price <= 0) throw new IllegalArgumentException("Price must be greater than zero");
        if (product.stock < 0) throw new IllegalArgumentException("Stock cannot be negative");
        if (product.gstPercent < 0 || product.gstPercent > 100) throw new IllegalArgumentException("GST must be between 0 and 100");
        if (product.returnDays == null || product.returnDays < 0 || product.returnDays > 90) throw new IllegalArgumentException("Return period must be between 0 and 90 days");
    }

    private void normalizeCollections(Product product) {
        product.tags = unique(product.tags);
        product.colors = unique(product.colors);
        product.sizes = unique(product.sizes);
    }

    private List<String> unique(List<String> values) {
        if (values == null) return new ArrayList<>();
        return values.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isBlank()).distinct().collect(Collectors.toCollection(ArrayList::new));
    }

    private Product owned(Long id) {
        Product product = repo.findById(id).orElseThrow();
        if (product.seller == null || !product.seller.id.equals(CurrentUser.id())) throw new IllegalArgumentException("Not your product");
        return product;
    }
}
