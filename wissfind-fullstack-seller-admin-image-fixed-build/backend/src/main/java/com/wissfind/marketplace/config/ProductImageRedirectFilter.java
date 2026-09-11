package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.repo.ProductImageRepository;
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
 *
 * The Angular seller screen can still hold URLs such as
 * /api/products/{productId}/images/{imageId}. New image rows store their
 * bytes in Cloudinary, so the legacy controller cannot serve imageData.
 * Redirect those requests to the stored Cloudinary HTTPS URL instead.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ProductImageRedirectFilter extends OncePerRequestFilter {

    private static final Pattern PATH = Pattern.compile(
            "^/api/products/(\\d+)/images/(\\d+)/?$"
    );

    private final ProductImageRepository images;

    public ProductImageRedirectFilter(ProductImageRepository images) {
        this.images = images;
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

            if (image != null
                    && image.product != null
                    && productId.equals(image.product.id)
                    && isHttpUrl(image.cloudinaryUrl)) {
                response.sendRedirect(image.cloudinaryUrl);
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
