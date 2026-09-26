package com.wissfind.marketplace.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables scheduled Telegram polling and order notification jobs. */
@Configuration
@EnableScheduling
public class TelegramSchedulingConfig {
}
