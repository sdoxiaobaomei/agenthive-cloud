package com.agenthive.gateway.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {

    @Value("${jwt.secret}")
    private String secret;

    @PostConstruct
    public void validateSecret() {
        if (secret != null && secret.startsWith("${") && secret.endsWith("}")) {
            throw new IllegalStateException(
                "[SECURITY] jwt.secret appears to be an unresolved placeholder: " + secret + 
                ". Please set the JWT_SECRET environment variable."
            );
        }
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
}
