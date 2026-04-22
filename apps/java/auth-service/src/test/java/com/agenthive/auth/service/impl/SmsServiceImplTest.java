package com.agenthive.auth.service.impl;

import com.agenthive.auth.config.SmsProperties;
import com.agenthive.auth.domain.enums.SmsTemplateType;
import com.agenthive.auth.service.dto.SendSmsVerifyCodeRequest;
import com.agenthive.auth.service.dto.VerifySmsCodeRequest;
import com.agenthive.common.core.exception.AgentHiveException;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.dysmsapi.model.v20170525.SendSmsResponse;
import com.aliyuncs.exceptions.ClientException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SmsServiceImplTest {

    @Mock
    private IAcsClient acsClient;

    @Mock
    private SmsProperties smsProperties;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private SmsServiceImpl smsService;

    @BeforeEach
    void setUp() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(smsProperties.getDailyLimit()).thenReturn(10);
        when(smsProperties.getIntervalSeconds()).thenReturn(60);
        when(smsProperties.getDefaultSignName()).thenReturn("云渚科技验证平台");
        when(smsProperties.isOidcEnabled()).thenReturn(false);
    }

    @Test
    void sendVerifyCode_success() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");

        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.get(startsWith("sms:daily:"))).thenReturn("0");

        SendSmsResponse response = new SendSmsResponse();
        response.setCode("OK");
        response.setBizId("123456");
        when(acsClient.getAcsResponse(any())).thenReturn(response);

        assertDoesNotThrow(() -> smsService.sendVerifyCode(request));

        verify(valueOperations).set(startsWith("sms:code:"), matches("\\d{6}"), eq(5L), eq(java.util.concurrent.TimeUnit.MINUTES));
        verify(valueOperations).increment(startsWith("sms:daily:"));
        verify(valueOperations).set(startsWith("sms:interval:"), eq("1"), eq(60L), eq(java.util.concurrent.TimeUnit.SECONDS));
    }

    @Test
    void sendVerifyCode_rateLimitInterval() {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");

        when(valueOperations.get(startsWith("sms:interval:"))).thenReturn("1");

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.sendVerifyCode(request));
        assertEquals(7100, ex.getCode());
    }

    @Test
    void sendVerifyCode_dailyLimitExceeded() {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");

        when(valueOperations.get(startsWith("sms:interval:"))).thenReturn(null);
        when(valueOperations.get(startsWith("sms:daily:"))).thenReturn("10");

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.sendVerifyCode(request));
        assertEquals(7101, ex.getCode());
    }

    @Test
    void sendVerifyCode_aliyunError() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");

        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.get(startsWith("sms:daily:"))).thenReturn("0");

        SendSmsResponse response = new SendSmsResponse();
        response.setCode("isv.BUSINESS_LIMIT_CONTROL");
        response.setMessage("触发业务流控");
        when(acsClient.getAcsResponse(any())).thenReturn(response);

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.sendVerifyCode(request));
        assertEquals(7102, ex.getCode());
    }

    @Test
    void sendVerifyCode_clientException() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");

        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.get(startsWith("sms:daily:"))).thenReturn("0");

        when(acsClient.getAcsResponse(any())).thenThrow(new ClientException("SDK.Error", "SDK error"));

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.sendVerifyCode(request));
        assertEquals(7102, ex.getCode());
    }

    @Test
    void verifyCode_success() {
        VerifySmsCodeRequest request = new VerifySmsCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setCode("123456");

        when(valueOperations.get(startsWith("sms:code:"))).thenReturn("123456");

        assertTrue(smsService.verifyCode(request));
        verify(stringRedisTemplate).delete(startsWith("sms:code:"));
    }

    @Test
    void verifyCode_expired() {
        VerifySmsCodeRequest request = new VerifySmsCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setCode("123456");

        when(valueOperations.get(startsWith("sms:code:"))).thenReturn(null);

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.verifyCode(request));
        assertEquals(7103, ex.getCode());
    }

    @Test
    void verifyCode_wrongCode() {
        VerifySmsCodeRequest request = new VerifySmsCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setCode("123456");

        when(valueOperations.get(startsWith("sms:code:"))).thenReturn("654321");

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.verifyCode(request));
        assertEquals(7104, ex.getCode());
    }

    @Test
    void sendVerifyCode_invalidTemplateType() {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("INVALID_TYPE");

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.sendVerifyCode(request));
        assertEquals(400, ex.getCode());
    }

    @Test
    void sendVerifyCode_invalidSignName() {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setSignName("非法签名");

        AgentHiveException ex = assertThrows(AgentHiveException.class,
                () -> smsService.sendVerifyCode(request));
        assertEquals(400, ex.getCode());
    }

    @Test
    void sendVerifyCode_customValidSignName() throws Exception {
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest();
        request.setPhone("13800138000");
        request.setTemplateType("LOGIN_REGISTER");
        request.setSignName("速通互联验证码");

        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.get(startsWith("sms:daily:"))).thenReturn("0");

        SendSmsResponse response = new SendSmsResponse();
        response.setCode("OK");
        response.setBizId("123456");
        when(acsClient.getAcsResponse(any())).thenReturn(response);

        assertDoesNotThrow(() -> smsService.sendVerifyCode(request));
    }
}
