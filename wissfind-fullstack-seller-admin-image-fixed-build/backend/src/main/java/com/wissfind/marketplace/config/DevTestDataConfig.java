package com.wissfind.marketplace.config;

import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.repo.SellerApplicationRepository;
import com.wissfind.marketplace.entity.SellerApplication;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("dev")
@ConditionalOnProperty(
        name = "app.dev.test-users",
        havingValue = "true"
)
public class DevTestDataConfig {

    private final UserRepository users;
    private final SellerApplicationRepository applications;
    private final PasswordEncoder encoder;

    public DevTestDataConfig(
            UserRepository users,
            SellerApplicationRepository applications,
            PasswordEncoder encoder
    ) {
        this.users = users;
        this.applications = applications;
        this.encoder = encoder;
    }

    @PostConstruct
    public void createTestUsers() {

        createCustomer();
        User seller = createSeller();
        createSellerApplication(seller);
        createAdmin();

        System.out.println("======================================");
        System.out.println(" WISSFIND DEV TEST USERS READY");
        System.out.println(" CUSTOMER : +919876543210 / Test@123");
        System.out.println(" SELLER   : +919876543211 / Test@123");
        System.out.println(" ADMIN    : +919876543212 / Admin@123");
        System.out.println("======================================");
    }

    private void createCustomer() {
        createIfMissing(
                "+919876543210",
                "Test Customer",
                "Test@123",
                User.Role.CUSTOMER
        );
    }

    private User createSeller() {
        return createIfMissing(
                "+919876543211",
                "Test Seller",
                "Test@123",
                User.Role.SELLER
        );
    }

    private void createSellerApplication(User seller) {
        if (applications.findByUserId(seller.id).isPresent()) return;
        SellerApplication a = new SellerApplication();
        a.user = seller;
        a.ownerName = seller.name;
        a.phone = seller.phone;
        a.email = "seller@wissfind.test";
        a.storeName = "WissFind Test Store";
        a.category = "Fashion";
        a.businessType = "Individual / Proprietorship";
        a.pan = "ABCDE1234F";
        a.gstin = "22ABCDE1234F1Z5";
        a.pickupAddress = "12 Test Market, Sector 62";
        a.city = "Noida";
        a.state = "Uttar Pradesh";
        a.pincode = "201301";
        a.bankAccount = "123456789012";
        a.ifsc = "SBIN0001234";
        a.status = SellerApplication.Status.APPROVED;
        applications.save(a);
    }

    private void createAdmin() {
        createIfMissing(
                "+919876543212",
                "Test Admin",
                "Admin@123",
                User.Role.ADMIN
        );
    }

    private User createIfMissing(
            String phone,
            String name,
            String password,
            User.Role role
    ) {

        if (users.findByPhone(phone).isPresent()) {
            return users.findByPhone(phone).orElseThrow();
        }

        User user = new User();

        user.phone = phone;
        user.name = name;
        user.passwordHash = encoder.encode(password);
        user.phoneVerified = true;
        user.role = role;

        users.save(user);

        System.out.println(
                "[WISSFIND DEV] Created "
                        + role
                        + " : "
                        + phone
        );
        return user;
    }
}