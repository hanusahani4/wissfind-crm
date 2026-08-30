package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.repo.*;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final OrderRepository orders;
    private final ProductRepository products;
    private final ReturnRequestRepository returns;
    private final PayoutRepository payouts;
    private final CouponRepository coupons;
    private final UserRepository users;
    private final PaymentRepository payments;
    private final SellerApplicationRepository sellerApplications;

    public ReportController(
            OrderRepository orders,
            ProductRepository products,
            ReturnRequestRepository returns,
            PayoutRepository payouts,
            CouponRepository coupons,
            UserRepository users,
            PaymentRepository payments,
            SellerApplicationRepository sellerApplications) {

        this.orders = orders;
        this.products = products;
        this.returns = returns;
        this.payouts = payouts;
        this.coupons = coupons;
        this.users = users;
        this.payments = payments;
        this.sellerApplications = sellerApplications;
    }

    /**
     * One lightweight dashboard request.
     *
     * ADMIN:
     *  - Gets platform-wide counters.
     *
     * SELLER:
     *  - Gets counters only for the currently logged-in seller.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','SELLER')")
    public Map<String, Object> summary() {

        boolean sellerView = "SELLER".equals(CurrentUser.role());
        long sellerId = sellerView ? CurrentUser.id() : -1L;

        /*
         * Orders
         */
        var orderRows = orders.findAll()
                .stream()
                .filter(o ->
                        sellerId < 0
                                || (o.seller != null
                                && o.seller.id != null
                                && o.seller.id.equals(sellerId))
                )
                .toList();

        /*
         * Products
         */
        var productRows = products.findAll()
                .stream()
                .filter(p ->
                        sellerId < 0
                                || (p.seller != null
                                && p.seller.id != null
                                && p.seller.id.equals(sellerId))
                )
                .toList();

        /*
         * Returns
         */
        var returnRows = returns.findAll()
                .stream()
                .filter(r ->
                        sellerId < 0
                                || (r.order != null
                                && r.order.seller != null
                                && r.order.seller.id != null
                                && r.order.seller.id.equals(sellerId))
                )
                .toList();

        /*
         * Payouts
         */
        var payoutRows = payouts.findAll()
                .stream()
                .filter(p ->
                        sellerId < 0
                                || (p.seller != null
                                && p.seller.id != null
                                && p.seller.id.equals(sellerId))
                )
                .toList();

        /*
         * Coupons
         */
        var couponRows = coupons.findAll()
                .stream()
                .filter(c ->
                        sellerId < 0
                                || (c.seller != null
                                && c.seller.id != null
                                && c.seller.id.equals(sellerId))
                )
                .toList();

        /*
         * Payments
         */
        var paymentRows = payments.findAll()
                .stream()
                .filter(p ->
                        sellerId < 0
                                || (p.order != null
                                && p.order.seller != null
                                && p.order.seller.id != null
                                && p.order.seller.id.equals(sellerId))
                )
                .toList();

        /*
         * Total sales
         */
        double sales = orderRows.stream()
                .mapToDouble(o ->
                        o.total == null
                                ? 0.0
                                : o.total.doubleValue()
                )
                .sum();

        /*
         * Customer count
         *
         * Seller dashboard does not expose platform-wide
         * customer count.
         */
        long customers = sellerView
                ? 0L
                : users.findAll()
                .stream()
                .filter(u ->
                        u.role == com.wissfind.marketplace.entity.User.Role.CUSTOMER
                )
                .count();

        /*
         * Pending products
         */
        long pendingProducts = productRows.stream()
                .filter(p ->
                        p.status == com.wissfind.marketplace.entity.Product.Status.PENDING
                )
                .count();

        /*
         * Live products
         */
        long liveProducts = productRows.stream()
                .filter(p ->
                        p.status == com.wissfind.marketplace.entity.Product.Status.LIVE
                )
                .count();

        /*
         * Pending seller applications
         */
        long pendingSellers = sellerView
                ? 0L
                : sellerApplications.findAll()
                .stream()
                .filter(a ->
                        a.status
                                == com.wissfind.marketplace.entity.SellerApplication.Status.PENDING
                )
                .count();

        /*
         * IMPORTANT:
         *
         * Do NOT use Map.of() here.
         *
         * Map.of() supports maximum 10 key/value pairs.
         * This response contains 11 fields.
         */
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("orders", orderRows.size());
        result.put("sales", sales);
        result.put("products", productRows.size());
        result.put("returns", returnRows.size());
        result.put("payouts", payoutRows.size());
        result.put("coupons", couponRows.size());
        result.put("payments", paymentRows.size());
        result.put("customers", customers);
        result.put("pendingProducts", pendingProducts);
        result.put("liveProducts", liveProducts);
        result.put("pendingSellers", pendingSellers);

        return result;
    }
}