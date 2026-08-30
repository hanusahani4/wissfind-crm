package com.wissfind.marketplace.repo; import com.wissfind.marketplace.entity.User; import java.util.*; import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor; public interface UserRepository extends JpaRepository<User,Long>, JpaSpecificationExecutor<User> {Optional<User> findByPhone(String phone);}
