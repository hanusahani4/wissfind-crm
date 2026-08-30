package com.wissfind.marketplace.repo;
import com.wissfind.marketplace.entity.ReturnRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.*;
public interface ReturnRequestRepository extends JpaRepository<ReturnRequest,Long>, JpaSpecificationExecutor<ReturnRequest> { boolean existsByOrderId(Long orderId); }
