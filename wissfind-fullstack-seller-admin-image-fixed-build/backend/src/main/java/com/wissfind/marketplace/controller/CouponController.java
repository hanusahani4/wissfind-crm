package com.wissfind.marketplace.controller;
import com.wissfind.marketplace.entity.*;import com.wissfind.marketplace.repo.*;import com.wissfind.marketplace.service.CurrentUser;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping("/api/coupons") public class CouponController {
 final CouponRepository r;final UserRepository u;public CouponController(CouponRepository r,UserRepository u){this.r=r;this.u=u;}
 @GetMapping("/mine") @PreAuthorize("hasRole('SELLER')") public List<Coupon> mine(){return r.findBySellerIdOrderByCreatedAtDesc(CurrentUser.id());}
 @GetMapping @PreAuthorize("hasRole('ADMIN')") public List<Coupon> all(){return r.findAll();}
 @PostMapping @PreAuthorize("hasRole('SELLER')") public Coupon create(@RequestBody Coupon c){c.id=null;c.seller=u.findById(CurrentUser.id()).orElseThrow();normalize(c,null);return r.save(c);}
 @PutMapping("/{id}") @PreAuthorize("hasRole('SELLER')") public Coupon update(@PathVariable Long id,@RequestBody Coupon in){var c=r.findById(id).orElseThrow();if(!c.seller.id.equals(CurrentUser.id()))throw new IllegalArgumentException("Not your coupon");c.code=in.code;c.discount=in.discount;c.expiry=in.expiry;c.active=in.active;normalize(c,id);return r.save(c);}
 @DeleteMapping("/{id}") @PreAuthorize("hasRole('SELLER')") public void delete(@PathVariable Long id){var c=r.findById(id).orElseThrow();if(!c.seller.id.equals(CurrentUser.id()))throw new IllegalArgumentException("Not your coupon");r.delete(c);}
 private void normalize(Coupon c,Long id){if(c.code==null||c.code.isBlank())throw new IllegalArgumentException("Coupon code is required");c.code=c.code.trim().toUpperCase(Locale.ROOT);if(c.discount==null||c.discount.signum()<=0)throw new IllegalArgumentException("Discount must be greater than zero");if(id==null?r.existsByCodeIgnoreCase(c.code):r.existsByCodeIgnoreCaseAndIdNot(c.code,id))throw new IllegalArgumentException("Coupon code already exists");}
}
