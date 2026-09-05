package com.wissfind.marketplace.service;

import com.wissfind.marketplace.entity.OtpChallenge;
import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.OtpChallengeRepository;
import com.wissfind.marketplace.repo.UserRepository;
import com.wissfind.marketplace.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String SIGNUP = "SIGNUP";
    private static final String RESET = "RESET";

    private final UserRepository users;
    private final OtpChallengeRepository otps;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final TwoFactorOtpService twoFactor;
    private final long ttlMinutes;
    private final long resendCooldownSeconds;

    public AuthService(UserRepository u, OtpChallengeRepository o, PasswordEncoder e, JwtService j,
                       TwoFactorOtpService twoFactor,
                       @Value("${app.otp.ttl-minutes:10}") long ttlMinutes,
                       @Value("${app.otp.resend-cooldown-seconds:60}") long resendCooldownSeconds) {
        this.users=u; this.otps=o; this.encoder=e; this.jwt=j; this.twoFactor=twoFactor;
        this.ttlMinutes=ttlMinutes; this.resendCooldownSeconds=resendCooldownSeconds;
    }

    public Map<String,Object> sendOtp(String phone,String purpose) {
        String p=norm(phone);
        String normalizedPurpose=purpose==null?"":purpose.trim().toUpperCase();
        if(!SIGNUP.equals(normalizedPurpose)&&!RESET.equals(normalizedPurpose)) throw new IllegalArgumentException("Invalid OTP purpose");
        validateIndianPhone(p);

        if(SIGNUP.equals(normalizedPurpose)&&users.findByPhone(p).isPresent()) throw new IllegalArgumentException("Phone already registered");
        if(RESET.equals(normalizedPurpose)&&users.findByPhone(p).isEmpty()) return Map.of("sent",false,"message","If the account exists, a verification code has been sent.");

        Instant now=Instant.now();
        OtpChallenge latest=otps.findTopByPhoneAndPurposeOrderByCreatedAtDesc(p,normalizedPurpose).orElse(null);
        if(latest!=null&&latest.createdAt!=null&&latest.createdAt.plusSeconds(resendCooldownSeconds).isAfter(now)) {
            long remaining=Math.max(1,Duration.between(now,latest.createdAt.plusSeconds(resendCooldownSeconds)).toSeconds());
            throw new IllegalArgumentException("Please wait "+remaining+" seconds before requesting another OTP");
        }

        TwoFactorOtpService.SendResult provider=twoFactor.send(p);
        log.info("OTP provider completed; status={}, sessionPresent={}, otpPresent={}",
                provider.status(), provider.sessionId()!=null && !provider.sessionId().isBlank(),
                provider.otp()!=null && !provider.otp().isBlank());

        if(latest!=null&&!latest.consumed&&!latest.verified) {
            latest.consumed=true; latest.consumedAt=now; otps.save(latest);
            log.info("Previous pending OTP challenge marked consumed");
        }

        OtpChallenge challenge=new OtpChallenge();
        challenge.phone=p;
        challenge.purpose=normalizedPurpose;
        challenge.sessionId=provider.sessionId();
        challenge.otp=provider.otp();
        challenge.expiresAt=now.plus(Duration.ofMinutes(ttlMinutes));
        log.info("Saving new OTP challenge: sessionPresent={}, otpPresent={}",
                challenge.sessionId!=null && !challenge.sessionId.isBlank(),
                challenge.otp!=null && !challenge.otp.isBlank());
        otps.save(challenge);
        log.info("New OTP challenge saved successfully with id={}", challenge.id);

        Map<String,Object> out=new LinkedHashMap<>();
        out.put("sent",true);
        out.put("success",true);
        out.put("message","OTP sent successfully");
        out.put("purpose",normalizedPurpose);
        out.put("expiresInSeconds",ttlMinutes*60);
        out.put("resendAfterSeconds",resendCooldownSeconds);
        out.put("sessionPresent",true);
        return out;
    }

    public Map<String,Object> verifyOtp(String phone,String otp,String purpose) {
        String p=norm(phone); String normalizedPurpose=purpose==null?"":purpose.trim().toUpperCase();
        validateIndianPhone(p);
        if(!SIGNUP.equals(normalizedPurpose)&&!RESET.equals(normalizedPurpose)) throw new IllegalArgumentException("Invalid OTP purpose");
        if(otp==null||!otp.trim().matches("\\d{6}")) throw new IllegalArgumentException("Enter a valid 6-digit OTP");

        Instant now=Instant.now();
        OtpChallenge challenge=otps.findTopByPhoneAndPurposeAndSessionIdIsNotNullAndVerifiedFalseAndConsumedFalseAndExpiresAtAfterOrderByCreatedAtDesc(p,normalizedPurpose,now)
                .orElseThrow(()->new IllegalArgumentException("Invalid or expired OTP"));

        String submittedOtp=otp.trim();
        twoFactor.verify(challenge.sessionId,submittedOtp);
        if(challenge.otp==null || !submittedOtp.equals(challenge.otp)) {
            log.warn("Ninza OTP verification failed for phone ending {}", lastFour(p));
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        challenge.verified=true; challenge.verifiedAt=now; otps.save(challenge);
        log.info("Ninza OTP verification succeeded for phone ending {}", lastFour(p));
        return Map.of("verified",true,"success",true,"message","OTP verified successfully");
    }

    public Map<String,Object> register(String phone,String password,String name) {
        String p=norm(phone); validateIndianPhone(p); validatePassword(password);
        Instant now=Instant.now();
        OtpChallenge challenge=otps.findTopByPhoneAndPurposeAndSessionIdIsNotNullAndVerifiedTrueAndConsumedFalseAndExpiresAtAfterOrderByCreatedAtDesc(p,SIGNUP,now)
                .orElseThrow(()->new IllegalArgumentException("Phone verification is required"));
        if(users.findByPhone(p).isPresent()) throw new IllegalArgumentException("Phone already registered");
        if(name==null||name.trim().isBlank()) throw new IllegalArgumentException("Name is required");

        User u=new User(); u.phone=p; u.name=name.trim(); u.passwordHash=encoder.encode(password);
        u.phoneVerified=true; u.role=User.Role.CUSTOMER; users.save(u);
        challenge.consumed=true; challenge.consumedAt=now; otps.save(challenge);
        return token(u);
    }

    public Map<String,Object> login(String phone,String password) {
        User u=users.findByPhone(norm(phone)).orElseThrow(()->new IllegalArgumentException("Invalid phone or password"));
        if(!encoder.matches(password,u.passwordHash)) throw new IllegalArgumentException("Invalid phone or password");
        return token(u);
    }

    public void resetPassword(String phone,String password) {
        String p=norm(phone); validateIndianPhone(p); validatePassword(password);
        Instant now=Instant.now();
        OtpChallenge challenge=otps.findTopByPhoneAndPurposeAndSessionIdIsNotNullAndVerifiedTrueAndConsumedFalseAndExpiresAtAfterOrderByCreatedAtDesc(p,RESET,now)
                .orElseThrow(()->new IllegalArgumentException("Reset session expired. Please request a new OTP."));
        User u=users.findByPhone(p).orElseThrow(()->new IllegalArgumentException("Account not found"));
        u.passwordHash=encoder.encode(password); users.save(u);
        challenge.consumed=true; challenge.consumedAt=now; otps.save(challenge);
    }

    private void validatePassword(String password){ if(password==null||password.length()<8) throw new IllegalArgumentException("Password must contain at least 8 characters"); }
    private void validateIndianPhone(String phone){ if(!phone.matches("\\+91[6-9]\\d{9}")) throw new IllegalArgumentException("Enter a valid 10-digit Indian mobile number"); }
    private String lastFour(String phone){ return phone==null||phone.length()<4?"****":phone.substring(phone.length()-4); }
    public User currentUser(){ return users.findById(CurrentUser.id()).orElseThrow(); }
    public Map<String,Object> token(User u){ return Map.of("token",jwt.generate(u.id,u.phone,u.role.name()),"user",Map.of("id",u.id,"name",u.name,"phone",u.phone,"role",u.role.name())); }

    public static String norm(String p){
        if(p==null) throw new IllegalArgumentException("Phone number is required");
        String s=p.trim().replaceAll("\\D","");
        if(s.startsWith("91")&&s.length()==12) return "+"+s;
        if(s.length()==10) return "+91"+s;
        return "+"+s;
    }
}
