package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    record Otp(
            @NotBlank String phone,
            @NotBlank @Pattern(regexp = "SIGNUP|RESET") String purpose) {}

    record OtpVerify(
            @NotBlank String phone,
            @NotBlank @Size(min = 4, max = 8) String otp,
            @NotBlank @Pattern(regexp = "SIGNUP|RESET") String purpose) {}

    record Register(
            @NotBlank String phone,
            @NotBlank @Size(min = 8) String password,
            @NotBlank @Size(max = 100) String name) {}

    record Login(
            @NotBlank String phone,
            @NotBlank String password) {}

    record Reset(
            @NotBlank String phone,
            @NotBlank @Size(min = 8) String password) {}

    @PostMapping(value = "/otp/send", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> send(@Valid @RequestBody Otp r) {
        return auth.sendOtp(r.phone(), r.purpose());
    }

    @PostMapping(value = "/otp/verify", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> verify(@Valid @RequestBody OtpVerify r) {
        return auth.verifyOtp(r.phone(), r.otp(), r.purpose());
    }

    @PostMapping("/register")
    public Object register(@Valid @RequestBody Register r) {
        return auth.register(r.phone(), r.password(), r.name());
    }

    @PostMapping("/login")
    public Object login(@Valid @RequestBody Login r) {
        return auth.login(r.phone(), r.password());
    }

    @GetMapping("/me")
    public Object me() {
        return auth.token(auth.currentUser());
    }

    @PostMapping("/reset-password")
    public Object reset(@Valid @RequestBody Reset r) {
        auth.resetPassword(r.phone(), r.password());
        return Map.of("message", "Password updated");
    }
}
