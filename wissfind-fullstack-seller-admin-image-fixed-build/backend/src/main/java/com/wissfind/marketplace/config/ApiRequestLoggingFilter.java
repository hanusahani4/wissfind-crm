package com.wissfind.marketplace.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class ApiRequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiRequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        long started = System.currentTimeMillis();
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String query = request.getQueryString();

        log.info("[HTTP] >>> {} {}{} Authorization={}",
                method,
                uri,
                query == null ? "" : "?" + query,
                request.getHeader("Authorization") != null ? "PRESENT" : "MISSING");

        try {
            filterChain.doFilter(request, response);
        } finally {
            log.info("[HTTP] <<< {} {} status={} durationMs={}",
                    method,
                    uri,
                    response.getStatus(),
                    System.currentTimeMillis() - started);
        }
    }
}
