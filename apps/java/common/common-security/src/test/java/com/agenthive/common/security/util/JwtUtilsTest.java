package com.agenthive.common.security.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("JwtUtils JWT 工具类测试")
class JwtUtilsTest {

    private static final String STRONG_SECRET = "this-is-a-very-strong-secret-key-for-jwt-signing-32chars-min";
    private static final long ACCESS_EXPIRATION = 3600000L;    // 1 hour
    private static final long REFRESH_EXPIRATION = 604800000L; // 7 days

    private JwtUtils jwtUtils;

    @BeforeEach
    void setUp() {
        jwtUtils = new JwtUtils(STRONG_SECRET, ACCESS_EXPIRATION, REFRESH_EXPIRATION);
    }

    @Test
    @DisplayName("generateAccessToken 应生成可解析的 JWT，包含 subject 和 claims")
    void generateAccessToken_shouldProduceValidTokenWithClaims() {
        String subject = "user-123";
        Map<String, Object> claims = Map.of(
                "username", "alice",
                "roles", "ADMIN,USER"
        );

        String token = jwtUtils.generateAccessToken(subject, claims);

        assertThat(token).isNotBlank();
        Claims parsed = jwtUtils.parseToken(token);
        assertThat(parsed.getSubject()).isEqualTo(subject);
        assertThat(parsed.get("username", String.class)).isEqualTo("alice");
        assertThat(parsed.get("roles", String.class)).isEqualTo("ADMIN,USER");
    }

    @Test
    @DisplayName("generateRefreshToken 应生成只包含 subject 的 JWT")
    void generateRefreshToken_shouldProduceTokenWithOnlySubject() {
        String subject = "user-456";

        String token = jwtUtils.generateRefreshToken(subject);

        Claims parsed = jwtUtils.parseToken(token);
        assertThat(parsed.getSubject()).isEqualTo(subject);
        assertThat(parsed.get("username")).isNull();
    }

    @Test
    @DisplayName("validateToken 应在 token 有效时返回 true")
    void validateToken_shouldReturnTrue_forValidToken() {
        String token = jwtUtils.generateAccessToken("user-789", Map.of());

        assertThat(jwtUtils.validateToken(token)).isTrue();
    }

    @Test
    @DisplayName("validateToken 应在 token 被篡改时返回 false")
    void validateToken_shouldReturnFalse_forTamperedToken() {
        String token = jwtUtils.generateAccessToken("user-789", Map.of());
        String tampered = token.substring(0, token.length() - 5) + "XXXXX";

        assertThat(jwtUtils.validateToken(tampered)).isFalse();
    }

    @Test
    @DisplayName("validateToken 应在 token 为空或 null 时返回 false")
    void validateToken_shouldReturnFalse_forNullOrBlankToken() {
        assertThat(jwtUtils.validateToken(null)).isFalse();
        assertThat(jwtUtils.validateToken("")).isFalse();
        assertThat(jwtUtils.validateToken("   ")).isFalse();
    }

    @Test
    @DisplayName("getSubject 应从有效 token 中提取 subject")
    void getSubject_shouldExtractSubjectFromValidToken() {
        String token = jwtUtils.generateAccessToken("alice@agenthive.com", Map.of());

        assertThat(jwtUtils.getSubject(token)).isEqualTo("alice@agenthive.com");
    }

    @Test
    @DisplayName("getExpiration 应返回正确的过期时间")
    void getExpiration_shouldReturnFutureDate() {
        String token = jwtUtils.generateAccessToken("user", Map.of());

        Date expiration = jwtUtils.getExpiration(token);

        assertThat(expiration).isAfter(new Date());
        // 允许 5 秒误差，验证过期时间大致正确（1小时）
        long diffMs = expiration.getTime() - System.currentTimeMillis();
        assertThat(diffMs).isBetween(ACCESS_EXPIRATION - 5000L, ACCESS_EXPIRATION + 5000L);
    }

    @Test
    @DisplayName("parseToken 应在 token 过期时抛出 ExpiredJwtException")
    void parseToken_shouldThrowExpiredJwtException_forExpiredToken() throws InterruptedException {
        JwtUtils shortLived = new JwtUtils(STRONG_SECRET, 1L, 1L); // 1ms expiration
        String token = shortLived.generateAccessToken("user", Map.of());
        Thread.sleep(50); // ensure expiration

        assertThatThrownBy(() -> shortLived.parseToken(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    @DisplayName("parseToken 应在签名错误时抛出 JwtException")
    void parseToken_shouldThrowJwtException_forWrongSecret() {
        JwtUtils otherUtils = new JwtUtils("another-very-strong-secret-key-for-jwt-signing-32chars", ACCESS_EXPIRATION, REFRESH_EXPIRATION);
        String token = otherUtils.generateAccessToken("user", Map.of());

        assertThatThrownBy(() -> jwtUtils.parseToken(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("同一 secret 应能互相验证不同 JwtUtils 实例生成的 token")
    void crossInstanceValidation_shouldWorkWithSameSecret() {
        JwtUtils anotherInstance = new JwtUtils(STRONG_SECRET, ACCESS_EXPIRATION, REFRESH_EXPIRATION);
        String token = jwtUtils.generateAccessToken("cross-check", Map.of("project", "agenthive"));

        assertThat(anotherInstance.validateToken(token)).isTrue();
        assertThat(anotherInstance.getSubject(token)).isEqualTo("cross-check");
        assertThat(anotherInstance.parseToken(token).get("project")).isEqualTo("agenthive");
    }
}
