package com.videocall.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateNameRequest(
        @NotBlank(message = "Full name is required.")
        @Size(min = 2, max = 80, message = "Full name must be between 2 and 80 characters.")
        String fullName
) {
}
