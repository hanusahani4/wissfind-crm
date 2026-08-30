package com.wissfind.marketplace.entity;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="otp_challenges") public class OtpChallenge extends BaseEntity { @Column(nullable=false) public String phone; @Column(nullable=false) public String purpose; @Column(nullable=false) public String otp; public Instant expiresAt; public boolean verified=false; }
