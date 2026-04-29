package com.agenthive.auth.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SysUserSecurityTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    void passwordShouldBeExcludedFromSerialization() throws Exception {
        SysUser user = new SysUser();
        user.setUsername("testuser");
        user.setPassword("secret123");
        user.setEmail("test@example.com");

        String json = objectMapper.writeValueAsString(user);
        JsonNode node = objectMapper.readTree(json);

        assertThat(node.has("password")).isFalse();
        assertThat(json).doesNotContain("secret123");
    }

    @Test
    void passwordShouldBeExcludedFromToString() {
        SysUser user = new SysUser();
        user.setUsername("testuser");
        user.setPassword("secret123");
        user.setEmail("test@example.com");

        String str = user.toString();

        assertThat(str).doesNotContain("secret123");
        assertThat(str).doesNotContain("password=");
    }
}
