package com.agenthive.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 阿里云短信配置。
 *
 * <p><b>安全优先</b>：生产环境强烈建议使用 OIDC + RAM Role 方式，
 * 实现零长期 AccessKey 调用阿里云 SMS API。
 *
 * <p>凭证获取优先级（高到低）：
 * <ol>
 *   <li>OIDC + RAM Role（K8s 推荐）：读取 Pod 挂载的 OIDC Token → AssumeRoleWithOIDC → STS 临时凭证</li>
 *   <li>环境变量 STS 临时凭证：ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET / SECURITY_TOKEN</li>
 *   <li>环境变量长期 AccessKey：ALIBABA_CLOUD_ACCESS_KEY_ID / SECRET（仅本地开发）</li>
 * </ol>
 */
@Data
@ConfigurationProperties(prefix = "aliyun.sms")
public class SmsProperties {

    /** 阿里云地域 ID */
    private String regionId = "cn-hangzhou";

    /** 默认短信签名 */
    private String defaultSignName = "云渚科技验证平台";

    /** 验证码有效时长（分钟） */
    private int codeExpireMinutes = 5;

    /** 同一手机号每日发送上限 */
    private int dailyLimit = 10;

    /** 同一手机号发送间隔（秒） */
    private int intervalSeconds = 60;

    /** 是否启用 SMS */
    private boolean enabled = true;

    // ========== 短信模板 CODE 配置（从阿里云控制台获取） ==========
    /** 登录/注册模板 TemplateCode */
    private String templateCodeLoginRegister = "100001";
    /** 修改绑定手机号模板 TemplateCode */
    private String templateCodeModifyPhone = "100002";
    /** 重置密码模板 TemplateCode */
    private String templateCodeResetPassword = "100003";
    /** 绑定新手机号模板 TemplateCode */
    private String templateCodeBindPhone = "100004";
    /** 验证绑定手机号模板 TemplateCode */
    private String templateCodeVerifyPhone = "100005";

    // ========== OIDC 联邦身份配置（K8s 生产环境推荐） ==========

    /**
     * 是否启用 OIDC 联邦身份认证。
     * 启用后，优先通过 OIDC Token 获取 STS 临时凭证。
     */
    private boolean oidcEnabled = false;

    /** RAM Role ARN，如：acs:ram::1234567890123456:role/sms-role */
    private String oidcRoleArn;

    /** OIDC Provider ARN，如：acs:ram::1234567890123456:oidc-provider/ack-oidc */
    private String oidcProviderArn;

    /**
     * OIDC Token 文件路径。
     * K8s 中通常挂载在 /var/run/secrets/tokens/aliyun-token
     */
    private String oidcTokenFilePath = "/var/run/secrets/tokens/aliyun-token";

    /**
     * OIDC Role Session 名称，用于审计。
     */
    private String oidcRoleSessionName = "auth-service-sms";

    /**
     * STS 凭证提前刷新的时间（秒），默认 5 分钟。
     * 避免在边界时刻因凭证过期导致调用失败。
     */
    private int stsRefreshBeforeSeconds = 300;
}
