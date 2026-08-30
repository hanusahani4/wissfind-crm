package com.wissfind.marketplace.repo; import com.wissfind.marketplace.entity.Dispute; import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; import java.util.*; public interface DisputeRepository extends JpaRepository<Dispute,Long>, JpaSpecificationExecutor<Dispute> {}
