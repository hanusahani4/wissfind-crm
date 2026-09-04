package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.CustomerAddress;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.CustomerAddressRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.service.CurrentUser;
import com.wissfind.marketplace.service.PincodeService;
import jakarta.transaction.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/addresses")
@PreAuthorize("hasRole('CUSTOMER')")
public class AddressController {
    private final CustomerAddressRepository repo;
    private final UserRepository users;
    private final PincodeService pincodeService;

    public AddressController(CustomerAddressRepository repo, UserRepository users, PincodeService pincodeService) {
        this.repo = repo;
        this.users = users;
        this.pincodeService = pincodeService;
    }

    @GetMapping
    public List<CustomerAddress> mine() {
        return repo.findByCustomerIdOrderByDefaultAddressDescUpdatedAtDesc(CurrentUser.id());
    }

    @GetMapping("/pincode/{pincode}")
    public Map<String, Object> validatePincode(@PathVariable String pincode) {
        return pincodeService.lookup(pincode);
    }

    @PostMapping
    @Transactional
    public CustomerAddress create(@RequestBody AddressRequest request) {
        validateRequest(request);
        User customer = users.findById(CurrentUser.id()).orElseThrow(() -> new IllegalArgumentException("Customer not found"));
        var pin = pincodeService.lookup(request.pincode());

        CustomerAddress address = new CustomerAddress();
        copy(address, request, pin);
        address.customer = customer;
        address.pinVerified = true;
        address.defaultAddress = request.defaultAddress() || repo.countByCustomerId(customer.id) == 0;
        if (address.defaultAddress) clearDefaults(customer.id, null);
        return repo.save(address);
    }

    @PutMapping("/{id}")
    @Transactional
    public CustomerAddress update(@PathVariable Long id, @RequestBody AddressRequest request) {
        validateRequest(request);
        CustomerAddress address = repo.findByIdAndCustomerId(id, CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Address not found"));
        var pin = pincodeService.lookup(request.pincode());
        copy(address, request, pin);
        address.pinVerified = true;
        if (request.defaultAddress()) {
            clearDefaults(CurrentUser.id(), id);
            address.defaultAddress = true;
        }
        return repo.save(address);
    }

    @PatchMapping("/{id}/default")
    @Transactional
    public CustomerAddress makeDefault(@PathVariable Long id) {
        CustomerAddress address = repo.findByIdAndCustomerId(id, CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Address not found"));
        clearDefaults(CurrentUser.id(), id);
        address.defaultAddress = true;
        return repo.save(address);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> delete(@PathVariable Long id) {
        CustomerAddress address = repo.findByIdAndCustomerId(id, CurrentUser.id())
                .orElseThrow(() -> new IllegalArgumentException("Address not found"));
        boolean wasDefault = address.defaultAddress;
        repo.delete(address);
        if (wasDefault) {
            repo.findByCustomerIdOrderByDefaultAddressDescUpdatedAtDesc(CurrentUser.id()).stream().findFirst().ifPresent(a -> {
                a.defaultAddress = true;
                repo.save(a);
            });
        }
        return Map.of("message", "Address deleted");
    }

    private void validateRequest(AddressRequest r) {
        if (r == null) throw new IllegalArgumentException("Address is required");
        if (blank(r.label()) || r.label().length() > 30) throw new IllegalArgumentException("Address label is required");
        if (blank(r.fullName()) || !r.fullName().trim().matches("[A-Za-z .'-]{2,100}")) throw new IllegalArgumentException("Enter a valid full name");
        if (blank(r.phone()) || !r.phone().trim().matches("(?:\\+91[6-9]\\d{9}|[6-9]\\d{9})")) throw new IllegalArgumentException("Enter a valid Indian mobile number");
        if (blank(r.line1()) || r.line1().trim().length() < 5 || r.line1().length() > 250) throw new IllegalArgumentException("Enter a valid address");
        if (!blank(r.line2()) && r.line2().length() > 250) throw new IllegalArgumentException("Address line 2 is too long");
        if (blank(r.pincode()) || !r.pincode().matches("\\d{6}")) throw new IllegalArgumentException("PIN code must be exactly 6 digits");
    }

    private void copy(CustomerAddress a, AddressRequest r, Map<String,Object> pin) {
        a.label = r.label().trim();
        a.fullName = r.fullName().trim();
        a.phone = normalizePhone(r.phone());
        a.line1 = r.line1().trim();
        a.line2 = blank(r.line2()) ? null : r.line2().trim();
        a.pincode = r.pincode();
        a.district = String.valueOf(pin.get("district"));
        a.state = String.valueOf(pin.get("state"));
        // PIN is validated against real postal data. City/town is customer-entered and is NOT matched against PIN.
        a.city = blank(r.city()) ? a.district : r.city().trim();
        a.country = "India";
    }

    private void clearDefaults(Long customerId, Long exceptId) {
        repo.findByCustomerIdOrderByDefaultAddressDescUpdatedAtDesc(customerId).forEach(a -> {
            if (exceptId == null || !a.id.equals(exceptId)) a.defaultAddress = false;
        });
    }
    private String normalizePhone(String phone) { String p = phone.trim().replace(" ", ""); return p.startsWith("+91") ? p : "+91" + p; }
    private boolean blank(String s) { return s == null || s.trim().isBlank(); }

    public record AddressRequest(String label, String fullName, String phone, String line1, String line2,
                                 String city, String pincode, boolean defaultAddress) {}
}
