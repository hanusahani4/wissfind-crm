package com.wissfind.marketplace.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves Angular's index.html for browser refreshes on client-side routes.
 * API requests under /api are handled by the REST controllers instead.
 */
@Controller
public class SpaForwardController {
    @GetMapping({
            "/{path:[^\\.]*}",
            "/**/{path:[^\\.]*}"
    })
    public String forwardToAngular() {
        return "forward:/index.html";
    }
}
