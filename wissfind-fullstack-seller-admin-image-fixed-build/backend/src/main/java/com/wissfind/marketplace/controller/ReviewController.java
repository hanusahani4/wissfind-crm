package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.*;
import com.wissfind.marketplace.repo.*;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/reviews")
public class ReviewController {
 final ReviewRepository reviews; final ProductRepository products; final UserRepository users;
 public ReviewController(ReviewRepository r,ProductRepository p,UserRepository u){reviews=r;products=p;users=u;}
 record ReviewRequest(int rating,String title,String text){}

 @GetMapping("/product/{productId}") public List<Map<String,Object>> list(@PathVariable Long productId){
  return reviews.findByProductIdOrderByCreatedAtDesc(productId).stream().map(r->{
   Map<String,Object> m=new LinkedHashMap<>();m.put("id",String.valueOf(r.id));m.put("productId",String.valueOf(productId));
   m.put("author",r.customer.name);m.put("rating",r.rating);m.put("title",r.title);m.put("text",r.text);m.put("date",r.createdAt);m.put("likes",r.likes);return m;
  }).toList();
 }

 @GetMapping("/seller") @PreAuthorize("hasRole('SELLER')") public List<Map<String,Object>> seller(){return reviews.findByProductSellerIdOrderByCreatedAtDesc(CurrentUser.id()).stream().map(this::mapReview).toList();}
 @GetMapping @PreAuthorize("hasRole('ADMIN')") public List<Map<String,Object>> all(){return reviews.findAll().stream().map(this::mapReview).toList();}

 @PostMapping("/product/{productId}") @PreAuthorize("hasRole('CUSTOMER')")
 public Map<String,Object> add(@PathVariable Long productId,@RequestBody ReviewRequest req){
  if(req.rating()<1||req.rating()>5||req.text()==null||req.text().isBlank())throw new IllegalArgumentException("Rating and review text are required");
  Product p=products.findById(productId).orElseThrow(); User u=users.findById(CurrentUser.id()).orElseThrow();
  if(reviews.existsByProductIdAndCustomerId(productId,u.id))throw new IllegalArgumentException("You have already reviewed this product");
  Review r=new Review();r.product=p;r.customer=u;r.rating=req.rating();r.title=req.title()==null||req.title().isBlank()?"My review":req.title().trim();r.text=req.text().trim();
  Review saved=reviews.save(r); recalculate(p); products.save(p); return Map.of("review",saved);
 }

 @PatchMapping("/{id}/like") @PreAuthorize("hasRole('CUSTOMER')") public void like(@PathVariable Long id){Review r=reviews.findById(id).orElseThrow();r.likes++;reviews.save(r);}

 private void recalculate(Product p) {

  List<Review> all =
          reviews.findByProductIdOrderByCreatedAtDesc(p.id);

  p.reviews = all.size();

  if (all.isEmpty()) {
   p.rating = 0.0;
   return;
  }

  double average = all.stream()
          .mapToInt(x -> x.rating)
          .average()
          .orElse(0.0);

  p.rating = Math.round(average * 10.0) / 10.0;
 }
 private Map<String,Object> mapReview(Review r){Map<String,Object> m=new LinkedHashMap<>();m.put("id",r.id);m.put("productId",r.product.id);m.put("productName",r.product.name);m.put("seller",r.product.seller==null?null:r.product.seller.name);m.put("author",r.customer.name);m.put("rating",r.rating);m.put("title",r.title);m.put("text",r.text);m.put("likes",r.likes);m.put("date",r.createdAt);return m;}
}
