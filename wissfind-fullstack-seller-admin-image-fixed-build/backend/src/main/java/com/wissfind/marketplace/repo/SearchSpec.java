package com.wissfind.marketplace.repo;

import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Path;
import java.util.Locale;

public final class SearchSpec {
    private SearchSpec() {}

    public static <T> Specification<T> contains(String value, String... fields) {
        if (value == null || value.isBlank()) return null;
        String like = "%" + value.trim().toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            for (String field : fields) {
                try {
                    Path<?> path = root;
                    for (String part : field.split("\\.")) path = path.get(part);
                    predicates.add(cb.like(cb.lower(path.as(String.class)), like));
                } catch (IllegalArgumentException ignored) { }
            }
            return predicates.isEmpty() ? cb.conjunction() : cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    public static <T> Specification<T> eq(String field, Object value) {
        return (root, query, cb) -> cb.equal(root.get(field), value);
    }

    public static <T> Specification<T> eqPath(String field, Object value) {
        return (root, query, cb) -> {
            Path<?> path = root;
            for (String part : field.split("\\.")) path = path.get(part);
            return cb.equal(path, value);
        };
    }
}
