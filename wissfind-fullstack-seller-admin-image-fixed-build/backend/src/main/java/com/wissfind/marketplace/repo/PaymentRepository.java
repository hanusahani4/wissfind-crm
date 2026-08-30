package com.wissfind.marketplace.repo; import com.wissfind.marketplace.entity.Payment; import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; import java.util.*; public interface PaymentRepository extends JpaRepository<Payment,Long>, JpaSpecificationExecutor<Payment> {
    Optional<Payment> findFirstByProviderAndProviderOrderId(String provider, String providerOrderId);
}
