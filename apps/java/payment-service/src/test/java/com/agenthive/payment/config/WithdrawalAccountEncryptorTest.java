package com.agenthive.payment.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WithdrawalAccountEncryptorTest {

    private final WithdrawalAccountEncryptor encryptor = new WithdrawalAccountEncryptor();

    @Test
    void init_unresolvedPlaceholder_shouldThrow() {
        ReflectionTestUtils.setField(encryptor, "encryptionKey", "${WITHDRAWAL_ENCRYPT_KEY}");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> encryptor.init());
        assertTrue(ex.getMessage().contains("unresolved placeholder"));
        assertTrue(ex.getMessage().contains("WITHDRAWAL_ENCRYPT_KEY"));
    }

    @Test
    void init_nullKey_shouldThrow() {
        ReflectionTestUtils.setField(encryptor, "encryptionKey", null);
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> encryptor.init());
        assertTrue(ex.getMessage().contains("withdrawal.encrypt.key is required"));
    }

    @Test
    void init_blankKey_shouldThrow() {
        ReflectionTestUtils.setField(encryptor, "encryptionKey", "   ");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> encryptor.init());
        assertTrue(ex.getMessage().contains("withdrawal.encrypt.key is required"));
    }

    @Test
    void init_wrongLength_shouldThrow() {
        ReflectionTestUtils.setField(encryptor, "encryptionKey", "short-key-123");
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> encryptor.init());
        assertTrue(ex.getMessage().contains("exactly 32 characters"));
    }

    @Test
    void init_valid32CharKey_shouldPass() {
        ReflectionTestUtils.setField(encryptor, "encryptionKey",
            "aB7#kL9@mN2$pQ4&rT6*vW8^xY1!zC34");
        assertDoesNotThrow(() -> encryptor.init());
    }
}
