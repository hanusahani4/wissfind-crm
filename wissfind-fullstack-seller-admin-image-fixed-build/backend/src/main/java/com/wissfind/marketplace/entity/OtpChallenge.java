package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "otp_challenges", indexes = {
        @Index(name = "idx_otp_phone_purpose_created", columnList = "phone,purpose,createdAt")
})
public class OtpChallenge extends BaseEntity {
    @Column(nullable = false, length = 20)
    public String phone;

    @Column(nullable = false, length = 20)
    public String purpose;

    @Column(nullable = false, unique = true, length = 100)
    public String sessionId;

    @Column(nullable = false)
    public Instant expiresAt;

    @Column(nullable = false)
    public boolean verified = false;

    @Column(nullable = false)
    public boolean consumed = false;

    public Instant verifiedAt;
    public Instant consumedAt;
}
