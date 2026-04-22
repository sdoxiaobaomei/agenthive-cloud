package com.agenthive.auth.service.impl;

import com.agenthive.auth.domain.entity.SysRole;
import com.agenthive.auth.domain.entity.SysUser;
import com.agenthive.auth.mapper.RoleMapper;
import com.agenthive.auth.mapper.UserMapper;
import com.agenthive.auth.mapper.UserRoleMapper;
import com.agenthive.auth.service.dto.LoginRequest;
import com.agenthive.auth.service.dto.RegisterRequest;
import com.agenthive.auth.service.dto.TokenResponse;
import com.agenthive.common.core.exception.AgentHiveException;
import com.agenthive.common.core.result.ResultCode;
import com.agenthive.common.security.util.JwtUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private RoleMapper roleMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtUtils jwtUtils;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "accessExpiration", 3600000L);
        lenient().when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void register_shouldSucceed_whenValidRequest() {
        // Arrange
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser");
        request.setPassword("StrongPass1!");
        request.setEmail("test@example.com");

        when(userMapper.selectByUsername("newuser")).thenReturn(null);
        when(passwordEncoder.encode("StrongPass1!")).thenReturn("encodedPassword");
        when(jwtUtils.generateAccessToken(anyString(), anyMap())).thenReturn("accessToken");
        when(jwtUtils.generateRefreshToken(anyString())).thenReturn("refreshToken");

        doAnswer(invocation -> {
            SysUser user = invocation.getArgument(0);
            user.setId(1L);
            return 1;
        }).when(userMapper).insert(any(SysUser.class));

        // Act
        TokenResponse response = authService.register(request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("accessToken");
        assertThat(response.getRefreshToken()).isEqualTo("refreshToken");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
        assertThat(response.getExpiresIn()).isEqualTo(3600L);

        verify(passwordEncoder).encode("StrongPass1!");
        verify(userMapper).insert(any(SysUser.class));
        verify(userRoleMapper).insert(any(SysUserRole.class));
    }

    @Test
    void register_shouldThrowException_whenUsernameExists() {
        // Arrange
        RegisterRequest request = new RegisterRequest();
        request.setUsername("existinguser");
        request.setPassword("StrongPass1!");
        request.setEmail("test@example.com");

        SysUser existingUser = new SysUser();
        existingUser.setUsername("existinguser");
        when(userMapper.selectByUsername("existinguser")).thenReturn(existingUser);

        // Act & Assert
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(AgentHiveException.class)
                .satisfies(ex -> {
                    AgentHiveException e = (AgentHiveException) ex;
                    assertThat(e.getCode()).isEqualTo(ResultCode.USER_ALREADY_EXISTS.getCode());
                });
    }

    @Test
    void register_shouldThrowException_whenPasswordTooWeak() {
        // Arrange
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser");
        request.setPassword("weak");
        request.setEmail("test@example.com");

        // Act & Assert
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(AgentHiveException.class)
                .satisfies(ex -> {
                    AgentHiveException e = (AgentHiveException) ex;
                    assertThat(e.getCode()).isEqualTo(ResultCode.PASSWORD_TOO_WEAK.getCode());
                });
    }

    @Test
    void login_shouldSucceed_whenValidCredentials() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("testuser");
        request.setPassword("correctPassword");

        SysUser user = new SysUser();
        user.setId(1L);
        user.setUsername("testuser");
        user.setPassword("encodedPassword");
        user.setStatus(1);

        when(valueOperations.get("login:rate:127.0.0.1")).thenReturn(null);
        when(userMapper.selectByUsername("testuser")).thenReturn(user);
        when(passwordEncoder.matches("correctPassword", "encodedPassword")).thenReturn(true);
        when(jwtUtils.generateAccessToken(anyString(), anyMap())).thenReturn("accessToken");
        when(jwtUtils.generateRefreshToken(anyString())).thenReturn("refreshToken");

        // Act
        TokenResponse response = authService.login(request, "127.0.0.1");

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("accessToken");
        verify(stringRedisTemplate).delete("login:rate:127.0.0.1");
    }

    @Test
    void login_shouldThrowException_whenPasswordIncorrect() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("testuser");
        request.setPassword("wrongPassword");

        SysUser user = new SysUser();
        user.setId(1L);
        user.setUsername("testuser");
        user.setPassword("encodedPassword");
        user.setStatus(1);

        when(valueOperations.get("login:rate:127.0.0.1")).thenReturn(null);
        when(userMapper.selectByUsername("testuser")).thenReturn(user);
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);
        when(valueOperations.increment("login:rate:127.0.0.1")).thenReturn(1L);

        // Act & Assert
        assertThatThrownBy(() -> authService.login(request, "127.0.0.1"))
                .isInstanceOf(AgentHiveException.class)
                .satisfies(ex -> {
                    AgentHiveException e = (AgentHiveException) ex;
                    assertThat(e.getCode()).isEqualTo(ResultCode.INVALID_CREDENTIALS.getCode());
                });

        verify(valueOperations).increment("login:rate:127.0.0.1");
        verify(stringRedisTemplate).expire("login:rate:127.0.0.1", 1, TimeUnit.MINUTES);
    }

    @Test
    void login_shouldThrowException_whenUserNotFound() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("nonexistent");
        request.setPassword("somePassword");

        when(valueOperations.get("login:rate:192.168.1.1")).thenReturn(null);
        when(userMapper.selectByUsername("nonexistent")).thenReturn(null);
        when(valueOperations.increment("login:rate:192.168.1.1")).thenReturn(1L);

        // Act & Assert
        assertThatThrownBy(() -> authService.login(request, "192.168.1.1"))
                .isInstanceOf(AgentHiveException.class)
                .satisfies(ex -> {
                    AgentHiveException e = (AgentHiveException) ex;
                    assertThat(e.getCode()).isEqualTo(ResultCode.INVALID_CREDENTIALS.getCode());
                });

        verify(valueOperations).increment("login:rate:192.168.1.1");
        verify(stringRedisTemplate).expire("login:rate:192.168.1.1", 1, TimeUnit.MINUTES);
    }

    @Test
    void login_shouldThrowException_whenRateLimitExceeded() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("testuser");
        request.setPassword("password");

        when(valueOperations.get("login:rate:10.0.0.1")).thenReturn("5");

        // Act & Assert
        assertThatThrownBy(() -> authService.login(request, "10.0.0.1"))
                .isInstanceOf(AgentHiveException.class)
                .satisfies(ex -> {
                    AgentHiveException e = (AgentHiveException) ex;
                    assertThat(e.getCode()).isEqualTo(ResultCode.RATE_LIMIT_EXCEEDED.getCode());
                });

        verify(userMapper, never()).selectByUsername(anyString());
    }

    @Test
    void getUserRoles_shouldReturnRoleList() {
        // Arrange
        Long userId = 1L;
        SysRole role1 = new SysRole();
        role1.setId(1L);
        role1.setRoleCode("ADMIN");
        role1.setRoleName("Administrator");

        SysRole role2 = new SysRole();
        role2.setId(2L);
        role2.setRoleCode("USER");
        role2.setRoleName("User");

        when(roleMapper.selectRolesByUserId(userId)).thenReturn(List.of(role1, role2));

        // Act
        List<String> roles = authService.getUserRoles(userId);

        // Assert
        assertThat(roles).containsExactly("ADMIN", "USER");
        verify(roleMapper, times(1)).selectRolesByUserId(userId);
    }

    @Test
    void getUserRoles_shouldReturnEmptyList_whenNoRoles() {
        // Arrange
        Long userId = 99L;
        when(roleMapper.selectRolesByUserId(userId)).thenReturn(Collections.emptyList());

        // Act
        List<String> roles = authService.getUserRoles(userId);

        // Assert
        assertThat(roles).isEmpty();
        verify(roleMapper, times(1)).selectRolesByUserId(userId);
    }
}
