package com.wissfind.marketplace.entity;
import jakarta.persistence.*; import java.math.BigDecimal;
@Entity @Table(name="payouts", uniqueConstraints=@UniqueConstraint(name="uk_payout_reference",columnNames="reference"), indexes={
 @Index(name="idx_payouts_seller_status",columnList="seller_id, status"),
 @Index(name="idx_payouts_status_created",columnList="status, created_at")
}) public class Payout extends BaseEntity { @ManyToOne(optional=false) public User seller; public BigDecimal amount; public String status="REQUESTED",reference; }
