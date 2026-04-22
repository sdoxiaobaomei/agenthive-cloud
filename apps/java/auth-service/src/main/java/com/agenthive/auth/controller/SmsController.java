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
@RequestMapping("/sms")
@RequiredArgsConstructor
public class SmsController {

    private final SmsService smsService;

    @PostMapping("/send")
    public Result<Void> sendVerifyCode(@Valid @RequestBody SendSmsVerifyCodeRequest request) {
        smsService.sendVerifyCode(request);
        return Result.success();
    }

    @PostMapping("/verify")
    public Result<Void> verifyCode(@Valid @RequestBody VerifySmsCodeRequest request) {
        smsService.verifyCode(request);
        return Result.success();
    }
}
