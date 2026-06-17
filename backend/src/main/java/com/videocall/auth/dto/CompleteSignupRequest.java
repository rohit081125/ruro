package com.videocall.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompleteSignupRequest(
        @NotBlank(message = "Full name is required.")
        @Size(min = 2, max = 80, message = "Full name must be between 2 and 80 characters.")
        String fullName,
        @Email @NotBlank String email,
        @NotBlank(message = "Password is required.")
        @Size(min = 8, max = 100, message = "Password must be at least 8 characters long.")
        String password,
        @NotBlank(message = "Confirm password is required.")
        @Size(min = 8, max = 100, message = "Password must be at least 8 characters long.")
        String confirmPassword
) {
}

