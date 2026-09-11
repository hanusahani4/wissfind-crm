package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.service.CloudinaryImageService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Product images are delivered from Cloudinary only.
 *
 * The frontend may still have old API image URLs cached in product/order data.
 * Those URLs are intercepted here. If the image already has a Cloudinary URL
 * (or public id), the request is redirected to Cloudinary. If an old database
 * row still contains imageData, it is migrated to Cloudinary once and the
 * database row is updated; the browser still receives the image from
 * Cloudinary, never from the application server.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ProductImageRedirectFilter extends OncePerRequestFilter {

    private static final Pattern PRIMARY = Pattern.compile(
            "^/api/products/(\\d+)/image/?$"
    );
    private static final Pattern BY_ID = Pattern.compile(
            "^/api/products/(\\d+)/images/(\\d+)/?$"
    );

    private final ProductImageRepository images;
    private final CloudinaryImageService cloudinary;

    public ProductImageRedirectFilter(ProductImageRepository images,
                                      CloudinaryImageService cloudinary) {
        this.images = images;
        this.cloudinary = cloudinary;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        ProductImage image = resolveImage(request.getRequestURI());

        // These are image endpoints. Never serve image bytes from the backend.
        if (image == null) {
            if (PRIMARY.matcher(request.getRequestURI()).matches()
                    || BY_ID.matcher(request.getRequestURI()).matches()) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND, "Cloudinary image not found");
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        String url = image.cloudinaryUrl;
        if (!isHttpUrl(url)) {
            url = cloudinary.secureUrl(image.cloudinaryPublicId);
        }

        // One-time migration for legacy DB-backed images. This is migration,
        // not image delivery: after this succeeds imageData is cleared and the
        // actual browser request is redirected to Cloudinary.
        if (!isHttpUrl(url) && image.imageData != null && image.imageData.length > 0) {
            try {
                String publicId = image.cloudinaryPublicId;
                if (publicId == null || publicId.isBlank()) {
                    publicId = "product-" + image.id;
                }
                CloudinaryImageService.UploadedImage uploaded = cloudinary.upload(
                        image.imageData,
                        "wissfind/products/" + image.product.id,
                        publicId
                );
                image.cloudinaryPublicId = uploaded.publicId();
                image.cloudinaryUrl = uploaded.secureUrl();
                image.imageData = null;
                image = images.save(image);
                url = image.cloudinaryUrl;
            } catch (Exception ignored) {
                // Do not expose database bytes. The request remains Cloudinary-only.
            }
        }

        if (isHttpUrl(url)) {
            response.sendRedirect(url);
            return;
        }

        response.sendError(HttpServletResponse.SC_NOT_FOUND, "Cloudinary image not found");
    }

    private ProductImage resolveImage(String uri) {
        Matcher byId = BY_ID.matcher(uri);
        if (byId.matches()) {
            try {
                Long productId = Long.valueOf(byId.group(1));
                Long imageId = Long.valueOf(byId.group(2));
                ProductImage image = images.findById(imageId).orElse(null);
                if (image == null || image.product == null || !Objects.equals(image.product.id, productId)) {
                    return null;
                }
                return image;
            } catch (Exception ignored) {
                return null;
            }
        }

        Matcher primary = PRIMARY.matcher(uri);
        if (primary.matches()) {
            try {
                Long productId = Long.valueOf(primary.group(1));
                List<ProductImage> productImages = images.findByProductIdOrderByDisplayOrderAsc(productId);
                return productImages.isEmpty() ? null : productImages.get(0);
            } catch (Exception ignored) {
                return null;
            }
        }

        return null;
    }

    private boolean isHttpUrl(String value) {
        return value != null
                && !value.isBlank()
                && (value.startsWith("https://") || value.startsWith("http://"));
    }
}
