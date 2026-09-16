package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductColorVariant;
import com.wissfind.marketplace.entity.ProductSizeVariant;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.ProductColorVariantRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.service.CloudinaryImageService;
import com.wissfind.marketplace.service.CurrentUser;
import jakarta.persistence.EntityManager;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/products")
public class ProductVariantController {
    private static final long MAX_IMAGE_SIZE = 5L * 1024 * 1024;

    private final ProductRepository products;
    private final ProductColorVariantRepository colors;
    private final UserRepository users;
    private final CloudinaryImageService cloudinary;
    private final EntityManager entityManager;

    public ProductVariantController(ProductRepository products, ProductColorVariantRepository colors,
                                    UserRepository users, CloudinaryImageService cloudinary,
                                    EntityManager entityManager) {
        this.products = products;
        this.colors = colors;
        this.users = users;
        this.cloudinary = cloudinary;
        this.entityManager = entityManager;
    }

    @GetMapping("/{productId}/variants")
    @Transactional(readOnly = true)
    public List<ColorVariantResponse> list(@PathVariable Long productId) {
        return colors.findByProductIdOrderByIdAsc(productId).stream().map(this::response).toList();
    }

    @PutMapping("/{productId}/variants")
    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public List<ColorVariantResponse> replace(@PathVariable Long productId,
                                               @RequestBody List<ColorVariantRequest> requests) {
        Product product = owned(productId);
        if (requests == null) requests = List.of();

        Map<String, ColorVariantRequest> uniqueColors = new LinkedHashMap<>();
        Set<String> uniqueSkus = new HashSet<>();
        for (ColorVariantRequest request : requests) {
            if (request == null || request.color == null || request.color.isBlank()) continue;
            String color = request.color.trim();
            if (uniqueColors.putIfAbsent(color.toLowerCase(Locale.ROOT), request) != null) {
                throw new IllegalArgumentException("Duplicate color variant: " + color);
            }
            if (request.sizes != null) {
                for (SizeVariantRequest sizeRequest : request.sizes) {
                    if (sizeRequest == null || sizeRequest.sku == null || sizeRequest.sku.isBlank()) continue;
                    String sku = sizeRequest.sku.trim().toLowerCase(Locale.ROOT);
                    if (!uniqueSkus.add(sku)) {
                        throw new IllegalArgumentException("Duplicate SKU: " + sizeRequest.sku.trim());
                    }
                }
            }
        }

        // This PUT is the variant UPDATE operation. Delete the previous graph first
        // and force Hibernate to execute the DELETE before inserting replacement rows.
        colors.deleteByProductId(productId);
        entityManager.flush();
        entityManager.clear();

        product = products.findById(productId).orElseThrow();
        List<ProductColorVariant> saved = new ArrayList<>();
        int totalStock = 0;
        double minPrice = Double.MAX_VALUE;
        double minOldPrice = Double.MAX_VALUE;
        List<String> colorNames = new ArrayList<>();
        LinkedHashSet<String> sizeNames = new LinkedHashSet<>();

        for (ColorVariantRequest request : uniqueColors.values()) {
            ProductColorVariant colorVariant = new ProductColorVariant();
            colorVariant.product = product;
            colorVariant.color = request.color.trim();
            colorVariant.images = cleanStrings(request.images);

            LinkedHashSet<String> seenSizes = new LinkedHashSet<>();
            if (request.sizes != null) {
                for (SizeVariantRequest sizeRequest : request.sizes) {
                    if (sizeRequest == null || sizeRequest.size == null || sizeRequest.size.isBlank()) continue;
                    String size = sizeRequest.size.trim();
                    if (!seenSizes.add(size.toLowerCase(Locale.ROOT))) {
                        throw new IllegalArgumentException("Duplicate size " + size + " for color " + colorVariant.color);
                    }
                    if (sizeRequest.sku == null || sizeRequest.sku.isBlank()) {
                        throw new IllegalArgumentException("SKU is required for " + colorVariant.color + " / " + size);
                    }
                    if (sizeRequest.price <= 0) {
                        throw new IllegalArgumentException("Price must be greater than 0 for " + colorVariant.color + " / " + size);
                    }
                    ProductSizeVariant sizeVariant = new ProductSizeVariant();
                    sizeVariant.colorVariant = colorVariant;
                    sizeVariant.size = size;
                    sizeVariant.sku = sizeRequest.sku.trim();
                    sizeVariant.price = sizeRequest.price;
                    sizeVariant.oldPrice = Math.max(0, sizeRequest.oldPrice);
                    sizeVariant.stock = Math.max(0, sizeRequest.stock);
                    colorVariant.sizes.add(sizeVariant);
                    totalStock += sizeVariant.stock;
                    minPrice = Math.min(minPrice, sizeVariant.price);
                    if (sizeVariant.oldPrice > 0) minOldPrice = Math.min(minOldPrice, sizeVariant.oldPrice);
                    sizeNames.add(size);
                }
            }
            if (colorVariant.sizes.isEmpty()) {
                throw new IllegalArgumentException("At least one size is required for color " + colorVariant.color);
            }
            colorNames.add(colorVariant.color);
            saved.add(colors.save(colorVariant));
        }

        product.colors = colorNames;
        product.sizes = new ArrayList<>(sizeNames);
        if (!saved.isEmpty()) {
            product.stock = totalStock;
            product.price = minPrice == Double.MAX_VALUE ? product.price : minPrice;
            product.oldPrice = minOldPrice == Double.MAX_VALUE ? 0 : minOldPrice;
        }
        products.save(product);
        entityManager.flush();
        return saved.stream().map(this::response).toList();
    }

    @Transactional
    @PostMapping(value = "/{productId}/variants/{colorVariantId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    public ColorVariantResponse uploadImages(@PathVariable Long productId,
                                              @PathVariable Long colorVariantId,
                                              @RequestPart("files") List<MultipartFile> files) throws IOException {
        Product product = owned(productId);
        ProductColorVariant variant = colors.findById(colorVariantId).orElseThrow();
        if (variant.product == null || !Objects.equals(variant.product.id, product.id)) {
            throw new IllegalArgumentException("Color variant does not belong to this product.");
        }
        if (files == null || files.isEmpty()) throw new IllegalArgumentException("No image files were received.");
        if (variant.images == null) variant.images = new ArrayList<>();
        for (MultipartFile file : files) {
            validateImage(file);
            byte[] bytes = file.getBytes();
            String publicId = "variant-" + UUID.randomUUID();
            CloudinaryImageService.UploadedImage uploaded = cloudinary.upload(bytes, "wissfind/products/" + product.id + "/variants", publicId);
            variant.images.add(uploaded.secureUrl());
        }
        colors.save(variant);
        return response(variant);
    }

    @DeleteMapping("/{productId}/variants/{colorVariantId}/images")
    @Transactional
    @PreAuthorize("hasRole('SELLER')")
    public ColorVariantResponse removeImage(@PathVariable Long productId,
                                             @PathVariable Long colorVariantId,
                                             @RequestParam String url) {
        Product product = owned(productId);
        ProductColorVariant variant = colors.findById(colorVariantId).orElseThrow();
        if (variant.product == null || !Objects.equals(variant.product.id, product.id)) {
            throw new IllegalArgumentException("Color variant does not belong to this product.");
        }
        if (variant.images != null) variant.images.removeIf(image -> Objects.equals(image, url));
        return response(colors.save(variant));
    }

    private Product owned(Long id) {
        Product product = products.findById(id).orElseThrow();
        User seller = users.findById(CurrentUser.id()).orElseThrow();
        if (product.seller == null || !Objects.equals(product.seller.id, seller.id)) {
            throw new org.springframework.security.access.AccessDeniedException("You do not own this product.");
        }
        return product;
    }

    private List<String> cleanStrings(List<String> values) {
        if (values == null) return new ArrayList<>();
        return values.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isBlank()).distinct().toList();
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Empty image file received.");
        if (file.getSize() > MAX_IMAGE_SIZE) throw new IllegalArgumentException("Each image must be 5 MB or smaller.");
        String type = file.getContentType();
        if (type == null || !Set.of("image/jpeg", "image/png", "image/webp", "image/gif").contains(type.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Only JPG, PNG, WEBP and GIF images are allowed.");
        }
    }

    private ColorVariantResponse response(ProductColorVariant value) {
        List<SizeVariantResponse> sizes = value.sizes == null ? List.of() : value.sizes.stream()
                .map(v -> new SizeVariantResponse(v.id, v.size, v.sku, v.price, v.oldPrice, v.stock)).toList();
        return new ColorVariantResponse(value.id, value.color, value.images == null ? List.of() : List.copyOf(value.images), sizes);
    }

    public static class ColorVariantRequest {
        public String color;
        public List<String> images;
        public List<SizeVariantRequest> sizes;
    }

    public static class SizeVariantRequest {
        public String size;
        public String sku;
        public double price;
        public double oldPrice;
        public int stock;
    }

    public record ColorVariantResponse(Long id, String color, List<String> images, List<SizeVariantResponse> sizes) {}
    public record SizeVariantResponse(Long id, String size, String sku, double price, double oldPrice, int stock) {}
}
