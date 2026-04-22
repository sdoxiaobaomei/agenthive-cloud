package com.agenthive.auth.config;

import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.auth.AlibabaCloudCredentials;
import com.aliyuncs.auth.BasicSessionCredentials;
import com.aliyuncs.profile.DefaultProfile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * 阿里云 SMS Client 配置。
 *
 * <p><b>安全设计</b>：支持三种凭证来源（按安全优先级）：
 * <ol>
 *   <li><b>OIDC + RAM Role（生产环境强烈推荐）</b>
 *       <p>与 GitHub Actions OIDC → AssumeRoleWithWebIdentity → AWS STS 完全同构。
 *       K8s ServiceAccount JWT → AssumeRoleWithOIDC → 阿里云 STS 临时凭证。
 *       代码和配置中<b>零长期 AccessKey</b>。</li>
 *   <li><b>环境变量 STS 临时凭证</b>：ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET / SECURITY_TOKEN</li>
 *   <li><b>环境变量长期 AccessKey</b>：ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET（仅本地开发兜底）</li>
 * </ol>
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(SmsProperties.class)
public class SmsConfig {

    private static final String ENV_ACCESS_KEY_ID = "ALIBABA_CLOUD_ACCESS_KEY_ID";
    private static final String ENV_ACCESS_KEY_SECRET = "ALIBABA_CLOUD_ACCESS_KEY_SECRET";
    private static final String ENV_SECURITY_TOKEN = "ALIBABA_CLOUD_SECURITY_TOKEN";

    @Bean
    public IAcsClient acsClient(SmsProperties smsProperties) {
        if (!smsProperties.isEnabled()) {
            log.warn("阿里云 SMS 功能已禁用（aliyun.sms.enabled=false）");
            // 返回一个 dummy client，调用时会抛异常
            return new DefaultAcsClient(DefaultProfile.getProfile(smsProperties.getRegionId()));
        }

        String regionId = smsProperties.getRegionId();
        DefaultProfile profile = DefaultProfile.getProfile(regionId);
        Credential credential = resolveCredential(smsProperties);

        if (credential instanceof BasicSessionCredentials) {
            log.info("阿里云 SMS Client 初始化完成，region={}，凭证类型=STS临时凭证", regionId);
        } else {
            log.info("阿里云 SMS Client 初始化完成，region={}，凭证类型=AccessKey", regionId);
            log.warn("当前使用的是长期 AccessKey，存在泄露风险。" +
                    "生产环境强烈建议使用 OIDC + RAM Role（aliyun.sms.oidc-enabled=true）");
        }

        return new DefaultAcsClient(profile, credential);
    }

    /**
     * 按优先级解析凭证来源。
     */
    private AlibabaCloudCredentials resolveCredential(SmsProperties props) {
        // ===== 优先级 1：OIDC + RAM Role（K8s 生产环境推荐） =====
        if (props.isOidcEnabled()) {
            validateOidcConfig(props);
            OidcCredentialsProvider provider = new OidcCredentialsProvider(props);
            return provider.getCredential();
        }

        // ===== 优先级 2：环境变量 STS 临时凭证 =====
        String akId = System.getenv(ENV_ACCESS_KEY_ID);
        String akSecret = System.getenv(ENV_ACCESS_KEY_SECRET);
        String token = System.getenv(ENV_SECURITY_TOKEN);
        if (StringUtils.hasText(akId) && StringUtils.hasText(akSecret)) {
            if (StringUtils.hasText(token)) {
                log.info("从环境变量读取到 STS 临时凭证（含 SecurityToken）");
                return new BasicSessionCredentials(akId, akSecret, token);
            }
            log.info("从环境变量读取到 AccessKey（非 STS）");
            return new com.aliyuncs.auth.Credential(akId, akSecret);
        }

        throw new IllegalStateException(
            "阿里云 SMS 凭证未找到。请通过以下方式之一提供：\n" +
            "1. 【推荐】OIDC + RAM Role：设置 aliyun.sms.oidc-enabled=true 及相关 oidc-* 配置\n" +
            "2. 环境变量：ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET\n" +
            "   （STS 临时凭证可额外提供 ALIBABA_CLOUD_SECURITY_TOKEN）"
        );
    }

    private void validateOidcConfig(SmsProperties props) {
        if (!StringUtils.hasText(props.getOidcRoleArn())) {
            throw new IllegalStateException("OIDC 已启用但未配置 aliyun.sms.oidc-role-arn");
        }
        if (!StringUtils.hasText(props.getOidcProviderArn())) {
            throw new IllegalStateException("OIDC 已启用但未配置 aliyun.sms.oidc-provider-arn");
        }
    }
}
