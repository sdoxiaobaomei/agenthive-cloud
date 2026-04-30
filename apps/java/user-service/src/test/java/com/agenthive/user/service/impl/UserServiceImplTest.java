package com.agenthive.user.service.impl;

import com.agenthive.user.feign.AuthFeignClient;
import com.agenthive.user.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl 用户服务测试")
class UserServiceImplTest {

    @Mock
    private AuthFeignClient authFeignClient;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    @DisplayName("getUserRoles 应返回 auth-service 提供的角色列表")
    void shouldReturnRolesFromAuthService() {
        List<String> expectedRoles = List.of("ADMIN", "DEVELOPER", "AUDITOR");
        when(authFeignClient.getUserRoles(1L)).thenReturn(expectedRoles);

        List<String> result = userService.getUserRoles(1L);

        assertThat(result).containsExactly("ADMIN", "DEVELOPER", "AUDITOR");
        verify(authFeignClient).getUserRoles(1L);
    }

    @Test
    @DisplayName("当 auth-service 降级时应返回空列表")
    void shouldReturnEmptyList_whenAuthServiceFallback() {
        when(authFeignClient.getUserRoles(2L)).thenReturn(List.of());

        List<String> result = userService.getUserRoles(2L);

        assertThat(result).isEmpty();
    }
}
