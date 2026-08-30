package com.wissfind.marketplace.entity;
import jakarta.persistence.*;
@Entity @Table(name="disputes") public class Dispute extends BaseEntity { @ManyToOne(optional=false) public Order order; public String reason,evidence,response,status="OPEN"; }
