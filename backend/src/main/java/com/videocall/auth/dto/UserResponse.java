package com.videocall.auth.dto;

public record UserResponse(
        String id,
        String fullName,
        String email
) {
}
