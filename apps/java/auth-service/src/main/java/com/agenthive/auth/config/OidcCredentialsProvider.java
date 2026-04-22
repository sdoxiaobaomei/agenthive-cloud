package com.agenthive.auth.config;

import com.aliyuncs.auth.AlibabaCloudCredentials;
import com.aliyuncs.auth.AlibabaCloudCredentialsProvider;
import com.aliyuncs.auth.BasicSessionCredentials;
import com.aliyuncs.exceptions.ClientException;
import com.aliyuncs.profile.DefaultProfile;
import com.aliyuncs.profile.IClientProfile;
import com.aliyuncs.sts.model.v20150401.AssumeRoleWithOIDCRequest;
import com.aliyuncs.sts.model.v20150401.AssumeRoleWithOIDCResponse;
import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
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
 * <p>实现 {@link AlibabaCloudCredentialsProvider} 接口，由 {@link com.aliyuncs.DefaultAcsClient}
 * 在每次发送请求前自动获取凭证，并在凭证即将过期时自动刷新。
 *
 * <p>核心流程（与 GitHub Actions OIDC → AssumeRoleWithWebIdentity → AWS STS 完全同构）：
 * <pre>
 *   1. 从文件系统读取 OIDC Token（K8s ServiceAccount JWT）
 *   2. 调用阿里云 STS AssumeRoleWithOIDC
 *   3. 获取 STS 临时凭证（AccessKeyId + AccessKeySecret + SecurityToken）
 *   4. 缓存凭证并在过期前自动刷新
 * </pre>
 */
@Slf4j
@RequiredArgsConstructor
public class OidcCredentialsProvider implements AlibabaCloudCredentialsProvider {

    private final SmsProperties smsProperties;

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private volatile BasicSessionCredentials cachedCredential;
    private volatile Instant expirationTime;

    @Override
    public AlibabaCloudCredentials getCredentials() throws ClientException {
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
            if (cachedCredential != null && !isAboutToExpire()) {
                return cachedCredential;
            }
            return refreshCredentials();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private BasicSessionCredentials refreshCredentials() throws ClientException {
        log.info("正在通过 OIDC 联邦身份刷新 STS 临时凭证...");

        String oidcToken = readOidcToken();
        if (!StringUtils.hasText(oidcToken)) {
            throw new ClientException("OIDC_TOKEN_EMPTY",
                    "OIDC Token 文件为空或不存在: " + smsProperties.getOidcTokenFilePath());
        }

        AssumeRoleWithOIDCRequest request = new AssumeRoleWithOIDCRequest();
        request.setOIDCProviderArn(smsProperties.getOidcProviderArn());
        request.setRoleArn(smsProperties.getOidcRoleArn());
        request.setOIDCToken(oidcToken);
        request.setRoleSessionName(smsProperties.getOidcRoleSessionName());
        request.setDurationSeconds(3600L);

        IClientProfile profile = DefaultProfile.getProfile(smsProperties.getRegionId());
        IAcsClient stsClient = new DefaultAcsClient(profile);

        AssumeRoleWithOIDCResponse response = stsClient.getAcsResponse(request);
        AssumeRoleWithOIDCResponse.Credentials creds = response.getCredentials();

        cachedCredential = new BasicSessionCredentials(
                creds.getAccessKeyId(),
                creds.getAccessKeySecret(),
                creds.getSecurityToken()
        );

        long bufferSeconds = smsProperties.getStsRefreshBeforeSeconds();
        expirationTime = Instant.parse(creds.getExpiration()).minusSeconds(bufferSeconds);

        log.info("STS 临时凭证刷新成功，AssumedRoleArn={}，过期时间={}，提前刷新阈值={}秒",
                response.getAssumedRoleUser().getArn(),
                creds.getExpiration(),
                bufferSeconds);

        return cachedCredential;
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
            return Files.readString(tokenPath).trim();
        } catch (IOException e) {
            log.error("读取 OIDC Token 文件失败: {}", tokenPath, e);
            return null;
        }
    }
}
