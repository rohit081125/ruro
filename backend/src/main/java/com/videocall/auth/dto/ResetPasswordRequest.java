package com.videocall.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @Email @NotBlank String email,
        @NotBlank(message = "Password is required.")
        @Size(min = 8, max = 100, message = "Password must be at least 8 characters long.")
        String password,
        @NotBlank(message = "Confirm password is required.")
        @Size(min = 8, max = 100, message = "Password must be at least 8 characters long.")
        String confirmPassword
) {
}
