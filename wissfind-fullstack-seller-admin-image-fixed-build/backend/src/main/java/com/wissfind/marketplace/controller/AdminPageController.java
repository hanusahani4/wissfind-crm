package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.*;
import com.wissfind.marketplace.repo.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin/paged")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPageController {
    private final ProductRepository products; private final ProductImageRepository imageRepo; private final OrderRepository orders; private final UserRepository users;
    private final SellerApplicationRepository applications; private final CategoryRepository categories;
    private final ReturnRequestRepository returns; private final PaymentRepository payments; private final CouponRepository coupons;
    private final ReviewRepository reviews; private final CommissionRepository commissions; private final PayoutRepository payouts;
    private final DisputeRepository disputes;

    public AdminPageController(ProductRepository products, ProductImageRepository imageRepo, OrderRepository orders, UserRepository users,
                               SellerApplicationRepository applications, CategoryRepository categories,
                               ReturnRequestRepository returns, PaymentRepository payments, CouponRepository coupons,
                               ReviewRepository reviews, CommissionRepository commissions, PayoutRepository payouts,
                               DisputeRepository disputes) {
        this.products=products; this.imageRepo=imageRepo; this.orders=orders; this.users=users; this.applications=applications; this.categories=categories;
        this.returns=returns; this.payments=payments; this.coupons=coupons; this.reviews=reviews; this.commissions=commissions;
        this.payouts=payouts; this.disputes=disputes;
    }

    private Pageable page(int page, int size, String sort) {
        int p=Math.max(0,page), s=Math.min(50,Math.max(1,size));
        return PageRequest.of(p,s,Sort.by(Sort.Direction.DESC,sort));
    }

    @GetMapping("/products") @Transactional(readOnly=true)
    public Page<Product> products(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Product> spec=SearchSpec.<Product>contains(search,"name","sku","brand","category","subcategory","status","seller.name");
        var result=products.findAll(spec,page(page,size,"createdAt")); populateImages(result.getContent()); return result;
    }

    @GetMapping("/orders") @Transactional(readOnly=true)
    public Page<Order> orders(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Order> spec=SearchSpec.<Order>contains(search,"orderNumber","paymentStatus","deliveryStatus","customer.name","seller.name");
        return orders.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/seller-users")
    public Page<User> sellerUsers(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<User> spec=Specification.where(SearchSpec.<User>eq("role",User.Role.SELLER)).and(SearchSpec.<User>contains(search,"name","phone","email"));
        return users.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/customers")
    public Page<User> customers(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<User> spec=Specification.where(SearchSpec.<User>eq("role",User.Role.CUSTOMER)).and(SearchSpec.<User>contains(search,"name","phone","email"));
        return users.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/onboarding") @Transactional(readOnly=true)
    public Page<SellerApplication> onboarding(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<SellerApplication> spec=SearchSpec.<SellerApplication>contains(search,"storeName","ownerName","phone","email","category","businessType","pan","gstin","status");
        return applications.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/categories") @Transactional(readOnly=true)
    public Page<CategoryController.Flat> categories(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Category> spec=SearchSpec.<Category>contains(search,"name","slug","parent.name");
        return categories.findAll(spec,page(page,size,"name"))
                .map(c->new CategoryController.Flat(c.id,c.name,c.slug,c.parent==null?null:c.parent.id,c.parent==null?null:c.parent.name,c.active));
    }

    @GetMapping("/returns") @Transactional(readOnly=true)
    public Page<ReturnRequest> returns(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<ReturnRequest> spec=SearchSpec.<ReturnRequest>contains(search,"reason","status","order.orderNumber","order.customer.name","customer.name");
        return returns.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/payments") @Transactional(readOnly=true)
    public Page<Payment> payments(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Payment> spec=SearchSpec.<Payment>contains(search,"provider","providerPaymentId","status","order.orderNumber","order.customer.name","order.seller.name");
        return payments.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/coupons") @Transactional(readOnly=true)
    public Page<Coupon> coupons(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Coupon> spec=SearchSpec.<Coupon>contains(search,"code","seller.name","expiry");
        return coupons.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/reviews") @Transactional(readOnly=true)
    public Page<Map<String,Object>> reviews(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Review> spec=SearchSpec.<Review>contains(search,"title","text","product.name","product.seller.name");
        return reviews.findAll(spec,page(page,size,"createdAt")).map(this::mapReview);
    }

    @GetMapping("/commissions") @Transactional(readOnly=true)
    public Page<Commission> commissions(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Commission> spec=SearchSpec.<Commission>contains(search,"status","order.orderNumber","order.customer.name","order.seller.name");
        return commissions.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/payouts") @Transactional(readOnly=true)
    public Page<Payout> payouts(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Payout> spec=SearchSpec.<Payout>contains(search,"reference","status","seller.name");
        return payouts.findAll(spec,page(page,size,"createdAt"));
    }

    @GetMapping("/disputes") @Transactional(readOnly=true)
    public Page<Dispute> disputes(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Dispute> spec=SearchSpec.<Dispute>contains(search,"reason","evidence","response","status","order.orderNumber","order.customer.name","order.seller.name");
        return disputes.findAll(spec,page(page,size,"createdAt"));
    }

    private void populateImages(List<Product> rows){
        if(rows==null||rows.isEmpty()) return;
        var ids=rows.stream().map(p->p.id).filter(Objects::nonNull).toList();
        var grouped=imageRepo.findByProductIds(ids).stream().collect(java.util.stream.Collectors.groupingBy(x->x.product.id,LinkedHashMap::new,java.util.stream.Collectors.toList()));
        for(var p:rows){var imgs=grouped.getOrDefault(p.id,Collections.emptyList());p.images=imgs.stream().map(x->"/api/products/"+p.id+"/images/"+x.id).toList();if((p.image==null||p.image.isBlank())&&!p.images.isEmpty())p.image=p.images.get(0);}
    }

    private Map<String,Object> mapReview(Review r){
        Map<String,Object> m=new LinkedHashMap<>(); m.put("id",r.id); m.put("productId",r.product.id);
        m.put("productName",r.product.name); m.put("seller",r.product.seller==null?null:r.product.seller.name);
        m.put("author",r.customer.name); m.put("rating",r.rating); m.put("title",r.title); m.put("text",r.text);
        m.put("likes",r.likes); m.put("date",r.createdAt); return m;
    }
}
