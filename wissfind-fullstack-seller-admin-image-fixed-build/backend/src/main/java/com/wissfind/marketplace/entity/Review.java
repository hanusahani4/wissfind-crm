package com.wissfind.marketplace.entity;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="reviews", uniqueConstraints=@UniqueConstraint(columnNames={"product_id","customer_id"}), indexes={
 @Index(name="idx_reviews_product_created",columnList="product_id, created_at"),
 @Index(name="idx_reviews_product_rating",columnList="product_id, rating")
})
public class Review extends BaseEntity {
 @ManyToOne(optional=false) public Product product;
 @ManyToOne(optional=false) public User customer;
 @Column(nullable=false) public int rating;
 @Column(nullable=false,length=120) public String title;
 @Column(nullable=false,length=3000) public String text;
 @Column(nullable=false) public int likes=0;
 public Instant createdAt=Instant.now();
}
