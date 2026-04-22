package com.agenthive.auth.config;

import com.agenthive.common.security.util.JwtUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {

    @Value("${jwt.secret:agenthive-default-secret-key-2024}")
    private String secret;

    @Value("${jwt.access-expiration:3600000}")
    private long accessExpiration;

    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    @Bean
    public JwtUtils jwtUtils() {
        return new JwtUtils(secret, accessExpiration, refreshExpiration);
    }
}
