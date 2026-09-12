package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.ProductView;
import com.wissfind.marketplace.repo.ProductViewRepository;
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

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class ProductViewFilter extends OncePerRequestFilter {
    private static final Pattern PRODUCT_DETAIL = Pattern.compile("^/api/products/(\\d+)/?$", Pattern.CASE_INSENSITIVE);
    private final ProductViewRepository views;

    public ProductViewFilter(ProductViewRepository views) { this.views = views; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        chain.doFilter(request, response);
        if (!"GET".equalsIgnoreCase(request.getMethod())) return;
        if (response.getStatus() < 200 || response.getStatus() >= 300) return;
        Matcher matcher = PRODUCT_DETAIL.matcher(request.getRequestURI());
        if (!matcher.matches()) return;
        try {
            ProductView view = new ProductView();
            view.productId = Long.valueOf(matcher.group(1));
            views.save(view);
        } catch (RuntimeException ignored) {
            // Analytics must never break a successful product response.
        }
    }
}
