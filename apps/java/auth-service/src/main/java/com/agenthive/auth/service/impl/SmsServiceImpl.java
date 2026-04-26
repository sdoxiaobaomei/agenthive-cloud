package com.agenthive.auth.service.impl;

import com.agenthive.auth.config.SmsProperties;
import com.agenthive.auth.domain.enums.SmsSignature;
import com.agenthive.auth.domain.enums.SmsTemplateType;
import com.agenthive.auth.service.SmsService;
import com.agenthive.auth.service.dto.SendSmsVerifyCodeRequest;
import com.agenthive.auth.service.dto.VerifySmsCodeRequest;
import com.agenthive.common.core.exception.AgentHiveException;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.dysmsapi.model.v20170525.SendSmsRequest;
import com.aliyuncs.dysmsapi.model.v20170525.SendSmsResponse;
import com.aliyuncs.exceptions.ClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmsServiceImpl implements SmsService {

    private final IAcsClient acsClient;
    private final SmsProperties smsProperties;
    private final StringRedisTemplate stringRedisTemplate;

    private static final String SMS_CODE_KEY_PREFIX = "sms:code:";
    private static final String SMS_DAILY_COUNT_PREFIX = "sms:daily:";
    private static final String SMS_INTERVAL_PREFIX = "sms:interval:";

    @Override
    public void sendVerifyCode(SendSmsVerifyCodeRequest request) {
        String phone = request.getPhone();
        SmsTemplateType templateType = parseTemplateType(request.getTemplateType());
        String signName = resolveSignName(request.getSignName());

        checkRateLimit(phone, templateType);

        String code = generateCode();

        if (!smsProperties.isEnabled()) {
            log.warn("[LOCAL DEV] 阿里云 SMS 已禁用，跳过真实发送。验证码 {} 已存入 Redis（phone={}，template={}）",
                    code, phone, templateType.getTemplateCode());
        } else {
            String templateParam = String.format("{\"code\":\"%s\",\"min\":\"%d\"}",
                    code, templateType.getDefaultExpireMinutes());

            SendSmsRequest sendSmsRequest = new SendSmsRequest();
            sendSmsRequest.setPhoneNumbers(phone);
            sendSmsRequest.setSignName(signName);
            sendSmsRequest.setTemplateCode(templateType.getTemplateCode());
            sendSmsRequest.setTemplateParam(templateParam);

            try {
                SendSmsResponse response = acsClient.getAcsResponse(sendSmsRequest);
                if (response.getCode() != null && "OK".equals(response.getCode())) {
                    log.info("SMS sent successfully to {}, template: {}, bizId: {}",
                            phone, templateType.getTemplateCode(), response.getBizId());
                } else {
                    log.error("SMS send failed to {}, code: {}, message: {}",
                            phone, response.getCode(), response.getMessage());
                    throw new AgentHiveException(7102, "短信发送失败: " + response.getMessage());
                }
            } catch (ClientException e) {
                log.error("SMS send exception to {}, errCode: {}, errMsg: {}",
                        phone, e.getErrCode(), e.getErrMsg(), e);
                throw new AgentHiveException(7102, "短信发送失败: " + e.getErrMsg());
            }
        }

        String codeKey = buildCodeKey(phone, templateType);
        stringRedisTemplate.opsForValue().set(codeKey, code,
                templateType.getDefaultExpireMinutes(), TimeUnit.MINUTES);

        String dailyKey = buildDailyKey(phone);
        stringRedisTemplate.opsForValue().increment(dailyKey);
        stringRedisTemplate.expire(dailyKey, getSecondsUntilMidnight(), TimeUnit.SECONDS);

        String intervalKey = buildIntervalKey(phone);
        stringRedisTemplate.opsForValue().set(intervalKey, "1", smsProperties.getIntervalSeconds(), TimeUnit.SECONDS);
    }

    @Override
    public boolean verifyCode(VerifySmsCodeRequest request) {
        String phone = request.getPhone();
        SmsTemplateType templateType = parseTemplateType(request.getTemplateType());
        String code = request.getCode();

        String codeKey = buildCodeKey(phone, templateType);
        String cachedCode = stringRedisTemplate.opsForValue().get(codeKey);

        if (cachedCode == null) {
            throw new AgentHiveException(7103, "验证码已过期或不存在");
        }

        if (!cachedCode.equals(code)) {
            throw new AgentHiveException(7104, "验证码错误");
        }

        stringRedisTemplate.delete(codeKey);
        return true;
    }

    private SmsTemplateType parseTemplateType(String type) {
        return Arrays.stream(SmsTemplateType.values())
                .filter(t -> t.name().equalsIgnoreCase(type))
                .findFirst()
                .orElseThrow(() -> new AgentHiveException(400, "不支持的模板类型: " + type));
    }

    private String resolveSignName(String signName) {
        if (signName != null && !signName.isBlank()) {
            boolean valid = Arrays.stream(SmsSignature.values())
                    .anyMatch(s -> s.getSignName().equals(signName));
            if (valid) {
                return signName;
            }
            throw new AgentHiveException(400, "无效的短信签名: " + signName);
        }
        return smsProperties.getDefaultSignName();
    }

    private void checkRateLimit(String phone, SmsTemplateType templateType) {
        String intervalKey = buildIntervalKey(phone);
        String intervalFlag = stringRedisTemplate.opsForValue().get(intervalKey);
        if (intervalFlag != null) {
            throw new AgentHiveException(7100, "短信发送过于频繁，请稍后再试");
        }

        String dailyKey = buildDailyKey(phone);
        String dailyCountStr = stringRedisTemplate.opsForValue().get(dailyKey);
        int dailyCount = dailyCountStr == null ? 0 : Integer.parseInt(dailyCountStr);
        if (dailyCount >= smsProperties.getDailyLimit()) {
            throw new AgentHiveException(7101, "当日短信发送次数已达上限");
        }
    }

    private String generateCode() {
        int code = ThreadLocalRandom.current().nextInt(100000, 1000000);
        return String.valueOf(code);
    }

    private String buildCodeKey(String phone, SmsTemplateType templateType) {
        return SMS_CODE_KEY_PREFIX + phone + ":" + templateType.name();
    }

    private String buildDailyKey(String phone) {
        return SMS_DAILY_COUNT_PREFIX + phone;
    }

    private String buildIntervalKey(String phone) {
        return SMS_INTERVAL_PREFIX + phone;
    }

    private long getSecondsUntilMidnight() {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.time.LocalDateTime midnight = now.toLocalDate().plusDays(1).atStartOfDay();
        return java.time.Duration.between(now, midnight).getSeconds();
    }
}
