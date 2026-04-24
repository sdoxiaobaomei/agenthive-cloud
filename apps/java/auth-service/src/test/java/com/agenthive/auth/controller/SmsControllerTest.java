package com.agenthive.auth.controller;

import com.agenthive.auth.service.SmsService;
import com.agenthive.auth.service.dto.SendSmsVerifyCodeRequest;
import com.agenthive.auth.service.dto.VerifySmsCodeRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = TestMvcConfig.class)
@AutoConfigureMockMvc
@Import(SmsController.class)
@DisplayName("SmsController 短信控制器测试")
class SmsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @MockBean
    private SmsService smsService;

    @Test
    @DisplayName("POST /auth/sms/send 应调用 smsService 并返回 200")
    void sendVerifyCode_shouldCallServiceAndReturn200() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setSignName("云渚科技验证平台");

        mockMvc.perform(post("/auth/sms/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(smsService).sendVerifyCode(argThat(r ->
                r.getPhone().equals("13800138000") &&
                r.getTemplateType().equals("LOGIN_REGISTER") &&
                r.getSignName().equals("云渚科技验证平台")
        ));
    }

    @Test
    @DisplayName("POST /auth/sms/send 前端 type 映射应正确转换为 templateType")
    void sendVerifyCode_shouldMapTypeToTemplateType() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setType("login");

        mockMvc.perform(post("/auth/sms/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(smsService).sendVerifyCode(argThat(r ->
                r.getPhone().equals("13800138000") &&
                r.getTemplateType().equals("LOGIN_REGISTER")
        ));
    }

    @Test
    @DisplayName("POST /auth/sms/send 手机号格式错误时应返回 400")
    void sendVerifyCode_shouldReturn400_whenPhoneInvalid() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("12345678901"); // 不以 1[3-9] 开头
        request.setType("login");

        mockMvc.perform(post("/auth/sms/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("POST /auth/sms/send 缺少手机号时应返回 400")
    void sendVerifyCode_shouldReturn400_whenPhoneMissing() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        // phone is missing
        request.setType("login");

        mockMvc.perform(post("/auth/sms/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("POST /auth/sms/verify 应调用 smsService 并返回 200")
    void verifyCode_shouldCallServiceAndReturn200() throws Exception {
        VerifySmsCodeRequest request = new VerifySmsCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setCode("123456");

        mockMvc.perform(post("/auth/sms/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(smsService).verifyCode(argThat(r ->
                r.getPhone().equals("13800138000") &&
                r.getTemplateType().equals("LOGIN_REGISTER") &&
                r.getCode().equals("123456")
        ));
    }

    @Test
    @DisplayName("POST /auth/sms/verify 未传 templateType 时应使用默认 LOGIN_REGISTER")
    void verifyCode_shouldUseDefaultTemplateType() throws Exception {
        VerifySmsCodeRequest request = new VerifySmsCodeRequest();
        request.setPhone("13800138000");
        request.setCode("123456");
        // templateType not set

        mockMvc.perform(post("/auth/sms/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(smsService).verifyCode(argThat(r ->
                r.getPhone().equals("13800138000") &&
                r.getTemplateType().equals("LOGIN_REGISTER") &&
                r.getCode().equals("123456")
        ));
    }

    @Test
    @DisplayName("POST /auth/sms/verify 验证码不是6位数字时应返回 400")
    void verifyCode_shouldReturn400_whenCodeNotSixDigits() throws Exception {
        VerifySmsCodeRequest request = new VerifySmsCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setCode("abc123");

        mockMvc.perform(post("/auth/sms/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }
}
