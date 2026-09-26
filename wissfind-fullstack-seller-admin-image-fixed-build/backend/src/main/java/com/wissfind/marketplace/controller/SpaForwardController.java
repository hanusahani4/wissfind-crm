package com.wissfind.marketplace.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves Angular's index.html when a customer refreshes a client-side route.
 * Static assets and /api/** remain handled by their normal Spring handlers.
 */
@Controller
public class SpaForwardController {
    @GetMapping({
            "/product/{id}",
            "/login",
            "/signup",
            "/forgot-password",
            "/cart",
            "/checkout",
            "/orders",
            "/ai-shop",
            "/compare",
            "/price-alerts",
            "/returns",
            "/admin",
            "/admin/homepage",
            "/admin/shipping",
            "/seller/register",
            "/seller"
    })
    public String forwardToAngular() {
        return "forward:/index.html";
    }
}
