package com.wissfind.marketplace.entity;
import jakarta.persistence.*;
@Entity @Table(name="disputes", indexes={
 @Index(name="idx_disputes_order",columnList="order_id"),
 @Index(name="idx_disputes_status_created",columnList="status, created_at")
}) public class Dispute extends BaseEntity { @ManyToOne(optional=false) public Order order; public String reason,evidence,response,status="OPEN"; }
