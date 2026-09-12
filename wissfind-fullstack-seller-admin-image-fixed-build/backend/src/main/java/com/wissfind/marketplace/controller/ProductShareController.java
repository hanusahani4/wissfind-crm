package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.repo.ProductRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;

/**
 * Serves the Angular shell for product URLs with product-specific Open Graph
 * metadata. Social crawlers (including WhatsApp) can read the title, URL and
 * image before JavaScript runs, while normal browsers still bootstrap Angular.
 */
@RestController
public class ProductShareController {

    private final ProductRepository products;

    public ProductShareController(ProductRepository products) {
        this.products = products;
    }

    @GetMapping(value = "/product/{id}", produces = MediaType.TEXT_HTML_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<String> productPage(@PathVariable Long id, HttpServletRequest request) throws Exception {
        Product product = products.findById(id).orElse(null);
        String html = new String(new ClassPathResource("static/index.html").getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        if (product == null) {
            return ResponseEntity.ok(html);
        }

        String baseUrl = baseUrl(request);
        String pageUrl = baseUrl + "/product/" + id;
        String imageUrl = absoluteUrl(product.image, baseUrl);
        String title = product.name == null || product.name.isBlank() ? "WISSFIND Product" : product.name;
        String description = product.description == null || product.description.isBlank()
                ? "Shop this product on WISSFIND."
                : product.description;

        String meta = """
                <meta property="og:type" content="product">
                <meta property="og:title" content="%s">
                <meta property="og:description" content="%s">
                <meta property="og:url" content="%s">
                %s
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="%s">
                <meta name="twitter:description" content="%s">
                %s
                """.formatted(
                esc(title), esc(description), esc(pageUrl),
                imageUrl.isBlank() ? "" : "<meta property=\"og:image\" content=\"" + esc(imageUrl) + "\">",
                esc(title), esc(description),
                imageUrl.isBlank() ? "" : "<meta name=\"twitter:image\" content=\"" + esc(imageUrl) + "\">"
        );

        String result = html.replaceFirst("(?i)</head>", Matcher.quoteReplacement(meta + "</head>"));
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(result);
    }

    private String baseUrl(HttpServletRequest request) {
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        String forwardedHost = request.getHeader("X-Forwarded-Host");
        String scheme = forwardedProto == null || forwardedProto.isBlank() ? request.getScheme() : forwardedProto.split(",")[0].trim();
        String host = forwardedHost == null || forwardedHost.isBlank() ? request.getHeader("Host") : forwardedHost.split(",")[0].trim();
        if (host == null || host.isBlank()) host = request.getServerName() + ":" + request.getServerPort();
        return scheme + "://" + host;
    }

    private String absoluteUrl(String value, String baseUrl) {
        if (value == null || value.isBlank()) return "";
        String trimmed = value.trim();
        if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed;
        return baseUrl + (trimmed.startsWith("/") ? trimmed : "/" + trimmed);
    }

    private String esc(String value) {
        return value.replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("'", "&#39;");
    }
}
