package com.agenthive.auth.controller;

import com.agenthive.auth.service.SmsService;
import com.agenthive.auth.service.dto.SendSmsVerifyCodeRequest;
import com.agenthive.auth.service.dto.VerifySmsCodeRequest;
import com.agenthive.common.core.result.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth/sms")
@RequiredArgsConstructor
public class SmsController {

    private final SmsService smsService;

    @PostMapping("/send")
    public Result<Void> sendVerifyCode(@Valid @RequestBody SendSmsVerifyCodeRequest request) {
        // 前端 type 映射到模板类型
        if (request.getTemplateType() == null && request.getType() != null) {
            request.setTemplateType(mapTypeToTemplateType(request.getType()));
        }
        smsService.sendVerifyCode(request);
        return Result.success();
    }

    @PostMapping("/verify")
    public Result<Void> verifyCode(@Valid @RequestBody VerifySmsCodeRequest request) {
        // 未指定模板类型时默认使用登录/注册模板
        if (request.getTemplateType() == null) {
            request.setTemplateType("LOGIN_REGISTER");
        }
        smsService.verifyCode(request);
        return Result.success();
    }

    private String mapTypeToTemplateType(String type) {
        return switch (type.toLowerCase()) {
            case "login", "register" -> "LOGIN_REGISTER";
            case "reset" -> "RESET_PASSWORD";
            default -> "LOGIN_REGISTER";
        };
    }
}
