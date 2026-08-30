package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.SellerApplication;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.SellerApplicationRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.service.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sellers")
public class SellerController {
    final SellerApplicationRepository apps;
    final UserRepository users;

    public SellerController(SellerApplicationRepository a, UserRepository u) {
        apps = a;
        users = u;
    }

    @PostMapping("/applications")
    @PreAuthorize("hasRole('CUSTOMER')")
    public SellerApplication apply(@RequestBody SellerApplication body) {
        User user = users.findById(CurrentUser.id()).orElseThrow();
        if (apps.findByUserId(user.id).isPresent()) {
            throw new IllegalArgumentException("Seller application already exists for this account");
        }
        validate(body);
        body.id = null;
        body.user = user;
        body.status = SellerApplication.Status.PENDING;
        return apps.save(body);
    }

    @GetMapping("/applications/me")
    @PreAuthorize("hasAnyRole('CUSTOMER','SELLER')")
    public SellerApplication me() {
        return apps.findByUserId(CurrentUser.id()).orElse(null);
    }

    @PutMapping("/applications/me")
    @PreAuthorize("hasAnyRole('CUSTOMER','SELLER')")
    public SellerApplication updateMe(@RequestBody SellerApplication body) {
        SellerApplication existing = apps.findByUserId(CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Seller application not found"));
        validate(body);
        existing.ownerName = body.ownerName;
        existing.phone = body.phone;
        existing.email = body.email;
        existing.storeName = body.storeName;
        existing.category = body.category;
        existing.businessType = body.businessType;
        existing.pan = body.pan;
        existing.gstin = body.gstin;
        existing.pickupAddress = body.pickupAddress;
        existing.city = body.city;
        existing.state = body.state;
        existing.pincode = body.pincode;
        existing.bankAccount = body.bankAccount;
        existing.ifsc = body.ifsc;
        if (existing.status == SellerApplication.Status.REJECTED) {
            existing.status = SellerApplication.Status.PENDING;
        }
        return apps.save(existing);
    }

    @GetMapping("/applications")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SellerApplication> all() {
        return apps.findAll();
    }

    @PatchMapping("/applications/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public SellerApplication approve(@PathVariable Long id) {
        SellerApplication a = apps.findById(id).orElseThrow();
        a.status = SellerApplication.Status.APPROVED;
        a.user.role = User.Role.SELLER;
        a.user.enabled = true;
        users.save(a.user);
        return apps.save(a);
    }

    @PatchMapping("/applications/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public SellerApplication reject(@PathVariable Long id) {
        SellerApplication a = apps.findById(id).orElseThrow();
        a.status = SellerApplication.Status.REJECTED;
        return apps.save(a);
    }

    @PatchMapping("/applications/{id}/suspend")
    @PreAuthorize("hasRole('ADMIN')")
    public SellerApplication suspend(@PathVariable Long id) {
        SellerApplication a = apps.findById(id).orElseThrow();
        a.status = SellerApplication.Status.SUSPENDED;
        a.user.enabled = false;
        users.save(a.user);
        return apps.save(a);
    }

    private void validate(SellerApplication body) {
        if (body.storeName == null || body.storeName.isBlank()) throw new IllegalArgumentException("Store name is required");
        if (body.ownerName == null || body.ownerName.isBlank()) throw new IllegalArgumentException("Owner name is required");
        if (body.category == null || body.category.isBlank()) throw new IllegalArgumentException("Category is required");
        if (body.pickupAddress == null || body.pickupAddress.isBlank()) throw new IllegalArgumentException("Pickup address is required");
        if (body.pincode == null || !body.pincode.matches("\\d{6}")) throw new IllegalArgumentException("Valid 6 digit PIN code is required");
        if (body.pan == null || !body.pan.matches("(?i)[A-Z]{5}[0-9]{4}[A-Z]")) throw new IllegalArgumentException("Valid PAN is required");
    }
}
