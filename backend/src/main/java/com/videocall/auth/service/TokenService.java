package com.videocall.auth.service;

import com.videocall.auth.model.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
public class TokenService {
    private final String secret;
    private final long expirationMinutes;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TokenService(
            @Value("${app.auth.jwt-secret}") String secret,
            @Value("${app.auth.token-expiration-minutes}") long expirationMinutes
    ) {
        this.secret = secret;
        this.expirationMinutes = expirationMinutes;
    }

    public String createToken(User user) {
        Instant expiresAt = Instant.now().plusSeconds(expirationMinutes * 60);
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = base64Url("""
                {"sub":"%s","email":"%s","exp":%d}
                """.formatted(user.getId(), user.getEmail(), expiresAt.getEpochSecond()).trim());
        String unsignedToken = header + "." + payload;
        return unsignedToken + "." + sign(unsignedToken);
    }

    public String getUserIdFromBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Please login again.");
        }

        String token = authorizationHeader.substring("Bearer ".length()).trim();
        String[] parts = token.split("\\.");

        if (parts.length != 3) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Please login again.");
        }

        String unsignedToken = parts[0] + "." + parts[1];
        if (!sign(unsignedToken).equals(parts[2])) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Please login again.");
        }

        try {
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            Map<String, Object> payload = objectMapper.readValue(payloadJson, new TypeReference<>() {
            });
            long exp = ((Number) payload.get("exp")).longValue();

            if (Instant.now().getEpochSecond() >= exp) {
                throw new AuthException(HttpStatus.UNAUTHORIZED, "Your session expired. Please login again.");
            }

            return String.valueOf(payload.get("sub"));
        } catch (AuthException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Please login again.");
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not sign auth token", ex);
        }
    }

    private String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
