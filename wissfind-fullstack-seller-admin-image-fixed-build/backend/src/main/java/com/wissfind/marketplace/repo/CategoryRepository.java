package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.*;

public interface CategoryRepository extends JpaRepository<Category,Long>, JpaSpecificationExecutor<Category> {
 List<Category> findByParentIsNullAndActiveTrueOrderByName();
 List<Category> findByParentIdAndActiveTrueOrderByName(Long parentId);
 Optional<Category> findBySlugIgnoreCase(String slug);
 boolean existsBySlugIgnoreCase(String slug);
 boolean existsBySlugIgnoreCaseAndIdNot(String slug, Long id);
 boolean existsByParentId(Long parentId);
}
