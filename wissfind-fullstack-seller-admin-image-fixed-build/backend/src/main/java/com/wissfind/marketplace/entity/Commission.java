package com.wissfind.marketplace.entity;
import jakarta.persistence.*; import java.math.BigDecimal;
@Entity @Table(name="commissions", uniqueConstraints=@UniqueConstraint(name="uk_commission_order",columnNames="order_id")) public class Commission extends BaseEntity { @ManyToOne(optional=false) public Order order; public BigDecimal rate,amount; public String status="PENDING"; }
