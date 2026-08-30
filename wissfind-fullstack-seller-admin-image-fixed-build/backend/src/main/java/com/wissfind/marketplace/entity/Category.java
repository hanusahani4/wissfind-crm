package com.wissfind.marketplace.entity;
import jakarta.persistence.*;
@Entity @Table(name="categories",uniqueConstraints=@UniqueConstraint(columnNames={"name","parent_id"}))
public class Category extends BaseEntity{
 @Column(nullable=false) public String name; @Column(nullable=false,unique=true) public String slug;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="parent_id") public Category parent; public boolean active=true;
}
