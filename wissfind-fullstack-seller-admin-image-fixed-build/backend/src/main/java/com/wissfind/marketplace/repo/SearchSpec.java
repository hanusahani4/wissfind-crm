package com.wissfind.marketplace.repo;

import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Path;
import java.util.Locale;

public final class SearchSpec {
    private SearchSpec() {}

    public static <T> Specification<T> contains(String value, String... fields) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        String[] terms = normalized.split("\\s+");
        return (root, query, cb) -> {
            var termPredicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            for (String term : terms) {
                if (term.isBlank()) continue;
                String like = "%" + term + "%";
                var fieldPredicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
                for (String field : fields) {
                    try {
                        Path<?> path = root;
                        for (String part : field.split("\\.")) path = path.get(part);
                        fieldPredicates.add(cb.like(cb.lower(path.as(String.class)), like));
                    } catch (IllegalArgumentException ignored) { }
                }
                if (!fieldPredicates.isEmpty()) {
                    // Every search word must match at least one searchable field.
                    termPredicates.add(cb.or(fieldPredicates.toArray(new jakarta.persistence.criteria.Predicate[0])));
                }
            }
            return termPredicates.isEmpty()
                    ? cb.conjunction()
                    : cb.and(termPredicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
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
