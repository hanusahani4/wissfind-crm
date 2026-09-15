package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.service.CurrentUser;
import com.wissfind.marketplace.service.TelegramNotificationService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/telegram")
public class TelegramController {
    private final TelegramNotificationService telegram;
    private final UserRepository users;

    public TelegramController(TelegramNotificationService telegram, UserRepository users) {
        this.telegram = telegram;
        this.users = users;
    }

    @GetMapping("/connect")
    @PreAuthorize("hasRole('SELLER')")
    public Map<String, Object> connect() {
        User seller = users.findById(CurrentUser.id()).orElseThrow();
        return Map.of(
                "connected", seller.telegramChatId != null && !seller.telegramChatId.isBlank(),
                "connectUrl", telegram.getConnectUrl(seller.id)
        );
    }

    @GetMapping("/status")
    @PreAuthorize("hasRole('SELLER')")
    public Map<String, Object> status() {
        User seller = users.findById(CurrentUser.id()).orElseThrow();
        return Map.of("connected", seller.telegramChatId != null && !seller.telegramChatId.isBlank());
    }
}
