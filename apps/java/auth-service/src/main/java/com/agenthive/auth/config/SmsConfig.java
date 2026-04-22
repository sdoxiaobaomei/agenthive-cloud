package com.agenthive.auth.config;

import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.auth.Credential;
import com.aliyuncs.auth.StsCredential;
import com.aliyuncs.profile.DefaultProfile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * 阿里云 SMS Client 配置。
 *
 * <p><b>安全设计原则</b>：本配置<b>不</b>从 application.yml 读取任何长期 AccessKey，
 * 仅支持从以下安全来源获取凭证（按优先级）：
 *
 * <ol>
 *   <li><b>环境变量</b>（推荐生产环境）：
 *       ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET / ALIBABA_CLOUD_SECURITY_TOKEN</li>
 *   <li><b>系统属性</b>：alibaba.cloud.access-key-id / access-key-secret / security-token</li>
 *   <li><b>阿里云 CLI 配置文件</b>：~/.aliyun/config.json（本地开发时可用）</li>
 * </ol>
 *
 * <p><b>K8s ACK OIDC 方案（无需任何 AccessKey）</b>：
 * <pre>
 *   1. 在 ACK 集群中为 Pod 的 ServiceAccount 绑定 RAM OIDC 身份提供商
 *   2. 配置 RAM Role 的信任策略，允许该 ServiceAccount 扮演角色
 *   3. ACK 会自动将 STS 临时凭证注入 Pod 环境变量
 *   4. 本配置自动读取环境变量，无需任何代码改动
 * </pre>
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(SmsProperties.class)
public class SmsConfig {

    private static final String ENV_ACCESS_KEY_ID = "ALIBABA_CLOUD_ACCESS_KEY_ID";
    private static final String ENV_ACCESS_KEY_SECRET = "ALIBABA_CLOUD_ACCESS_KEY_SECRET";
    private static final String ENV_SECURITY_TOKEN = "ALIBABA_CLOUD_SECURITY_TOKEN";
    private static final String SYS_ACCESS_KEY_ID = "alibaba.cloud.access-key-id";
    private static final String SYS_ACCESS_KEY_SECRET = "alibaba.cloud.access-key-secret";
    private static final String SYS_SECURITY_TOKEN = "alibaba.cloud.security-token";

    @Bean
    public IAcsClient acsClient(SmsProperties smsProperties) {
        String regionId = smsProperties.getRegionId();

        Credential credential = resolveCredential();
        if (credential == null) {
            throw new IllegalStateException(
                "阿里云 SMS 凭证未找到。请通过以下方式之一提供（按优先级）：\n" +
                "1. 环境变量：ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET / ALIBABA_CLOUD_SECURITY_TOKEN\n" +
                "2. 系统属性：alibaba.cloud.access-key-id / access-key-secret / security-token\n" +
                "3. 生产环境建议使用 ACK OIDC + RAM Role，实现无 AccessKey 调用。"
            );
        }

        DefaultProfile profile = DefaultProfile.getProfile(regionId);
        DefaultAcsClient client = new DefaultAcsClient(profile, credential);

        boolean isSts = StringUtils.hasText(credential.getSecurityToken());
        log.info("阿里云 SMS Client 初始化完成，region={}，凭证类型={}",
                regionId, isSts ? "STS临时凭证" : "长期AccessKey");

        if (!isSts) {
            log.warn("当前使用的是长期 AccessKey，存在泄露风险。" +
                    "生产环境强烈建议使用 ACK OIDC + RAM Role 获取 STS 临时凭证。");
        }

        return client;
    }

    /**
     * 按优先级解析凭证来源。
     */
    private Credential resolveCredential() {
        // 1. 环境变量（最高优先级，K8s OIDC 注入也走这里）
        String akId = System.getenv(ENV_ACCESS_KEY_ID);
        String akSecret = System.getenv(ENV_ACCESS_KEY_SECRET);
        if (StringUtils.hasText(akId) && StringUtils.hasText(akSecret)) {
            String token = System.getenv(ENV_SECURITY_TOKEN);
            return buildCredential(akId, akSecret, token, "环境变量");
        }

        // 2. 系统属性
        akId = System.getProperty(SYS_ACCESS_KEY_ID);
        akSecret = System.getProperty(SYS_ACCESS_KEY_SECRET);
        if (StringUtils.hasText(akId) && StringUtils.hasText(akSecret)) {
            String token = System.getProperty(SYS_SECURITY_TOKEN);
            return buildCredential(akId, akSecret, token, "系统属性");
        }

        // 3. 阿里云 CLI 配置文件（本地开发兜底）
        Credential cliCredential = resolveFromAliyunCliConfig();
        if (cliCredential != null) {
            return cliCredential;
        }

        return null;
    }

    private Credential buildCredential(String akId, String akSecret, String token, String source) {
        if (StringUtils.hasText(token)) {
            log.info("从 [{}] 读取到 STS 临时凭证（含 SecurityToken）", source);
            return new StsCredential(akId, akSecret, token);
        } else {
            log.info("从 [{}] 读取到 AccessKey", source);
            return new Credential(akId, akSecret);
        }
    }

    /**
     * 尝试从阿里云 CLI 配置文件 ~/.aliyun/config.json 读取当前默认凭证。
     * 仅用于本地开发兜底，生产环境不推荐。
     */
    private Credential resolveFromAliyunCliConfig() {
        try {
            String userHome = System.getProperty("user.home");
            java.nio.file.Path configPath = java.nio.file.Path.of(userHome, ".aliyun", "config.json");
            if (!java.nio.file.Files.exists(configPath)) {
                return null;
            }

            String content = java.nio.file.Files.readString(configPath);
            com.alibaba.fastjson2.JSONObject json = com.alibaba.fastjson2.JSON.parseObject(content);
            com.alibaba.fastjson2.JSONObject current = json.getJSONObject("current");
            if (current == null) {
                return null;
            }
            String akId = current.getString("access_key_id");
            String akSecret = current.getString("access_key_secret");
            if (StringUtils.hasText(akId) && StringUtils.hasText(akSecret)) {
                return buildCredential(akId, akSecret, null, "阿里云CLI配置");
            }
        } catch (Exception e) {
            log.debug("读取阿里云 CLI 配置失败: {}", e.getMessage());
        }
        return null;
    }
}
