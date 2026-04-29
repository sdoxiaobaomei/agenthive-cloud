package com.agenthive.payment.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class InternalApiConfig {

    @Value("${internal.api.token}")
    private String token;

    @PostConstruct
    public void validateToken() {
        if (token != null && token.startsWith("${") && token.endsWith("}")) {
            throw new IllegalStateException(
                "[SECURITY] internal.api.token appears to be an unresolved placeholder: " + token + 
                ". Please set the INTERNAL_API_TOKEN environment variable."
            );
        }
        if (token == null || token.isBlank()) {
            throw new IllegalStateException(
                "[SECURITY] internal.api.token is required. " +
                "Please configure a strong random token for internal API authentication."
            );
        }
        if (token.length() < 32) {
            throw new IllegalStateException(
                "[SECURITY] internal.api.token must be at least 32 characters long."
            );
        }
    }

    public String getToken() {
        return token;
    }

    public boolean validate(String headerToken) {
        return token.equals(headerToken);
    }
}
