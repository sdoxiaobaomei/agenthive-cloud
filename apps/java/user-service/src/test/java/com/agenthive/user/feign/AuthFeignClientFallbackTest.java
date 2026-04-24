package com.agenthive.user.feign;

import com.agenthive.common.core.result.Result;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("AuthFeignClientFallback 熔断降级测试")
class AuthFeignClientFallbackTest {

    private final AuthFeignClientFallback fallback = new AuthFeignClientFallback();

    @Test
    @DisplayName("getUserRolesInternal 应返回空列表")
    void getUserRolesInternal_shouldReturnEmptyList() {
        Long userId = 42L;

        Result<List<String>> result = fallback.getUserRolesInternal(userId);

        assertThat(result).isNotNull();
        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getData()).isEmpty();
    }

    @Test
    @DisplayName("getUserRoles 应通过 default 方法返回空列表")
    void getUserRoles_shouldReturnEmptyListViaDefaultMethod() {
        List<String> roles = fallback.getUserRoles(99L);

        assertThat(roles).isNotNull().isEmpty();
    }
}
