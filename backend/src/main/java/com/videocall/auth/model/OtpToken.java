package com.videocall.auth.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "rurootps")
@CompoundIndex(name = "idx_otp_email_purpose", def = "{'email': 1, 'purpose': 1}")
public class OtpToken {
    public enum Purpose {
        SIGNUP,
        PASSWORD_RESET
    }

    @Id
    private String id;

    private String email;

    private Purpose purpose;

    private String codeHash;

    @Indexed(expireAfterSeconds = 0)
    private Instant expiresAt;

    private boolean used = false;

    private int failedAttempts = 0;

    @CreatedDate
    private Instant createdAt;

    protected OtpToken() {
    }

    public OtpToken(String email, Purpose purpose, String codeHash, Instant expiresAt) {
        this.email = email;
        this.purpose = purpose;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public boolean isUsed() {
        return used;
    }

    public void markUsed() {
        used = true;
    }

    public int getFailedAttempts() {
        return failedAttempts;
    }

    public void registerFailedAttempt() {
        failedAttempts++;
    }
}
