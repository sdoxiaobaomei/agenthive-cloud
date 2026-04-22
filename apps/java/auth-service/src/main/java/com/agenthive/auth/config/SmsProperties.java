package com.agenthive.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 阿里云短信配置。
 * <p>
 * <b>安全说明</b>：强烈建议<b>不要</b>在 application.yml 中直接填写长期 AccessKey。
 * 生产环境请优先使用以下方式之一：
 * <ul>
 *   <li>环境变量：ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET</li>
 *   <li>K8s OIDC + RAM Role：ACK 集群中为 Pod 绑定 RAM Role，自动注入临时 STS Token</li>
 *   <li>ECS/ACK 实例 RAM 角色：SDK 自动从实例元数据服务端获取临时凭证</li>
 * </ul>
 */
@Data
@ConfigurationProperties(prefix = "aliyun.sms")
public class SmsProperties {

    /**
     * 阿里云地域 ID，默认杭州。
     */
    private String regionId = "cn-hangzhou";

    /**
     * 默认短信签名。
     */
    private String defaultSignName = "云渚科技验证平台";

    /**
     * 验证码有效时长（分钟）。
     */
    private int codeExpireMinutes = 5;

    /**
     * 同一手机号每日发送上限。
     */
    private int dailyLimit = 10;

    /**
     * 同一手机号发送间隔（秒）。
     */
    private int intervalSeconds = 60;

    /**
     * 是否启用 SMS 功能。
     */
    private boolean enabled = true;
}
