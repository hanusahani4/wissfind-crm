package com.wissfind.marketplace.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.wissfind.marketplace.entity.ProductImage;
import com.wissfind.marketplace.repo.ProductImageRepository;
import com.wissfind.marketplace.service.CloudinaryImageService;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Final response-level guard: JSON image URLs exposed by the marketplace are
 * normalized to Cloudinary HTTPS URLs. This keeps customer, seller and admin
 * payloads consistent when old database rows still contain relative image URLs.
 */
@RestControllerAdvice
public class CloudinaryImageResponseAdvice implements ResponseBodyAdvice<Object> {

    private static final Pattern IMAGE = Pattern.compile("^/api/products/(\\d+)/images/(\\d+)/?$");
    private static final Pattern PRIMARY = Pattern.compile("^/api/products/(\\d+)/image/?$");

    private final ObjectMapper mapper;
    private final ProductImageRepository images;
    private final CloudinaryImageService cloudinary;

    public CloudinaryImageResponseAdvice(ObjectMapper mapper,
                                         ProductImageRepository images,
                                         CloudinaryImageService cloudinary) {
        this.mapper = mapper;
        this.images = images;
        this.cloudinary = cloudinary;
    }

    @Override
    public boolean supports(MethodParameter returnType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return MappingJackson2HttpMessageConverter.class.isAssignableFrom(converterType);
    }

    @Override
    public Object beforeBodyWrite(Object body,
                                  MethodParameter returnType,
                                  MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request,
                                  ServerHttpResponse response) {
        if (body == null || selectedContentType == null
                || !MediaType.APPLICATION_JSON.isCompatibleWith(selectedContentType)) {
            return body;
        }
        try {
            JsonNode root = mapper.valueToTree(body);
            rewrite(root);
            return root;
        } catch (Exception ignored) {
            return body;
        }
    }

    private void rewrite(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode object = (ObjectNode) node;
            object.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                if (value != null && value.isTextual()) {
                    object.put(entry.getKey(), cloudinaryUrl(value.asText()));
                } else {
                    rewrite(value);
                }
            });
        } else if (node.isArray()) {
            ArrayNode array = (ArrayNode) node;
            for (int i = 0; i < array.size(); i++) {
                JsonNode value = array.get(i);
                if (value != null && value.isTextual()) {
                    array.set(i, mapper.getNodeFactory().textNode(cloudinaryUrl(value.asText())));
                } else {
                    rewrite(value);
                }
            }
        }
    }

    private String cloudinaryUrl(String value) {
        if (value == null || value.isBlank()
                || value.startsWith("https://") || value.startsWith("http://")) {
            return value;
        }

        Matcher image = IMAGE.matcher(value);
        if (image.matches()) {
            try {
                Long imageId = Long.valueOf(image.group(2));
                Optional<ProductImage> row = images.findById(imageId);
                if (row.isPresent()) {
                    ProductImage pi = row.get();
                    if (pi.cloudinaryUrl != null && !pi.cloudinaryUrl.isBlank()) return pi.cloudinaryUrl;
                    String generated = cloudinary.secureUrl(pi.cloudinaryPublicId);
                    if (generated != null && !generated.isBlank()) return generated;
                }
            } catch (Exception ignored) { }
            return value;
        }

        Matcher primary = PRIMARY.matcher(value);
        if (primary.matches()) {
            try {
                Long productId = Long.valueOf(primary.group(1));
                return images.findByProductIdOrderByDisplayOrderAsc(productId).stream()
                        .map(pi -> pi.cloudinaryUrl != null && !pi.cloudinaryUrl.isBlank()
                                ? pi.cloudinaryUrl
                                : cloudinary.secureUrl(pi.cloudinaryPublicId))
                        .filter(u -> u != null && !u.isBlank())
                        .findFirst()
                        .orElse(value);
            } catch (Exception ignored) { }
        }
        return value;
    }
}
