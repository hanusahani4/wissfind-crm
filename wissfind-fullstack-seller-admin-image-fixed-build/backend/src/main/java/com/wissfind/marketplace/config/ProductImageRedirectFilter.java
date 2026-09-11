package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.repo.ProductRepository;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps legacy product-image URLs working after the Cloudinary migration.
 * This is intentionally global so customer, seller and admin screens all
 * behave the same when an old relative image URL is still present in the UI.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ProductImageRedirectFilter extends OncePerRequestFilter {

    private static final Pattern PATH = Pattern.compile(
            "^/api/products/(\\d+)/images/(\\d+)/?$"
    );

    private final ProductImageRepository images;
    private final ProductRepository products;
    private final CloudinaryImageService cloudinary;

    public ProductImageRedirectFilter(ProductImageRepository images,
                                      ProductRepository products,
                                      CloudinaryImageService cloudinary) {
        this.images = images;
        this.products = products;
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

        Matcher matcher = PATH.matcher(request.getRequestURI());
        if (!matcher.matches()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Long productId = Long.valueOf(matcher.group(1));
            Long imageId = Long.valueOf(matcher.group(2));
            ProductImage image = images.findById(imageId).orElse(null);

            if (image == null || image.product == null || !productId.equals(image.product.id)) {
                filterChain.doFilter(request, response);
                return;
            }

            // New rows normally have the URL. Migrated rows may only have the
            // Cloudinary public id, so reconstruct the delivery URL on demand.
            String url = image.cloudinaryUrl;
            if (!isHttpUrl(url)) {
                url = cloudinary.secureUrl(image.cloudinaryPublicId);
            }

            // Some existing rows may have lost the image-row URL while the
            // Product still has its Cloudinary primary image URL. Use it as a
            // final compatibility fallback rather than returning a 404.
            if (!isHttpUrl(url)) {
                Product product = products.findById(productId).orElse(null);
                if (product != null && isHttpUrl(product.image)) {
                    url = product.image;
                }
            }

            if (isHttpUrl(url)) {
                response.setStatus(HttpServletResponse.SC_FOUND);
                response.setHeader("Location", url);
                return;
            }
        } catch (Exception ignored) {
            // Fall through to the existing legacy endpoint.
        }

        filterChain.doFilter(request, response);
    }

    private boolean isHttpUrl(String value) {
        return value != null
                && !value.isBlank()
                && (value.startsWith("https://") || value.startsWith("http://"));
    }
}
