package com.wissfind.marketplace.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Map;

@Service
public class CloudinaryImageService {

    private final Cloudinary cloudinary;

    public CloudinaryImageService(@Value("${cloudinary.url:}") String cloudinaryUrl) {
        this.cloudinary = cloudinaryUrl == null || cloudinaryUrl.isBlank()
                ? null
                : new Cloudinary(cloudinaryUrl);
    }

    public UploadedImage upload(byte[] bytes, String folder, String publicId) throws IOException {
        requireConfigured();

        Map result = cloudinary.uploader().upload(bytes, ObjectUtils.asMap(
                "resource_type", "image",
                "folder", folder,
                "public_id", publicId,
                "overwrite", false
        ));

        String secureUrl = result.get("secure_url") == null
                ? String.valueOf(result.get("url"))
                : String.valueOf(result.get("secure_url"));
        String returnedPublicId = String.valueOf(result.get("public_id"));

        return new UploadedImage(returnedPublicId, secureUrl);
    }

    /** Build the current HTTPS delivery URL from a stored Cloudinary public id. */
    public String secureUrl(String publicId) {
        if (cloudinary == null || publicId == null || publicId.isBlank()) return null;
        try {
            return cloudinary.url()
                    .secure(true)
                    .resourceType("image")
                    .type("upload")
                    .generate(publicId);
        } catch (Exception ignored) {
            return null;
        }
    }

    public void delete(String publicId) {
        if (publicId == null || publicId.isBlank() || cloudinary == null) return;
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap(
                    "resource_type", "image",
                    "type", "upload",
                    "invalidate", true
            ));
        } catch (Exception ignored) {
            // Do not make a product/database delete fail because Cloudinary
            // asset cleanup could not be completed. The DB row is still removed.
        }
    }

    private void requireConfigured() {
        if (cloudinary == null) {
            throw new IllegalStateException(
                    "Cloudinary is not configured. Set CLOUDINARY_URL in backend/.env."
            );
        }
    }

    public record UploadedImage(String publicId, String secureUrl) {}
}
