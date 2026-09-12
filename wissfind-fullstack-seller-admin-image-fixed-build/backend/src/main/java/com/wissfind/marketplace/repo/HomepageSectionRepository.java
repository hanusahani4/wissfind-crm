package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.HomepageSection;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface HomepageSectionRepository extends JpaRepository<HomepageSection, Long> {
    List<HomepageSection> findByActiveTrueOrderByDisplayOrderAsc();
    List<HomepageSection> findAllByOrderByDisplayOrderAsc();
}
