package com.wissfind.marketplace.service;

import com.wissfind.marketplace.entity.OtpChallenge;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.OtpChallengeRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.security.JwtService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {

 private final UserRepository users;
 private final OtpChallengeRepository otps;
 private final PasswordEncoder encoder;
 private final JwtService jwt;

 private final SecureRandom random = new SecureRandom();
 private final boolean exposeDev;
 private final long ttlMinutes;

 public AuthService(
         UserRepository u,
         OtpChallengeRepository o,
         PasswordEncoder e,
         JwtService j,
         @Value("${app.otp.expose-dev:true}") boolean exposeDev,
         @Value("${app.otp.ttl-minutes:10}") long ttlMinutes
 ) {
  this.users = u;
  this.otps = o;
  this.encoder = e;
  this.jwt = j;
  this.exposeDev = exposeDev;
  this.ttlMinutes = ttlMinutes;
 }

 public Map<String, Object> sendOtp(String phone, String purpose) {

  String p = norm(phone);

  String otp = String.format(
          "%06d",
          random.nextInt(1_000_000)
  );

  OtpChallenge c = new OtpChallenge();
  c.phone = p;
  c.purpose = purpose;
  c.otp = otp;
  c.expiresAt = Instant.now()
          .plus(Duration.ofMinutes(ttlMinutes));

  otps.save(c);

  System.out.println(
          "[WISSFIND OTP] purpose="
                  + purpose
                  + " phone="
                  + p
                  + " otp="
                  + otp
  );

  Map<String, Object> out = new LinkedHashMap<>();

  out.put(
          "message",
          "OTP generated. Configure an SMS provider for delivery."
  );

  out.put("purpose", purpose);

  // Development only
  if (exposeDev) {
   out.put("devOtp", otp);
  }

  return out;
 }

 public Map<String, Object> verifyOtp(
         String phone,
         String otp,
         String purpose
 ) {

  OtpChallenge c = otps.findAll()
          .stream()
          .filter(x ->
                  x.phone.equals(norm(phone))
                          && x.purpose.equals(purpose)
                          && !x.verified
                          && x.expiresAt.isAfter(Instant.now())
          )
          .reduce((a, b) -> b)
          .orElse(null);

  if (c == null || !c.otp.equals(otp)) {
   throw new IllegalArgumentException(
           "Invalid or expired OTP"
   );
  }

  c.verified = true;
  otps.save(c);

  return Map.of("verified", true);
 }

 public Map<String, Object> register(
         String phone,
         String password,
         String name,
         String otp
 ) {

  verifyOtp(phone, otp, "SIGNUP");

  if (users.findByPhone(norm(phone)).isPresent()) {
   throw new IllegalArgumentException(
           "Phone already registered"
   );
  }

  User u = new User();

  u.phone = norm(phone);
  u.name = name;
  u.passwordHash = encoder.encode(password);
  u.phoneVerified = true;
  u.role = User.Role.CUSTOMER;

  users.save(u);

  return token(u);
 }

 public Map<String, Object> login(
         String phone,
         String password
 ) {

  User u = users.findByPhone(norm(phone))
          .orElseThrow(() ->
                  new IllegalArgumentException(
                          "Invalid phone or password"
                  )
          );

  if (!encoder.matches(password, u.passwordHash)) {
   throw new IllegalArgumentException(
           "Invalid phone or password"
   );
  }

  return token(u);
 }

 public void resetPassword(
         String phone,
         String otp,
         String password
 ) {

  String normalizedPhone = norm(phone);
  OtpChallenge challenge = otps.findAll().stream()
          .filter(x -> normalizedPhone.equals(x.phone))
          .filter(x -> "RESET".equals(x.purpose))
          .filter(x -> x.verified)
          .filter(x -> x.expiresAt != null && x.expiresAt.isAfter(Instant.now()))
          .filter(x -> x.otp.equals(otp))
          .reduce((a, b) -> b)
          .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP"));

  User u = users.findByPhone(normalizedPhone)
          .orElseThrow(() -> new IllegalArgumentException("Account not found"));

  if (password == null || password.length() < 6) {
   throw new IllegalArgumentException("Password must contain at least 6 characters");
  }

  u.passwordHash = encoder.encode(password);
  users.save(u);

  challenge.verified = true;
  otps.save(challenge);
 }

 public User currentUser() {

  return users.findById(CurrentUser.id())
          .orElseThrow();
 }

 public Map<String, Object> token(User u) {

  return Map.of(
          "token",
          jwt.generate(
                  u.id,
                  u.phone,
                  u.role.name()
          ),

          "user",
          Map.of(
                  "id", u.id,
                  "name", u.name,
                  "phone", u.phone,
                  "role", u.role.name()
          )
  );
 }

 public static String norm(String p) {

  String s = p.trim()
          .replaceAll("\\D", "");

  return s.startsWith("91")
          ? "+" + s
          : "+91" + s;
 }
}