package com.agenthive.auth.service;

import com.agenthive.auth.service.dto.SendSmsVerifyCodeRequest;
import com.agenthive.auth.service.dto.VerifySmsCodeRequest;

public interface SmsService {

    void sendVerifyCode(SendSmsVerifyCodeRequest request);

    boolean verifyCode(VerifySmsCodeRequest request);
}
