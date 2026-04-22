package com.agenthive.auth.config;

import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.profile.DefaultProfile;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SmsProperties.class)
public class SmsConfig {

    @Bean
    public IAcsClient acsClient(SmsProperties smsProperties) {
        DefaultProfile profile = DefaultProfile.getProfile(
                smsProperties.getRegionId(),
                smsProperties.getAccessKeyId(),
                smsProperties.getAccessKeySecret()
        );
        return new DefaultAcsClient(profile);
    }
}
