package com.agenthive.auth.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtConfigTest {

    private final JwtConfig jwtConfig = new JwtConfig();

    @Test
    void validateSecret_unresolvedPlaceholder_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "${JWT_SECRET}");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("unresolved placeholder"));
        assertTrue(ex.getMessage().contains("JWT_SECRET"));
    }

    @Test
    void validateSecret_nullSecret_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", null);
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("jwt.secret is required"));
    }

    @Test
    void validateSecret_blankSecret_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "   ");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("jwt.secret is required"));
    }

    @Test
    void validateSecret_tooShort_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "short-secret-123");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("at least 32 characters"));
    }

    @Test
    void validateSecret_containsDefault_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "this-is-a-default-secret-value-123");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("weak/default value"));
    }

    @Test
    void validateSecret_containsSecret_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "this-is-my-secret-key-for-testing-12345");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("weak/default value"));
    }

    @Test
    void validateSecret_containsPassword_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "this-is-my-password-key-for-testing-12345");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("weak/default value"));
    }

    @Test
    void validateSecret_contains123_shouldThrow() {
        ReflectionTestUtils.setField(jwtConfig, "secret", "this-is-my-key-for-testing-123456789012");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> jwtConfig.validateSecret());
        assertTrue(ex.getMessage().contains("weak/default value"));
    }

    @Test
    void validateSecret_validStrongSecret_shouldPass() {
        ReflectionTestUtils.setField(jwtConfig, "secret",
            "aB7#kL9@mN2$pQ4&rT6*vW8^xY1!zC34");
        assertDoesNotThrow(() -> jwtConfig.validateSecret());
    }
}
