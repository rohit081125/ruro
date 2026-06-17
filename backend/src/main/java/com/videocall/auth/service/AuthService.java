package com.videocall.auth.service;

import com.videocall.auth.dto.AuthResponse;
import com.videocall.auth.dto.ChangePasswordRequest;
import com.videocall.auth.dto.CompleteSignupRequest;
import com.videocall.auth.dto.LoginRequest;
import com.videocall.auth.dto.MessageResponse;
import com.videocall.auth.dto.ResetPasswordRequest;
import com.videocall.auth.dto.UpdateNameRequest;
import com.videocall.auth.dto.UserResponse;
import com.videocall.auth.model.OtpToken;
import com.videocall.auth.model.User;
import com.videocall.auth.repository.OtpTokenRepository;
import com.videocall.auth.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final OtpTokenRepository otpTokenRepository;
    private final EmailService emailService;
    private final TokenService tokenService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();
    private final long otpExpirationMinutes;
    private final long otpResendCooldownSeconds;
    private final long otpHourlyLimit;

    public AuthService(
            UserRepository userRepository,
            OtpTokenRepository otpTokenRepository,
            EmailService emailService,
            TokenService tokenService,
            @Value("${app.auth.otp-expiration-minutes}") long otpExpirationMinutes,
            @Value("${app.auth.otp-resend-cooldown-seconds}") long otpResendCooldownSeconds,
            @Value("${app.auth.otp-hourly-limit}") long otpHourlyLimit
    ) {
        this.userRepository = userRepository;
        this.otpTokenRepository = otpTokenRepository;
        this.emailService = emailService;
        this.tokenService = tokenService;
        this.otpExpirationMinutes = otpExpirationMinutes;
        this.otpResendCooldownSeconds = otpResendCooldownSeconds;
        this.otpHourlyLimit = otpHourlyLimit;
    }

    public MessageResponse requestSignupOtp(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AuthException(HttpStatus.CONFLICT, "An account already exists for this email.");
        }

        return createOtp(email, OtpToken.Purpose.SIGNUP, "RURO signup verification OTP");
    }

    public MessageResponse verifySignupOtp(String rawEmail, String otp) {
        verifyOtp(normalizeEmail(rawEmail), OtpToken.Purpose.SIGNUP, otp, false);
        return new MessageResponse("OTP verified.", null);
    }

    public AuthResponse completeSignup(CompleteSignupRequest request) {
        String email = normalizeEmail(request.email());
        assertPasswordsMatch(request.password(), request.confirmPassword());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new AuthException(HttpStatus.CONFLICT, "An account already exists for this email.");
        }

        User user = userRepository.save(new User(
                request.fullName().trim(),
                email,
                passwordEncoder.encode(request.password())
        ));
        emailService.sendWelcomeEmail(user.getEmail(), user.getFullName());
        return authResponse(user, "Account created successfully.");
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AuthException(HttpStatus.NOT_FOUND, "User not registered."));

        if (!user.isEnabled()) {
            throw new AuthException(HttpStatus.FORBIDDEN, "This account is disabled.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Entered password is wrong.");
        }

        return authResponse(user, "Authentication successful.");
    }

    public MessageResponse requestPasswordResetOtp(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (!userRepository.existsByEmailIgnoreCase(email)) {
            return new MessageResponse("If an account exists, an OTP has been sent.", null);
        }

        return createOtp(email, OtpToken.Purpose.PASSWORD_RESET, "RURO password reset OTP");
    }

    public MessageResponse resetPassword(ResetPasswordRequest request) {
        String email = normalizeEmail(request.email());
        assertPasswordsMatch(request.password(), request.confirmPassword());

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AuthException(HttpStatus.NOT_FOUND, "No account exists for this email."));

        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);
        return new MessageResponse("Password reset complete.", null);
    }

    public MessageResponse changePassword(String authorizationHeader, ChangePasswordRequest request) {
        String userId = tokenService.getUserIdFromBearerToken(authorizationHeader);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, "Please login again."));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Current password is wrong.");
        }

        assertPasswordsMatch(request.newPassword(), request.confirmPassword());

        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "New password must be different from current password.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return new MessageResponse("Password changed successfully.", null);
    }

    public MessageResponse changeName(String authorizationHeader, UpdateNameRequest request) {
        String userId = tokenService.getUserIdFromBearerToken(authorizationHeader);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, "Please login again."));

        if (request.fullName() == null || request.fullName().trim().isBlank()) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Name cannot be empty.");
        }

        user.setFullName(request.fullName().trim());
        userRepository.save(user);
        return new MessageResponse("Name changed successfully.", null);
    }

    private MessageResponse createOtp(String email, OtpToken.Purpose purpose, String subject) {
        enforceOtpRateLimit(email, purpose);
        String otp = "%06d".formatted(secureRandom.nextInt(1_000_000));
        OtpToken token = new OtpToken(
                email,
                purpose,
                passwordEncoder.encode(otp),
                Instant.now().plusSeconds(otpExpirationMinutes * 60)
        );
        otpTokenRepository.save(token);
        boolean sent = emailService.sendOtp(email, otp, subject);
        if (!sent) {
            throw new AuthException(
                    HttpStatus.BAD_GATEWAY,
                    "OTP email provider is not configured or rejected the request. Please verify the SendGrid API key and sender email."
            );
        }
        return new MessageResponse("OTP sent to your email.", null);
    }

    private void verifyOtp(String email, OtpToken.Purpose purpose, String otp, boolean markUsed) {
        OtpToken token = otpTokenRepository.findTopByEmailIgnoreCaseAndPurposeAndUsedFalseOrderByIdDesc(email, purpose)
                .orElseThrow(() -> new AuthException(HttpStatus.BAD_REQUEST, "Invalid or expired OTP."));

        if (token.isUsed() || token.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Invalid or expired OTP.");
        }

        if (token.getFailedAttempts() >= 5) {
            throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "Too many invalid OTP attempts. Request a new code.");
        }

        if (!passwordEncoder.matches(otp, token.getCodeHash())) {
            token.registerFailedAttempt();
            otpTokenRepository.save(token);
            throw new AuthException(HttpStatus.BAD_REQUEST, "Invalid or expired OTP.");
        }

        if (markUsed) {
            token.markUsed();
            otpTokenRepository.save(token);
        }
    }

    private AuthResponse authResponse(User user, String message) {
        return new AuthResponse(
                tokenService.createToken(user),
                new UserResponse(user.getId(), user.getFullName(), user.getEmail()),
                message
        );
    }

    private void enforceOtpRateLimit(String email, OtpToken.Purpose purpose) {
        Instant now = Instant.now();
        long sentInWindow = otpTokenRepository.countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(
                email,
                purpose,
                now.minusSeconds(3600)
        );

        if (sentInWindow >= otpHourlyLimit) {
            throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "Too many OTP requests. Try again later.");
        }

        otpTokenRepository.findTopByEmailIgnoreCaseAndPurposeAndUsedFalseOrderByIdDesc(email, purpose)
                .filter(token -> token.getExpiresAt().isAfter(now))
                .ifPresent(token -> {
                    Instant cooldownUntil = token.getExpiresAt()
                            .minusSeconds((otpExpirationMinutes * 60) - otpResendCooldownSeconds);
                    if (now.isBefore(cooldownUntil)) {
                        throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "Please wait before requesting another OTP.");
                    }
                });
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private void assertPasswordsMatch(String password, String confirmPassword) {
        if (password == null || !password.equals(confirmPassword)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Passwords do not match.");
        }
    }
}
