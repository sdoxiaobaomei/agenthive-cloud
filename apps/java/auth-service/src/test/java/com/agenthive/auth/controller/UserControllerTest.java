package com.agenthive.auth.controller;

import com.agenthive.auth.service.AuthService;
import com.agenthive.common.core.result.ResultCode;
import com.agenthive.common.core.exception.AgentHiveException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = TestMvcConfig.class)
@AutoConfigureMockMvc
@Import(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    void getUserRoles_shouldReturnRoleList_whenUserExists() throws Exception {
        when(authService.getUserRoles(1L)).thenReturn(List.of("ADMIN", "USER"));

        mockMvc.perform(get("/users/1/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0]").value("ADMIN"))
                .andExpect(jsonPath("$.data[1]").value("USER"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void getUserRoles_shouldReturnEmptyList_whenUserHasNoRoles() throws Exception {
        when(authService.getUserRoles(2L)).thenReturn(List.of());

        mockMvc.perform(get("/users/2/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void getUserRoles_shouldReturnError_whenUserNotFound() throws Exception {
        when(authService.getUserRoles(anyLong()))
                .thenThrow(new AgentHiveException(ResultCode.USER_NOT_FOUND));

        mockMvc.perform(get("/users/999/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ResultCode.USER_NOT_FOUND.getCode()))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void getUserRoles_shouldRejectInvalidUserId() throws Exception {
        mockMvc.perform(get("/users/0/roles"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/users/-1/roles"))
                .andExpect(status().isBadRequest());
    }
}
