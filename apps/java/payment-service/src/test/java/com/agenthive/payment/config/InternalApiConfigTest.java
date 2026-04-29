package com.agenthive.payment.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InternalApiConfigTest {

    private final InternalApiConfig config = new InternalApiConfig();

    @Test
    void validateToken_unresolvedPlaceholder_shouldThrow() {
        ReflectionTestUtils.setField(config, "token", "${INTERNAL_API_TOKEN}");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.validateToken());
        assertTrue(ex.getMessage().contains("unresolved placeholder"));
        assertTrue(ex.getMessage().contains("INTERNAL_API_TOKEN"));
    }

    @Test
    void validateToken_nullToken_shouldThrow() {
        ReflectionTestUtils.setField(config, "token", null);
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.validateToken());
        assertTrue(ex.getMessage().contains("internal.api.token is required"));
    }

    @Test
    void validateToken_blankToken_shouldThrow() {
        ReflectionTestUtils.setField(config, "token", "   ");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.validateToken());
        assertTrue(ex.getMessage().contains("internal.api.token is required"));
    }

    @Test
    void validateToken_tooShort_shouldThrow() {
        ReflectionTestUtils.setField(config, "token", "short-token-123");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> config.validateToken());
        assertTrue(ex.getMessage().contains("at least 32 characters"));
    }

    @Test
    void validateToken_validStrongToken_shouldPass() {
        ReflectionTestUtils.setField(config, "token",
            "aB7#kL9@mN2$pQ4&rT6*vW8^xY1!zC34");
        assertDoesNotThrow(() -> config.validateToken());
    }
}
