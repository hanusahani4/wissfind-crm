package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.repo.ProductRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps the legacy /api/products/{id}/image URL used by existing orders
 * working after product images were moved to Cloudinary.
 *
 * Old order_items rows intentionally keep their checkout snapshot, including
 * this legacy URL. When that URL is requested, redirect it to the current
 * Cloudinary URL when the product has one. Legacy DB-backed products continue
 * through ProductController's original endpoint.
 */
@Component
public class ProductPrimaryImageRedirectFilter extends OncePerRequestFilter {

    private static final Pattern PATH = Pattern.compile("^/api/products/(\\d+)/image/?$");

    private final ProductRepository products;

    public ProductPrimaryImageRedirectFilter(ProductRepository products) {
        this.products = products;
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
            Product product = products.findById(productId).orElse(null);
            String imageUrl = product == null ? null : product.image;

            if (imageUrl != null
                    && !imageUrl.isBlank()
                    && (imageUrl.startsWith("https://") || imageUrl.startsWith("http://"))) {
                response.sendRedirect(imageUrl);
                return;
            }
        } catch (Exception ignored) {
            // Fall through to the existing legacy endpoint.
        }

        filterChain.doFilter(request, response);
    }
}
