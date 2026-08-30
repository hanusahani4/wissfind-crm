package com.wissfind.marketplace.controller;

import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import com.wissfind.marketplace.entity.*;
import com.wissfind.marketplace.repo.*;
import com.wissfind.marketplace.service.CurrentUser;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    final PaymentRepository repo;
    final OrderRepository orders;
    final CommissionRepository commissions;

    @Value("${payment.razorpay.key-id:}") private String razorpayKeyId;
    @Value("${payment.razorpay.key-secret:}") private String razorpayKeySecret;
    @Value("${payment.razorpay.webhook-secret:}") private String webhookSecret;

    public PaymentController(PaymentRepository r, OrderRepository o, CommissionRepository c) {
        repo=r; orders=o; commissions=c;
    }

    @PostMapping("/dummy")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional
    public Payment pay(@RequestBody Payment p) {
        p.id=null; p.provider="DUMMY"; p.status="COD_CONFIRMED";
        p.order=orders.findById(p.order.id).orElseThrow();
        ensureCustomerOrder(p.order);
        if (!"COD".equalsIgnoreCase(p.order.paymentMethod)) {
            throw new IllegalArgumentException("Dummy payment is available only for COD orders");
        }
        p.amount=p.order.total;
        p.order.paymentMethod="COD";
        p.order.paymentStatus="COD_PENDING";
        var x=repo.save(p);
        orders.save(x.order);
        createCommissionIfNeeded(x.order, x.amount);
        return x;
    }

    /** Creates a Razorpay server-side order. Key secret never reaches Angular. */
    @PostMapping("/razorpay/order")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional
    public Map<String,Object> createRazorpayOrder(@RequestBody Map<String,Object> body) throws Exception {
        if (razorpayKeyId == null || razorpayKeyId.isBlank() || razorpayKeySecret == null || razorpayKeySecret.isBlank()) {
            throw new IllegalStateException("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the backend.");
        }
        Long internalOrderId = longValue(body.get("orderId"));
        if (internalOrderId == null) throw new IllegalArgumentException("Order id is required");
        Order order = orders.findById(internalOrderId).orElseThrow(() -> new IllegalArgumentException("Order not found"));
        ensureCustomerOrder(order);
        if (!"RAZORPAY".equalsIgnoreCase(order.paymentMethod)) throw new IllegalArgumentException("This order is not configured for Razorpay");
        if (order.total == null || order.total.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Invalid order amount");

        RazorpayClient client = new RazorpayClient(razorpayKeyId, razorpayKeySecret);
        JSONObject options = new JSONObject();
        options.put("amount", order.total.multiply(BigDecimal.valueOf(100)).longValueExact());
        options.put("currency", "INR");
        options.put("receipt", order.orderNumber);
        options.put("notes", new JSONObject().put("internal_order_id", String.valueOf(order.id)));
        options.put("capture", "automatic");

        com.razorpay.Order rzOrder = client.orders.create(options);
        String rzOrderId = rzOrder.get("id");

        Payment payment = new Payment();
        payment.order = order;
        payment.provider = "RAZORPAY";
        payment.providerOrderId = rzOrderId;
        payment.providerPaymentId = "RZORDER:" + rzOrderId;
        payment.status = "CREATED";
        payment.amount = order.total;
        repo.save(payment);

        return Map.of(
                "keyId", razorpayKeyId,
                "razorpayOrderId", rzOrderId,
                "amount", order.total.multiply(BigDecimal.valueOf(100)).longValueExact(),
                "currency", "INR",
                "internalOrderId", order.id
        );
    }

    /** Browser success callback. Signature is verified on the server before marking PAID. */
    @PostMapping("/razorpay/verify")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional
    public Map<String,Object> verifyRazorpay(@RequestBody Map<String,String> body) throws Exception {
        if (razorpayKeySecret == null || razorpayKeySecret.isBlank()) throw new IllegalStateException("Razorpay is not configured");
        String paymentId = body.get("razorpay_payment_id");
        String razorpayOrderId = body.get("razorpay_order_id");
        String signature = body.get("razorpay_signature");
        if (blank(paymentId) || blank(razorpayOrderId) || blank(signature)) throw new IllegalArgumentException("Incomplete Razorpay payment response");

        Payment payment = repo.findFirstByProviderAndProviderOrderId("RAZORPAY", razorpayOrderId)
                .orElseThrow(() -> new IllegalArgumentException("Razorpay order not found"));
        Order order = payment.order;
        ensureCustomerOrder(order);
        String serverRazorpayOrderId = payment.providerOrderId;

        JSONObject attributes = new JSONObject();
        attributes.put("razorpay_order_id", serverRazorpayOrderId);
        attributes.put("razorpay_payment_id", paymentId);
        attributes.put("razorpay_signature", signature);
        if (!Utils.verifyPaymentSignature(attributes, razorpayKeySecret)) {
            payment.status = "FAILED_SIGNATURE";
            repo.save(payment);
            throw new IllegalArgumentException("Razorpay payment signature verification failed");
        }

        payment.providerPaymentId = paymentId;
        payment.status = "SUCCESS";
        payment.amount = order.total;
        repo.save(payment);
        order.paymentStatus = "PAID";
        order.paymentMethod = "RAZORPAY";
        orders.save(order);
        createCommissionIfNeeded(order, order.total);
        return Map.of("success", true, "orderId", order.id, "paymentId", paymentId, "status", "PAID");
    }

    /** Razorpay webhook endpoint. Configure this URL in Razorpay Dashboard for payment events. */
    @PostMapping("/razorpay/webhook")
    public Map<String,Object> webhook(@RequestBody String rawBody, @RequestHeader(value="X-Razorpay-Signature", required=false) String signature) {
        if (webhookSecret == null || webhookSecret.isBlank()) throw new IllegalStateException("Razorpay webhook secret is not configured");
        if (blank(signature)) throw new IllegalArgumentException("Missing Razorpay webhook signature");
        try {
            if (!Utils.verifyWebhookSignature(rawBody, signature, webhookSecret)) throw new IllegalArgumentException("Invalid webhook signature");
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid webhook signature");
        }
        // Browser verification is the immediate fulfilment path. Webhooks are accepted
        // and signature-checked here so a production deployment can reconcile events safely.
        return Map.of("received", true);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Payment> all(){return repo.findAll();}

    private void ensureCustomerOrder(Order order) {
        if (order.customer == null || !Objects.equals(order.customer.id, CurrentUser.id())) throw new IllegalArgumentException("You can pay only for your own order");
    }

    private void createCommissionIfNeeded(Order order, BigDecimal amount) {
        if (commissions.findAll().stream().noneMatch(c -> c.order != null && c.order.id.equals(order.id))) {
            var c=new Commission(); c.order=order; c.rate=new BigDecimal("6.00");
            c.amount=(amount==null?BigDecimal.ZERO:amount).multiply(new BigDecimal("0.06")); c.status="PENDING"; commissions.save(c);
        }
    }

    private Long longValue(Object value){ if(value==null)return null; try{return Long.parseLong(String.valueOf(value));}catch(Exception e){return null;} }
    private boolean blank(String v){return v==null || v.isBlank();}
}
