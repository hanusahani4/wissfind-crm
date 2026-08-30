package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.*;
import com.wissfind.marketplace.repo.*;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/seller/paged")
@PreAuthorize("hasRole('SELLER')")
public class SellerPageController {
    private final ProductRepository products; private final ProductImageRepository imageRepo; private final OrderRepository orders; private final ReturnRequestRepository returns;
    private final CouponRepository coupons; private final PayoutRepository payouts; private final ReviewRepository reviews;
    private final CommissionRepository commissions; private final DisputeRepository disputes;
    public SellerPageController(ProductRepository products,ProductImageRepository imageRepo,OrderRepository orders,ReturnRequestRepository returns,CouponRepository coupons,
                                PayoutRepository payouts,ReviewRepository reviews,CommissionRepository commissions,DisputeRepository disputes){
        this.products=products;this.imageRepo=imageRepo;this.orders=orders;this.returns=returns;this.coupons=coupons;this.payouts=payouts;this.reviews=reviews;this.commissions=commissions;this.disputes=disputes;
    }
    private Pageable page(int page,int size,String sort){return PageRequest.of(Math.max(0,page),Math.min(50,Math.max(1,size)),Sort.by(Sort.Direction.DESC,sort));}
    @GetMapping("/products") @Transactional(readOnly=true)
    public Page<Product> products(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Product> spec=Specification.where(SearchSpec.<Product>eqPath("seller.id",CurrentUser.id())).and(SearchSpec.<Product>contains(search,"name","sku","brand","category","subcategory","status"));
        var result=products.findAll(spec,page(page,size,"createdAt")); populateImages(result.getContent()); return result;
    }
    @GetMapping("/orders") @Transactional(readOnly=true)
    public Page<Order> orders(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Order> spec=Specification.where(SearchSpec.<Order>eqPath("seller.id",CurrentUser.id())).and(SearchSpec.<Order>contains(search,"orderNumber","paymentStatus","deliveryStatus","customer.name"));
        return orders.findAll(spec,page(page,size,"createdAt"));
    }
    @GetMapping("/returns") @Transactional(readOnly=true)
    public Page<ReturnRequest> returns(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<ReturnRequest> spec=Specification.where(SearchSpec.<ReturnRequest>eqPath("order.seller.id",CurrentUser.id())).and(SearchSpec.<ReturnRequest>contains(search,"reason","status","order.orderNumber","customer.name"));
        return returns.findAll(spec,page(page,size,"createdAt"));
    }
    @GetMapping("/coupons") @Transactional(readOnly=true)
    public Page<Coupon> coupons(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Coupon> spec=Specification.where(SearchSpec.<Coupon>eqPath("seller.id",CurrentUser.id())).and(SearchSpec.<Coupon>contains(search,"code","expiry"));
        return coupons.findAll(spec,page(page,size,"createdAt"));
    }
    @GetMapping("/payouts") @Transactional(readOnly=true)
    public Page<Payout> payouts(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Payout> spec=Specification.where(SearchSpec.<Payout>eqPath("seller.id",CurrentUser.id())).and(SearchSpec.<Payout>contains(search,"reference","status"));
        return payouts.findAll(spec,page(page,size,"createdAt"));
    }
    @GetMapping("/reviews") @Transactional(readOnly=true)
    public Page<Map<String,Object>> reviews(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Review> spec=Specification.where(SearchSpec.<Review>eqPath("product.seller.id",CurrentUser.id())).and(SearchSpec.<Review>contains(search,"title","text","product.name"));
        return reviews.findAll(spec,page(page,size,"createdAt")).map(this::mapReview);
    }
    @GetMapping("/commissions") @Transactional(readOnly=true)
    public Page<Commission> commissions(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Commission> spec=Specification.where(SearchSpec.<Commission>eqPath("order.seller.id",CurrentUser.id())).and(SearchSpec.<Commission>contains(search,"status","order.orderNumber","order.customer.name"));
        return commissions.findAll(spec,page(page,size,"createdAt"));
    }
    @GetMapping("/disputes") @Transactional(readOnly=true)
    public Page<Dispute> disputes(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size,@RequestParam(defaultValue="") String search){
        Specification<Dispute> spec=Specification.where(SearchSpec.<Dispute>eqPath("order.seller.id",CurrentUser.id())).and(SearchSpec.<Dispute>contains(search,"reason","evidence","response","status","order.orderNumber","order.customer.name"));
        return disputes.findAll(spec,page(page,size,"createdAt"));
    }
    private void populateImages(List<Product> rows){
        if(rows==null||rows.isEmpty()) return;
        var ids=rows.stream().map(p->p.id).filter(Objects::nonNull).toList();
        var grouped=imageRepo.findByProductIds(ids).stream().collect(java.util.stream.Collectors.groupingBy(x->x.product.id,LinkedHashMap::new,java.util.stream.Collectors.toList()));
        for(var p:rows){var imgs=grouped.getOrDefault(p.id,Collections.emptyList());p.images=imgs.stream().map(x->"/api/products/"+p.id+"/images/"+x.id).toList();if((p.image==null||p.image.isBlank())&&!p.images.isEmpty())p.image=p.images.get(0);}
    }

    private Map<String,Object> mapReview(Review r){Map<String,Object> m=new LinkedHashMap<>();m.put("id",r.id);m.put("productId",r.product.id);m.put("productName",r.product.name);m.put("seller",r.product.seller==null?null:r.product.seller.name);m.put("author",r.customer.name);m.put("rating",r.rating);m.put("title",r.title);m.put("text",r.text);m.put("likes",r.likes);m.put("date",r.createdAt);return m;}
}
