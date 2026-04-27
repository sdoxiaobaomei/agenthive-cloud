package com.agenthive.auth.config;

import com.aliyun.dypnsapi20170525.Client;
import com.aliyun.teaopenapi.models.Config;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * 阿里云号码认证服务（Dypnsapi）Client 配置。
 *
 * <p>使用 {@code com.aliyun:dypnsapi20170525:2.0.0} Tea SDK 直接调用
 * {@code dypnsapi.aliyuncs.com} 的 {@code SendSmsVerifyCode} API。</p>
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(SmsProperties.class)
public class SmsConfig {

    private static final String ENV_ACCESS_KEY_ID = "ALIBABA_CLOUD_ACCESS_KEY_ID";
    private static final String ENV_ACCESS_KEY_SECRET = "ALIBABA_CLOUD_ACCESS_KEY_SECRET";

    @Bean
    public Client dypnsClient(SmsProperties smsProperties) throws Exception {
        if (!smsProperties.isEnabled()) {
            log.warn("阿里云 SMS 功能已禁用（aliyun.sms.enabled=false）");
            return null;
        }

        String akId = System.getenv(ENV_ACCESS_KEY_ID);
        String akSecret = System.getenv(ENV_ACCESS_KEY_SECRET);

        if (!StringUtils.hasText(akId) || !StringUtils.hasText(akSecret)) {
            log.error("阿里云 SMS 凭证未找到。请设置环境变量 {} 和 {}",
                    ENV_ACCESS_KEY_ID, ENV_ACCESS_KEY_SECRET);
            return null;
        }

        Config config = new Config()
                .setAccessKeyId(akId)
                .setAccessKeySecret(akSecret)
                .setEndpoint("dypnsapi.aliyuncs.com")
                .setRegionId(smsProperties.getRegionId())
                .setProtocol("HTTPS");

        log.info("阿里云 Dypnsapi Client 初始化完成，endpoint={}，regionId={}，protocol={}",
                config.getEndpoint(), config.getRegionId(), config.getProtocol());
        return new Client(config);
    }
}
