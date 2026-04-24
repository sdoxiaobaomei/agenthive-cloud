package com.agenthive.user.service.impl;

import com.agenthive.common.core.exception.AgentHiveException;
import com.agenthive.common.core.result.Result;
import com.agenthive.common.core.result.ResultCode;
import com.agenthive.user.domain.entity.SysUser;
import com.agenthive.user.domain.vo.UserVO;
import com.agenthive.user.feign.AuthFeignClient;
import com.agenthive.user.mapper.UserMapper;
import com.agenthive.user.service.dto.UpdateUserRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserServiceImpl 用户服务测试")
class UserServiceImplTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private AuthFeignClient authFeignClient;

    @InjectMocks
    private UserServiceImpl userService;

    private SysUser existingUser;

    @BeforeEach
    void setUp() {
        existingUser = new SysUser();
        existingUser.setId(1L);
        existingUser.setUsername("alice");
        existingUser.setEmail("alice@agenthive.com");
        existingUser.setPhone("13800138000");
        existingUser.setAvatar("https://cdn.agenthive.com/avatars/alice.png");
        existingUser.setStatus(1);
        existingUser.setCreatedAt(LocalDateTime.of(2024, 1, 15, 10, 30));
    }

    @Nested
    @DisplayName("getUserById 查询用户")
    class GetUserByIdTests {

        @Test
        @DisplayName("用户存在时应返回 UserVO")
        void shouldReturnUserVO_whenUserExists() {
            when(userMapper.selectById(1L)).thenReturn(existingUser);

            UserVO result = userService.getUserById(1L);

            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(1L);
            assertThat(result.getUsername()).isEqualTo("alice");
            assertThat(result.getEmail()).isEqualTo("alice@agenthive.com");
            assertThat(result.getPhone()).isEqualTo("13800138000");
            assertThat(result.getAvatar()).isEqualTo("https://cdn.agenthive.com/avatars/alice.png");
            assertThat(result.getStatus()).isEqualTo(1);
            assertThat(result.getCreatedAt()).isEqualTo(LocalDateTime.of(2024, 1, 15, 10, 30));
        }

        @Test
        @DisplayName("用户不存在时应抛出 USER_NOT_FOUND 异常")
        void shouldThrowException_whenUserNotFound() {
            when(userMapper.selectById(999L)).thenReturn(null);

            assertThatThrownBy(() -> userService.getUserById(999L))
                    .isInstanceOf(AgentHiveException.class)
                    .satisfies(ex -> {
                        AgentHiveException e = (AgentHiveException) ex;
                        assertThat(e.getCode()).isEqualTo(ResultCode.USER_NOT_FOUND.getCode());
                    });
        }
    }

    @Nested
    @DisplayName("updateUser 更新用户")
    class UpdateUserTests {

        @Test
        @DisplayName("应更新邮箱、手机号和头像并返回更新后的 UserVO")
        void shouldUpdateFields_whenAllProvided() {
            when(userMapper.selectById(1L)).thenReturn(existingUser);

            UpdateUserRequest request = new UpdateUserRequest();
            request.setEmail("alice.new@agenthive.com");
            request.setPhone("13900139000");
            request.setAvatar("https://cdn.agenthive.com/avatars/alice-v2.png");

            UserVO result = userService.updateUser(1L, request);

            assertThat(result.getEmail()).isEqualTo("alice.new@agenthive.com");
            assertThat(result.getPhone()).isEqualTo("13900139000");
            assertThat(result.getAvatar()).isEqualTo("https://cdn.agenthive.com/avatars/alice-v2.png");
            verify(userMapper).updateById(isA(SysUser.class));
        }

        @Test
        @DisplayName("部分字段为 null 时不应覆盖原有值")
        void shouldPreserveExistingValues_whenPartialUpdate() {
            when(userMapper.selectById(1L)).thenReturn(existingUser);

            UpdateUserRequest request = new UpdateUserRequest();
            request.setEmail("alice.partial@agenthive.com");
            // phone and avatar are null

            UserVO result = userService.updateUser(1L, request);

            assertThat(result.getEmail()).isEqualTo("alice.partial@agenthive.com");
            assertThat(result.getPhone()).isEqualTo("13800138000"); // preserved
            assertThat(result.getAvatar()).isEqualTo("https://cdn.agenthive.com/avatars/alice.png"); // preserved
            verify(userMapper).updateById(isA(SysUser.class));
        }

        @Test
        @DisplayName("用户不存在时应抛出 USER_NOT_FOUND 异常")
        void shouldThrowException_whenUserNotFound() {
            when(userMapper.selectById(888L)).thenReturn(null);

            UpdateUserRequest request = new UpdateUserRequest();
            request.setEmail("new@agenthive.com");

            assertThatThrownBy(() -> userService.updateUser(888L, request))
                    .isInstanceOf(AgentHiveException.class)
                    .satisfies(ex -> {
                        AgentHiveException e = (AgentHiveException) ex;
                        assertThat(e.getCode()).isEqualTo(ResultCode.USER_NOT_FOUND.getCode());
                    });

            verify(userMapper, never()).updateById(isA(SysUser.class));
        }
    }

    @Nested
    @DisplayName("getUserRoles 获取用户角色")
    class GetUserRolesTests {

        @Test
        @DisplayName("应返回 auth-service 提供的角色列表")
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
}
