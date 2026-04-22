package com.agenthive.auth.config;

import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.auth.AlibabaCloudCredentials;
import com.aliyuncs.auth.BasicSessionCredentials;
import com.aliyuncs.exceptions.ClientException;
import com.aliyuncs.profile.DefaultProfile;
import com.aliyuncs.sts.model.v20150401.AssumeRoleWithOIDCRequest;
import com.aliyuncs.sts.model.v20150401.AssumeRoleWithOIDCResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * OIDC 联邦身份凭证提供者。
 *
 * <p>核心流程（与 GitHub Actions → AWS STS 完全一致）：
 * <pre>
 *   1. 从文件系统读取 OIDC Token（K8s ServiceAccount JWT）
 *   2. 调用阿里云 STS AssumeRoleWithOIDC
 *   3. 获取 STS 临时凭证（AccessKeyId + AccessKeySecret + SecurityToken）
 *   4. 缓存凭证并在过期前自动刷新
 * </pre>
 *
 * <p>参考阿里云文档：
 * <a href="https://help.aliyun.com/document_detail/100125.html">使用 OIDC 联邦身份访问阿里云</a>
 */
@Slf4j
@RequiredArgsConstructor
public class OidcCredentialsProvider {

    private final SmsProperties smsProperties;

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private volatile BasicSessionCredentials cachedCredential;
    private volatile Instant expirationTime;

    /**
     * 获取当前有效的 STS 凭证，必要时自动刷新。
     */
    public AlibabaCloudCredentials getCredential() {
        lock.readLock().lock();
        try {
            if (cachedCredential != null && !isAboutToExpire()) {
                return cachedCredential;
            }
        } finally {
            lock.readLock().unlock();
        }

        lock.writeLock().lock();
        try {
            // 双重检查
            if (cachedCredential != null && !isAboutToExpire()) {
                return cachedCredential;
            }
            return refreshCredential();
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * 强制刷新 STS 凭证。
     */
    public AlibabaCloudCredentials refreshCredential() {
        log.info("正在通过 OIDC 联邦身份刷新 STS 临时凭证...");

        String oidcToken = readOidcToken();
        if (!StringUtils.hasText(oidcToken)) {
            throw new IllegalStateException("OIDC Token 文件为空或不存在: " + smsProperties.getOidcTokenFilePath());
        }

        AssumeRoleWithOIDCRequest request = new AssumeRoleWithOIDCRequest();
        request.setOIDCProviderArn(smsProperties.getOidcProviderArn());
        request.setRoleArn(smsProperties.getOidcRoleArn());
        request.setOIDCToken(oidcToken);
        request.setRoleSessionName(smsProperties.getOidcRoleSessionName());
        request.setDurationSeconds(3600L); // 1 小时

        // 使用独立的 STS 客户端（无需长期 AccessKey）
        DefaultProfile profile = DefaultProfile.getProfile(smsProperties.getRegionId());
        IAcsClient stsClient = new DefaultAcsClient(profile);

        try {
            AssumeRoleWithOIDCResponse response = stsClient.getAcsResponse(request);
            AssumeRoleWithOIDCResponse.Credentials creds = response.getCredentials();

            cachedCredential = new BasicSessionCredentials(
                    creds.getAccessKeyId(),
                    creds.getAccessKeySecret(),
                    creds.getSecurityToken()
            );

            // 计算过期时间（减去提前刷新缓冲）
            long bufferSeconds = smsProperties.getStsRefreshBeforeSeconds();
            expirationTime = Instant.parse(creds.getExpiration()).minusSeconds(bufferSeconds);

            log.info("STS 临时凭证刷新成功，RoleSessionName={}，过期时间={}，提前刷新阈值={}秒",
                    response.getAssumedRoleUser().getArn(),
                    creds.getExpiration(),
                    bufferSeconds);

            return cachedCredential;

        } catch (ClientException e) {
            log.error("AssumeRoleWithOIDC 失败: errCode={}, errMsg={}", e.getErrCode(), e.getErrMsg(), e);
            throw new IllegalStateException("通过 OIDC 获取 STS 凭证失败: " + e.getErrMsg(), e);
        }
    }

    private boolean isAboutToExpire() {
        if (expirationTime == null) {
            return true;
        }
        return Instant.now().isAfter(expirationTime);
    }

    private String readOidcToken() {
        Path tokenPath = Path.of(smsProperties.getOidcTokenFilePath());
        if (!Files.exists(tokenPath)) {
            log.error("OIDC Token 文件不存在: {}", tokenPath);
            return null;
        }
        try {
            // 去掉首尾空白和换行
            return Files.readString(tokenPath).trim();
        } catch (IOException e) {
            log.error("读取 OIDC Token 文件失败: {}", tokenPath, e);
            return null;
        }
    }
}
