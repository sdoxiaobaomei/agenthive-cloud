package com.agenthive.common.security.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SecureDigestAlgorithm;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Slf4j
public class JwtUtils {

    private static final SecureDigestAlgorithm<SecretKey, SecretKey> SIGNATURE_ALGORITHM = Jwts.SIG.HS256;

    private final SecretKey key;
    private final long accessTokenExpiration;
    private final long refreshTokenExpiration;

    public JwtUtils(String secret, long accessTokenExpiration, long refreshTokenExpiration) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException(
                "JWT_SECRET must be at least 32 bytes (256 bits) for HS256. " +
                "Got " + keyBytes.length + " bytes. " +
                "Generate with: openssl rand -base64 32"
            );
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
    }

    public String generateAccessToken(String subject, Map<String, Object> claims) {
        return generateToken(subject, claims, accessTokenExpiration);
    }

    public String generateRefreshToken(String subject) {
        return generateToken(subject, Map.of(), refreshTokenExpiration);
    }

    private String generateToken(String subject, Map<String, Object> claims, long expiration) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expiration);
        JwtBuilder builder = Jwts.builder()
                .subject(subject)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key, SIGNATURE_ALGORITHM);
        claims.forEach(builder::claim);
        return builder.compact();
    }

    public Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.warn("JWT expired");
            throw e;
        } catch (JwtException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
            throw e;
        }
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String getSubject(String token) {
        return parseToken(token).getSubject();
    }

    public Date getExpiration(String token) {
        return parseToken(token).getExpiration();
    }
}
