package com.wissfind.marketplace.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Serves Angular's index.html for browser refreshes on client-side routes.
 * Spring's PathPattern syntax uses {*path} for a catch-all path variable;
 * unlike the old /**/{path:...} pattern, this is valid on Spring Framework 6.
 * API requests under /api are handled by the more specific REST mappings.
 */
@Controller
public class SpaForwardController {
    @GetMapping("/{*path}")
    public String forwardToAngular(@PathVariable(required = false) String path) {
        if (path != null && (path.startsWith("api/") || path.equals("api") || path.contains("."))) {
            return "forward:/index.html";
        }
        return "forward:/index.html";
    }
}
