package com.wissfind.marketplace.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Makes the legacy DB image column nullable so new Cloudinary-backed image
 * records can keep only metadata/URLs in MySQL.
 */
@Component
public class CloudinaryImageSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public CloudinaryImageSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE product_image_data MODIFY COLUMN image_data LONGBLOB NULL"
            );
        } catch (Exception ignored) {
            // Existing installations may already have the correct schema.
            // Hibernate ddl-auto=update also manages the new Cloudinary columns.
        }
    }
}
