package com.wissfind.marketplace.repo; import com.wissfind.marketplace.entity.OtpChallenge; import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*; public interface OtpChallengeRepository extends JpaRepository<OtpChallenge,Long> {}
