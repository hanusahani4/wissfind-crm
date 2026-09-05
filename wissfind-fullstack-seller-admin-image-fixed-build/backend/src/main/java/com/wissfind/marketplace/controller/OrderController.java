package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Order;
import com.wissfind.marketplace.entity.Product;
import com.wissfind.marketplace.entity.OrderItem;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.OrderRepository;
import com.wissfind.marketplace.repo.ProductRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.repo.CustomerAddressRepository;
import com.wissfind.marketplace.entity.CustomerAddress;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository repo;
    private final UserRepository users;
    private final ProductRepository products;
    private final com.wissfind.marketplace.repo.ReturnRequestRepository returnRequests;
    private final CustomerAddressRepository addresses;

    public OrderController(OrderRepository repo, UserRepository users, ProductRepository products, com.wissfind.marketplace.repo.ReturnRequestRepository returnRequests, CustomerAddressRepository addresses) {
        this.repo = repo;
        this.users = users;
        this.products = products;
        this.returnRequests = returnRequests;
        this.addresses = addresses;
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional(readOnly = true)
    public List<Order> mine() {
        return repo.findByCustomerIdOrderByCreatedAtDesc(CurrentUser.id());
    }

    @GetMapping("/mine/paged")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<Order> minePaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "newest") String sort) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        var direction = "oldest".equalsIgnoreCase(sort)
                ? org.springframework.data.domain.Sort.Direction.ASC
                : org.springframework.data.domain.Sort.Direction.DESC;
        var pageable = org.springframework.data.domain.PageRequest.of(
                safePage, safeSize,
                org.springframework.data.domain.Sort.by(direction, "createdAt"));

        if (status == null || status.isBlank() || "All".equalsIgnoreCase(status)) {
            return repo.findByCustomerId(CurrentUser.id(), pageable);
        }
        return repo.findByCustomerIdAndDeliveryStatus(CurrentUser.id(), status, pageable);
    }

    @GetMapping("/mine/summary")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional(readOnly = true)
    public Map<String, Object> mineSummary() {
        Long customerId = CurrentUser.id();
        BigDecimal totalSpent = repo.sumTotalByCustomerId(customerId);
        return new LinkedHashMap<>(Map.of(
                "all", repo.countByCustomerId(customerId),
                "processing", repo.countByCustomerIdAndDeliveryStatus(customerId, "Processing"),
                "shipped", repo.countByCustomerIdAndDeliveryStatus(customerId, "Shipped"),
                "delivered", repo.countByCustomerIdAndDeliveryStatus(customerId, "Delivered"),
                "cancelled", repo.countByCustomerIdAndDeliveryStatus(customerId, "Cancelled"),
                "totalSpent", totalSpent == null ? BigDecimal.ZERO : totalSpent
        ));
    }

    @GetMapping("/seller")
    @PreAuthorize("hasRole('SELLER')")
    @Transactional(readOnly = true)
    public List<Order> seller() {
        return repo.findBySellerIdOrderByCreatedAtDesc(CurrentUser.id());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(readOnly = true)
    public List<Order> all() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Creates an order for the seller that actually owns the products in the cart.
     * The old implementation silently selected the first SELLER in the database,
     * which caused orders to appear under a different seller account.
     */
    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional
    public Order create(@RequestBody Map<String, Object> body) {

        User customer = users.findById(CurrentUser.id()).orElseThrow();

        Long requestedSellerId = longValue(body.get("sellerId"));
        List<Long> productIds = longList(body.get("productIds"));
        List<Map<String, Object>> requestedItems = mapList(body.get("items"));

        if (requestedItems.isEmpty() && !productIds.isEmpty()) {
            for (Long productId : productIds) {
                requestedItems.add(new LinkedHashMap<>(Map.of(
                        "productId", productId,
                        "quantity", 1
                )));
            }
        }

        if (requestedItems.isEmpty()) {
            throw new IllegalArgumentException("At least one product is required to create an order");
        }

        productIds = requestedItems.stream()
                .map(item -> longValue(item.get("productId")))
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (productIds.size() != requestedItems.size()) {
            throw new IllegalArgumentException("Order contains an invalid or duplicate product");
        }

        User seller = null;

        if (requestedSellerId != null) {
            seller = users.findById(requestedSellerId).orElseThrow(
                    () -> new IllegalArgumentException("Seller not found")
            );

            if (seller.role != User.Role.SELLER) {
                throw new IllegalArgumentException("Selected user is not a seller");
            }
        }

        if (!productIds.isEmpty()) {
            Set<Long> sellerIds = new LinkedHashSet<>();

            for (Long productId : productIds) {
                Product product = products.findById(productId).orElseThrow(
                        () -> new IllegalArgumentException("Product not found: " + productId)
                );

                if (product.seller == null) {
                    throw new IllegalArgumentException("Product has no seller: " + productId);
                }

                sellerIds.add(product.seller.id);
            }

            if (sellerIds.size() > 1) {
                throw new IllegalArgumentException(
                        "Cart contains products from multiple sellers. Please checkout one seller at a time."
                );
            }

            Long actualSellerId = sellerIds.iterator().next();

            if (seller != null && !Objects.equals(seller.id, actualSellerId)) {
                throw new IllegalArgumentException(
                        "Selected seller does not own the cart products"
                );
            }

            seller = users.findById(actualSellerId).orElseThrow(
                    () -> new IllegalArgumentException("Seller account not found")
            );
        }

        if (seller == null) {
            throw new IllegalArgumentException(
                    "Unable to determine seller for this order. Refresh products and try again."
            );
        }

        Order order = new Order();
        order.customer = customer;
        order.seller = seller;
        order.orderNumber = stringValue(body.get("orderNumber"));

        if (order.orderNumber == null || order.orderNumber.isBlank()) {
            order.orderNumber = "WF-" + System.currentTimeMillis();
        }

        if (repo.existsByOrderNumber(order.orderNumber)) {
            throw new IllegalArgumentException("Order number already exists");
        }

        String paymentMethod = stringValue(body.get("paymentMethod"));
        if (!"RAZORPAY".equalsIgnoreCase(paymentMethod) && !"COD".equalsIgnoreCase(paymentMethod)) {
            throw new IllegalArgumentException("Payment method must be COD or RAZORPAY");
        }
        order.paymentMethod = paymentMethod.toUpperCase(Locale.ROOT);

        Long shippingAddressId = longValue(body.get("shippingAddressId"));
        if (shippingAddressId == null) {
            throw new IllegalArgumentException("Please select a shipping address");
        }
        CustomerAddress shippingAddress = addresses.findByIdAndCustomerId(shippingAddressId, customer.id)
                .orElseThrow(() -> new IllegalArgumentException("Selected shipping address is invalid"));
        order.address = formatAddress(shippingAddress);
        order.paymentStatus = "PENDING";
        order.deliveryStatus = "Processing";

        for (Map<String, Object> requestedItem : requestedItems) {
            Long productId = longValue(requestedItem.get("productId"));
            Product product = products.findById(productId).orElseThrow(
                    () -> new IllegalArgumentException("Product not found: " + productId)
            );

            int quantity = intValue(requestedItem.get("quantity"));
            if (quantity < 1) {
                throw new IllegalArgumentException("Quantity must be at least 1 for product: " + productId);
            }
            if (product.stock < quantity) {
                throw new IllegalArgumentException("Insufficient stock for product: " + product.name);
            }

            OrderItem item = new OrderItem();
            item.order = order;
            item.productId = product.id;
            item.name = product.name;
            item.category = product.category;
            item.image = "/api/products/" + product.id + "/image";
            item.quantity = quantity;
            item.price = BigDecimal.valueOf(product.price);
            item.variant = stringValue(requestedItem.get("variant"));
            order.items.add(item);

            // Reserve/decrement inventory as part of the same transaction as the
            // order. If any later validation fails, the transaction rolls back both.
            product.stock -= quantity;
            product.sales += quantity;
            if (product.stock == 0) {
                product.status = Product.Status.OUT_OF_STOCK;
            }
            products.save(product);
        }

        BigDecimal serverSubtotal = order.items.stream()
                .map(i -> i.price.multiply(BigDecimal.valueOf(i.quantity)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String couponCode = stringValue(body.get("couponCode"));
        BigDecimal couponDiscount = "WISS10".equalsIgnoreCase(couponCode)
                ? serverSubtotal.multiply(new BigDecimal("0.10")).setScale(0, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal payableProducts = serverSubtotal.subtract(couponDiscount).max(BigDecimal.ZERO);
        BigDecimal serverShipping = payableProducts.compareTo(new BigDecimal("200")) >= 0
                ? BigDecimal.ZERO
                : ("COD".equals(order.paymentMethod) ? new BigDecimal("70") : new BigDecimal("20"));
        boolean giftWrap = Boolean.TRUE.equals(body.get("giftWrap"));
        BigDecimal giftWrapFee = giftWrap ? new BigDecimal("49") : BigDecimal.ZERO;
        order.subtotal = serverSubtotal;
        order.discount = couponDiscount;
        order.shipping = serverShipping;
        order.gst = BigDecimal.ZERO;
        order.total = payableProducts.add(serverShipping).add(giftWrapFee).setScale(0, java.math.RoundingMode.HALF_UP);

        return repo.save(order);
    }

    private String formatAddress(CustomerAddress a) {
        return String.join(", ", java.util.stream.Stream.of(
                a.fullName, a.phone, a.line1, a.line2, a.city, a.district, a.state, a.pincode, a.country
        ).filter(v -> v != null && !v.isBlank()).toList());
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional
    public Order cancel(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        Order order = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("Order not found")
        );

        if (order.customer == null || !order.customer.id.equals(CurrentUser.id())) {
            throw new IllegalArgumentException("You can cancel only your own order");
        }

        if ("Cancelled".equalsIgnoreCase(order.deliveryStatus)) {
            throw new IllegalArgumentException("Order is already cancelled");
        }

        if (!"Processing".equalsIgnoreCase(order.deliveryStatus)) {
            throw new IllegalArgumentException(
                    "This order can no longer be cancelled. Please use the return option after delivery."
            );
        }

        String reason = body == null ? null : body.get("reason");
        String note = body == null ? null : body.get("note");

        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Cancellation reason is required");
        }

        order.deliveryStatus = "Cancelled";
        order.cancellationReason = reason.trim();
        order.cancellationNote = note == null ? null : note.trim();
        order.cancelledAt = java.time.LocalDateTime.now();

        if ("PAID".equalsIgnoreCase(order.paymentStatus)) {
            order.paymentStatus = "REFUND_PENDING";
        } else {
            order.paymentStatus = "CANCELLED";
        }

        // Return the reserved quantity when a Processing order is cancelled.
        restoreStock(order);

        Order saved = repo.save(order);
        if (!returnRequests.existsByOrderId(order.id)) {
            var rr = new com.wissfind.marketplace.entity.ReturnRequest();
            rr.order = saved;
            rr.customer = customerForCurrentUser();
            rr.reason = reason.trim();
            rr.requestType = com.wissfind.marketplace.entity.ReturnRequest.RequestType.CANCELLATION;
            rr.refundAmount = "REFUND_PENDING".equalsIgnoreCase(saved.paymentStatus) ? saved.total : java.math.BigDecimal.ZERO;
            rr.status = com.wissfind.marketplace.entity.ReturnRequest.Status.REQUESTED;
            returnRequests.save(rr);
        }
        return saved;
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public Order rejectBySeller(@PathVariable Long id,
                                @RequestBody(required = false) Map<String, String> body) {
        Order order = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("Order not found")
        );

        if (order.seller == null || !Objects.equals(order.seller.id, CurrentUser.id())) {
            throw new IllegalArgumentException("You can reject only your own orders");
        }

        if (!"Processing".equalsIgnoreCase(order.deliveryStatus)) {
            throw new IllegalArgumentException("Only Processing orders can be rejected");
        }

        String reason = body == null ? null : body.get("reason");
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Rejection reason is required");
        }

        order.deliveryStatus = "Cancelled";
        order.cancellationReason = "Seller rejected: " + reason.trim();
        order.cancellationNote = "Order rejected by seller";
        order.cancelledAt = java.time.LocalDateTime.now();

        if ("PAID".equalsIgnoreCase(order.paymentStatus)) {
            order.paymentStatus = "REFUND_PENDING";
        } else {
            order.paymentStatus = "CANCELLED";
        }

        // Return the reserved quantity when the seller rejects a Processing order.
        restoreStock(order);

        Order saved = repo.save(order);

        if (!returnRequests.existsByOrderId(saved.id)) {
            var rr = new com.wissfind.marketplace.entity.ReturnRequest();
            rr.order = saved;
            rr.customer = saved.customer;
            rr.reason = "Seller rejected: " + reason.trim();
            rr.requestType = com.wissfind.marketplace.entity.ReturnRequest.RequestType.CANCELLATION;
            rr.refundAmount = "REFUND_PENDING".equalsIgnoreCase(saved.paymentStatus)
                    ? saved.total : java.math.BigDecimal.ZERO;
            rr.status = com.wissfind.marketplace.entity.ReturnRequest.Status.REQUESTED;
            returnRequests.save(rr);
        }

        return saved;
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SELLER','ADMIN')")
    @Transactional
    public Order status(@PathVariable Long id, @RequestParam String value) {
        Order order = repo.findById(id).orElseThrow();

        if (CurrentUser.role().equals("SELLER")
                && (order.seller == null || !order.seller.id.equals(CurrentUser.id()))) {
            throw new IllegalArgumentException("Not your order");
        }

        if ("Cancelled".equalsIgnoreCase(order.deliveryStatus)) {
            throw new IllegalArgumentException("Cancelled orders cannot be moved to another delivery status");
        }

        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Order status is required");
        }

        order.deliveryStatus = value.trim();
        return repo.save(order);
    }

    private void restoreStock(Order order) {
        if (order.items == null || order.items.isEmpty()) return;

        for (OrderItem item : order.items) {
            if (item.productId == null) continue;

            products.findById(item.productId).ifPresent(product -> {
                product.stock += Math.max(0, item.quantity);
                if (product.status == Product.Status.OUT_OF_STOCK && product.stock > 0) {
                    product.status = Product.Status.LIVE;
                }
                product.sales = Math.max(0, product.sales - Math.max(0, item.quantity));
                products.save(product);
            });
        }
    }

    private User customerForCurrentUser() { return users.findById(CurrentUser.id()).orElseThrow(); }

    private int intValue(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private List<Map<String, Object>> mapList(Object value) {
        if (!(value instanceof Collection<?> collection)) return new ArrayList<>();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : collection) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> copy = new LinkedHashMap<>();
                map.forEach((key, val) -> copy.put(String.valueOf(key), val));
                result.add(copy);
            }
        }
        return result;
    }

    private Long longValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<Long> longList(Object value) {
        if (!(value instanceof Collection<?> collection)) return new ArrayList<>();

        List<Long> result = new ArrayList<>();
        for (Object item : collection) {
            Long id = longValue(item);
            if (id != null) result.add(id);
        }
        return result;
    }

    private BigDecimal decimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
