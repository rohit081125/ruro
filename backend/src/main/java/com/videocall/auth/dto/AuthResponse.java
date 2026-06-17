package com.videocall.auth.dto;

public record AuthResponse(
        String token,
        UserResponse user,
        String message
) {
}
