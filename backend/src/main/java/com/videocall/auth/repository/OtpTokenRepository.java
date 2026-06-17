package com.videocall.auth.repository;

import com.videocall.auth.model.OtpToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Optional;

public interface OtpTokenRepository extends MongoRepository<OtpToken, String> {
    Optional<OtpToken> findTopByEmailIgnoreCaseAndPurposeAndUsedFalseOrderByIdDesc(
            String email,
            OtpToken.Purpose purpose
    );

    long countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(
            String email,
            OtpToken.Purpose purpose,
            Instant createdAt
    );
}
