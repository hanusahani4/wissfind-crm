package com.wissfind.marketplace.repo;

import com.wissfind.marketplace.entity.OtpChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, Long> {
    Optional<OtpChallenge> findTopByPhoneAndPurposeAndSessionIdIsNotNullAndVerifiedFalseAndConsumedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String phone, String purpose, Instant now);

    Optional<OtpChallenge> findTopByPhoneAndPurposeAndSessionIdIsNotNullAndVerifiedTrueAndConsumedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String phone, String purpose, Instant now);

    Optional<OtpChallenge> findTopByPhoneAndPurposeOrderByCreatedAtDesc(String phone, String purpose);
}
