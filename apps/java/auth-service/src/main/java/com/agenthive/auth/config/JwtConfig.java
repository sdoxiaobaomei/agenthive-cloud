package com.agenthive.auth.config;

import com.agenthive.common.security.util.JwtUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-expiration:3600000}")
    private long accessExpiration;

    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    @PostConstruct
    public void validateSecret() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                "[SECURITY] jwt.secret is required but not set. " +
                "Please configure a strong random secret (min 32 chars) in application properties or environment variables."
            );
        }
        if (secret.length() < 32) {
            throw new IllegalStateException(
                "[SECURITY] jwt.secret must be at least 32 characters long. " +
                "Current length: " + secret.length()
            );
        }
        if (secret.toLowerCase().contains("default") ||
            secret.toLowerCase().contains("secret") ||
            secret.toLowerCase().contains("password") ||
            secret.toLowerCase().contains("123")) {
            throw new IllegalStateException(
                "[SECURITY] jwt.secret appears to be a weak/default value. " +
                "Please use a cryptographically strong random string."
            );
        }
    }

    @Bean
    public JwtUtils jwtUtils() {
        return new JwtUtils(secret, accessExpiration, refreshExpiration);
    }
}
