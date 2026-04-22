package com.agenthive.auth.controller;

import com.agenthive.auth.domain.vo.UserVO;
import com.agenthive.auth.service.AuthService;
import com.agenthive.auth.service.dto.LoginRequest;
import com.agenthive.auth.service.dto.RegisterRequest;
import com.agenthive.auth.service.dto.TokenResponse;
import com.agenthive.common.core.exception.AgentHiveException;
import com.agenthive.common.core.result.ResultCode;
import com.agenthive.common.web.advice.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(GlobalExceptionHandler.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @Test
    void register_shouldReturn200AndToken_whenSuccess() throws Exception {
        // Arrange
        TokenResponse tokenResponse = new TokenResponse();
        tokenResponse.setAccessToken("accessToken123");
        tokenResponse.setRefreshToken("refreshToken123");
        tokenResponse.setExpiresIn(3600L);
        tokenResponse.setTokenType("Bearer");

        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser");
        request.setPassword("StrongPass1!");
        request.setEmail("test@example.com");

        when(authService.register(any(RegisterRequest.class))).thenReturn(tokenResponse);

        // Act & Assert
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("accessToken123"))
                .andExpect(jsonPath("$.data.refreshToken").value("refreshToken123"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"));
    }

    @Test
    void login_shouldReturn200AndToken_whenSuccess() throws Exception {
        // Arrange
        TokenResponse tokenResponse = new TokenResponse();
        tokenResponse.setAccessToken("accessToken456");
        tokenResponse.setRefreshToken("refreshToken456");
        tokenResponse.setExpiresIn(3600L);
        tokenResponse.setTokenType("Bearer");

        LoginRequest request = new LoginRequest();
        request.setUsername("testuser");
        request.setPassword("correctPassword");

        when(authService.login(any(LoginRequest.class), any())).thenReturn(tokenResponse);

        // Act & Assert
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.accessToken").value("accessToken456"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"));
    }

    @Test
    void login_shouldReturnError_whenInvalidCredentials() throws Exception {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("testuser");
        request.setPassword("wrongPassword");

        when(authService.login(any(LoginRequest.class), any()))
                .thenThrow(new AgentHiveException(ResultCode.INVALID_CREDENTIALS));

        // Act & Assert
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ResultCode.INVALID_CREDENTIALS.getCode()))
                .andExpect(jsonPath("$.message").value(ResultCode.INVALID_CREDENTIALS.getMessage()))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void me_shouldReturnCurrentUser_whenValidToken() throws Exception {
        // Arrange
        UserVO userVO = new UserVO();
        userVO.setId(1L);
        userVO.setUsername("testuser");
        userVO.setEmail("test@example.com");
        userVO.setStatus(1);

        when(authService.getCurrentUser("validToken")).thenReturn(userVO);

        // Act & Assert
        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer validToken"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.username").value("testuser"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.email").value("test@example.com"));
    }

    @Test
    void getUserRoles_shouldReturnRoleList_whenUserExists() throws Exception {
        // Arrange
        when(authService.getUserRoles(1L)).thenReturn(List.of("ADMIN", "USER"));

        // Act & Assert
        mockMvc.perform(get("/auth/users/1/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0]").value("ADMIN"))
                .andExpect(jsonPath("$.data[1]").value("USER"))
                .andExpect(jsonPath("$.data").isArray());
    }
}
