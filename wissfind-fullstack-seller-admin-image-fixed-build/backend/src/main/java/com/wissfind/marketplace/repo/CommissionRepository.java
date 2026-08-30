package com.wissfind.marketplace.repo; import com.wissfind.marketplace.entity.Commission; import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; import java.util.*; public interface CommissionRepository extends JpaRepository<Commission,Long>, JpaSpecificationExecutor<Commission> {}
