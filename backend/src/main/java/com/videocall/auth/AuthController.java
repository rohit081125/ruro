package com.videocall.auth;

import com.videocall.auth.dto.AuthResponse;
import com.videocall.auth.dto.ChangePasswordRequest;
import com.videocall.auth.dto.CompleteSignupRequest;
import com.videocall.auth.dto.EmailRequest;
import com.videocall.auth.dto.LoginRequest;
import com.videocall.auth.dto.MessageResponse;
import com.videocall.auth.dto.ResetPasswordRequest;
import com.videocall.auth.dto.UpdateNameRequest;
import com.videocall.auth.dto.VerifyOtpRequest;
import com.videocall.auth.service.AuthException;
import com.videocall.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/signup/request-otp")
    public MessageResponse requestSignupOtp(@Valid @RequestBody EmailRequest request) {
        return authService.requestSignupOtp(request.email());
    }

    @PostMapping("/signup/verify-otp")
    public MessageResponse verifySignupOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return authService.verifySignupOtp(request.email(), request.otp());
    }

    @PostMapping("/signup/complete")
    public AuthResponse completeSignup(@Valid @RequestBody CompleteSignupRequest request) {
        return authService.completeSignup(request);
    }

    @PostMapping("/forgot/request-otp")
    public MessageResponse requestPasswordResetOtp(@Valid @RequestBody EmailRequest request) {
        return authService.requestPasswordResetOtp(request.email());
    }

    @PostMapping("/forgot/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }

    @PostMapping("/change-password")
    public MessageResponse changePassword(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        return authService.changePassword(authorizationHeader, request);
    }

    @PostMapping("/change-name")
    public MessageResponse changeName(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody UpdateNameRequest request
    ) {
        return authService.changeName(authorizationHeader, request);
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, String>> handleAuthException(AuthException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationException(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getDefaultMessage() == null ? "Please fill all required fields correctly." : error.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining(" "));

        if (message.isBlank()) {
            message = "Please fill all required fields correctly.";
        }

        return ResponseEntity.badRequest().body(Map.of("message", message));
    }
}
