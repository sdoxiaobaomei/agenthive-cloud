package com.agenthive.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "aliyun.sms")
public class SmsProperties {

    private String accessKeyId;
    private String accessKeySecret;
    private String regionId = "cn-hangzhou";
    private String defaultSignName = "云渚科技验证平台";
    private int codeExpireMinutes = 5;
    private int dailyLimit = 10;
    private int intervalSeconds = 60;
}
