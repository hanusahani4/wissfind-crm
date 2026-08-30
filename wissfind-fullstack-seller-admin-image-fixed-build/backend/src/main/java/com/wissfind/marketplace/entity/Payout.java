package com.wissfind.marketplace.entity;
import jakarta.persistence.*; import java.math.BigDecimal;
@Entity @Table(name="payouts", uniqueConstraints=@UniqueConstraint(name="uk_payout_reference",columnNames="reference")) public class Payout extends BaseEntity { @ManyToOne(optional=false) public User seller; public BigDecimal amount; public String status="REQUESTED",reference; }
