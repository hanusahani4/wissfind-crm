package com.wissfind.marketplace.repo; import com.wissfind.marketplace.entity.Payout; import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; import java.util.*; public interface PayoutRepository extends JpaRepository<Payout,Long>, JpaSpecificationExecutor<Payout> {}
