package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.HostedWebsite;
import com.agenthive.payment.domain.entity.TrafficRecord;
import com.agenthive.payment.domain.enums.HostedWebsiteStatus;
import com.agenthive.payment.domain.vo.HostedWebsiteVO;
import com.agenthive.payment.domain.vo.TrafficStatsVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.HostedWebsiteMapper;
import com.agenthive.payment.mapper.TrafficRecordMapper;
import com.agenthive.payment.service.HostedWebsiteService;
import com.agenthive.payment.service.dto.CreateHostedWebsiteRequest;
import com.agenthive.payment.service.dto.TrafficReportRequest;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class HostedWebsiteServiceImpl implements HostedWebsiteService {

    private final HostedWebsiteMapper hostedWebsiteMapper;
    private final TrafficRecordMapper trafficRecordMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String DOMAIN_SUFFIX = ".agenthive.app";
    private static final String UV_KEY_PREFIX = "traffic:uv:";
    private static final String PV_KEY_PREFIX = "traffic:pv:";
    private static final long UV_EXPIRE_HOURS = 1;
    private static final long PV_EXPIRE_MINUTES = 10;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HostedWebsiteVO createHostedWebsite(CreateHostedWebsiteRequest request) {
        String slug = toSlug(request.getProjectName());
        String subdomain = generateUniqueSubdomain(slug);

        HostedWebsite website = new HostedWebsite();
        website.setProjectId(request.getProjectId());
        website.setOwnerId(request.getOwnerId());
        website.setSubdomain(subdomain);
        website.setStatus(HostedWebsiteStatus.ACTIVE.name());
        website.setTrafficCount(0L);
        website.setTrafficCreditsEarned(BigDecimal.ZERO);
        website.setCreatedAt(LocalDateTime.now());
        website.setUpdatedAt(LocalDateTime.now());
        hostedWebsiteMapper.insert(website);

        log.info("Hosted website created: id={}, subdomain={}, ownerId={}",
                website.getId(), subdomain, request.getOwnerId());
        return toVO(website);
    }

    @Override
    @Transactional(readOnly = true)
    public HostedWebsiteVO getHostedWebsite(Long id) {
        HostedWebsite website = hostedWebsiteMapper.selectById(id);
        if (website == null) {
            throw new BusinessException("托管网站不存在");
        }
        return toVO(website);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HostedWebsiteVO updateCustomDomain(Long id, String customDomain) {
        HostedWebsite website = hostedWebsiteMapper.selectById(id);
        if (website == null) {
            throw new BusinessException("托管网站不存在");
        }
        website.setCustomDomain(customDomain);
        website.setUpdatedAt(LocalDateTime.now());
        hostedWebsiteMapper.updateById(website);
        return toVO(website);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public HostedWebsiteVO updateDeployConfig(Long id, String deployConfig) {
        HostedWebsite website = hostedWebsiteMapper.selectById(id);
        if (website == null) {
            throw new BusinessException("托管网站不存在");
        }
        website.setDeployConfig(deployConfig);
        website.setStatus(HostedWebsiteStatus.DEPLOYING.name());
        website.setUpdatedAt(LocalDateTime.now());
        hostedWebsiteMapper.updateById(website);
        return toVO(website);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteHostedWebsite(Long id) {
        HostedWebsite website = hostedWebsiteMapper.selectById(id);
        if (website == null) {
            throw new BusinessException("托管网站不存在");
        }
        website.setStatus(HostedWebsiteStatus.DELETED.name());
        website.setUpdatedAt(LocalDateTime.now());
        hostedWebsiteMapper.updateById(website);
        log.info("Hosted website deleted: id={}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TrafficStatsVO reportTraffic(TrafficReportRequest request) {
        Long websiteId = request.getWebsiteId();
        LocalDate date = Instant.ofEpochMilli(request.getTimestamp().toEpochMilli())
                .atZone(ZoneId.systemDefault()).toLocalDate();
        String dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE);

        // PV 防刷：同一 session 10 分钟内只计 1 次
        String pvKey = PV_KEY_PREFIX + websiteId + ":" + request.getSessionId();
        Boolean pvNew = redisTemplate.opsForValue().setIfAbsent(pvKey, "1", PV_EXPIRE_MINUTES, TimeUnit.MINUTES);
        int pvIncrement = (pvNew != null && pvNew) ? request.getPv() : 0;

        // UV 防刷：同一 IP 1 小时内只计 1 次
        String uvKey = UV_KEY_PREFIX + websiteId + ":" + dateStr + ":" + request.getIp();
        Boolean uvNew = redisTemplate.opsForValue().setIfAbsent(uvKey, "1", UV_EXPIRE_HOURS, TimeUnit.HOURS);
        int uvIncrement = (uvNew != null && uvNew) ? 1 : 0;

        if (pvIncrement > 0 || uvIncrement > 0) {
            // 使用数据库原生 upsert（原子操作）
            upsertTrafficRecord(websiteId, date, pvIncrement, uvIncrement);

            // 更新网站总流量计数
            HostedWebsite website = hostedWebsiteMapper.selectById(websiteId);
            if (website != null) {
                website.setTrafficCount((website.getTrafficCount() == null ? 0L : website.getTrafficCount()) + pvIncrement);
                hostedWebsiteMapper.updateById(website);
            }
        }

        // 查询当日累计
        TrafficRecord record = trafficRecordMapper.selectByWebsiteAndDate(websiteId, date);
        TrafficStatsVO stats = new TrafficStatsVO();
        stats.setWebsiteId(websiteId);
        stats.setDate(dateStr);
        stats.setPvCount(record != null ? record.getPvCount() : 0L);
        stats.setUvCount(record != null ? record.getUvCount() : 0L);
        stats.setCreditsEarned(record != null ? record.getCreditsEarned() : BigDecimal.ZERO);
        return stats;
    }

    private void upsertTrafficRecord(Long websiteId, LocalDate date, long pv, long uv) {
        // 先尝试查询，不存在则插入，存在则更新
        TrafficRecord existing = trafficRecordMapper.selectByWebsiteAndDate(websiteId, date);
        if (existing == null) {
            TrafficRecord record = new TrafficRecord();
            record.setHostedWebsiteId(websiteId);
            record.setDate(date);
            record.setPvCount((long) pv);
            record.setUvCount((long) uv);
            record.setCreditsEarned(BigDecimal.ZERO);
            record.setVersion(0L);
            record.setCreatedAt(LocalDateTime.now());
            record.setUpdatedAt(LocalDateTime.now());
            try {
                trafficRecordMapper.insert(record);
            } catch (Exception e) {
                // 并发插入冲突，重试更新
                existing = trafficRecordMapper.selectByWebsiteAndDate(websiteId, date);
                if (existing != null) {
                    updateTrafficRecord(existing, pv, uv);
                }
            }
        } else {
            updateTrafficRecord(existing, pv, uv);
        }
    }

    private void updateTrafficRecord(TrafficRecord record, long pv, long uv) {
        record.setPvCount(record.getPvCount() + pv);
        record.setUvCount(record.getUvCount() + uv);
        record.setUpdatedAt(LocalDateTime.now());
        trafficRecordMapper.updateById(record);
    }

    private String toSlug(String projectName) {
        if (projectName == null || projectName.isBlank()) {
            return "site";
        }
        return projectName.toLowerCase()
                .replaceAll("[^a-z0-9]", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private String generateUniqueSubdomain(String slug) {
        for (int attempt = 0; attempt < 10; attempt++) {
            String random = randomAlphanum(4);
            String subdomain = slug + "-" + random + DOMAIN_SUFFIX;
            if (hostedWebsiteMapper.countBySubdomain(subdomain) == 0) {
                return subdomain;
            }
        }
        // 兜底：添加时间戳
        return slug + "-" + System.currentTimeMillis() + DOMAIN_SUFFIX;
    }

    private String randomAlphanum(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHANUM.charAt(RANDOM.nextInt(ALPHANUM.length())));
        }
        return sb.toString();
    }

    private HostedWebsiteVO toVO(HostedWebsite website) {
        HostedWebsiteVO vo = new HostedWebsiteVO();
        vo.setId(website.getId());
        vo.setProjectId(website.getProjectId());
        vo.setOwnerId(website.getOwnerId());
        vo.setSubdomain(website.getSubdomain());
        vo.setCustomDomain(website.getCustomDomain());
        vo.setStatus(website.getStatus());
        vo.setTrafficCount(website.getTrafficCount());
        vo.setTrafficCreditsEarned(website.getTrafficCreditsEarned());
        vo.setLastPayoutAt(website.getLastPayoutAt());
        vo.setDeployConfig(website.getDeployConfig());
        vo.setCreatedAt(website.getCreatedAt());
        vo.setUpdatedAt(website.getUpdatedAt());
        return vo;
    }
}
