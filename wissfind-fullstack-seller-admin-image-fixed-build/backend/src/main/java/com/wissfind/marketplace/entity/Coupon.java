package com.wissfind.marketplace.entity;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.LocalDate;
@Entity @Table(name="coupons", uniqueConstraints=@UniqueConstraint(name="uk_coupon_code",columnNames="code"), indexes={
 @Index(name="idx_coupons_seller_active",columnList="seller_id, active"),
 @Index(name="idx_coupons_active_expiry",columnList="active, expiry")
}) public class Coupon extends BaseEntity {
 @ManyToOne(optional=false) public User seller;
 @Column(nullable=false,length=50) public String code;
 public BigDecimal discount; public LocalDate expiry;
 @Column(name="usage_count") public int usage;
 public boolean active=true;
}
