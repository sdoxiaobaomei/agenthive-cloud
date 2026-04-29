package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.CreditsTransaction;
import com.agenthive.payment.domain.entity.HostedWebsite;
import com.agenthive.payment.domain.entity.TrafficConversionConfig;
import com.agenthive.payment.domain.entity.TrafficRecord;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.mapper.HostedWebsiteMapper;
import com.agenthive.payment.mapper.TrafficConversionConfigMapper;
import com.agenthive.payment.mapper.TrafficRecordMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.TrafficSettlementService;
import com.agenthive.payment.service.dto.SettlementReport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrafficSettlementServiceImpl implements TrafficSettlementService {

    private final TrafficRecordMapper trafficRecordMapper;
    private final HostedWebsiteMapper hostedWebsiteMapper;
    private final TrafficConversionConfigMapper configMapper;
    private final CreditsAccountService creditsAccountService;
    private final CreditsTransactionMapper creditsTransactionMapper;
    private final TransactionTemplate transactionTemplate;

    private static final long DEFAULT_PV_THRESHOLD = 1000L;
    private static final long DEFAULT_UV_THRESHOLD = 100L;
    private static final BigDecimal DEFAULT_CREDITS_REWARD = BigDecimal.ONE;

    @Override
    public SettlementReport settleTrafficForDate(LocalDate date) {
        log.info("Starting traffic settlement for date={}", date);

        List<TrafficConversionConfig> activeConfigs = configMapper.selectActiveConfigs();
        TrafficConversionConfig pvConfig = resolveConfig(activeConfigs, "PV");
        TrafficConversionConfig uvConfig = resolveConfig(activeConfigs, "UV");

        List<TrafficRecord> records = trafficRecordMapper.selectList(
                new LambdaQueryWrapper<TrafficRecord>()
                        .eq(TrafficRecord::getDate, date));

        SettlementReport report = new SettlementReport();

        for (TrafficRecord record : records) {
            try {
                settleSingleRecord(record, pvConfig, uvConfig, date, report);
            } catch (Exception e) {
                log.error("Traffic settlement failed for websiteId={}, date={}",
                        record.getHostedWebsiteId(), date, e);
                report.incrementFailed();
            }
        }

        log.info("Traffic settlement completed: date={}, settled={}, failed={}, totalPv={}, totalUv={}, totalCredits={}",
                date, report.getSettledWebsites(), report.getFailedWebsites(),
                report.getTotalPv(), report.getTotalUv(), report.getTotalCredits());

        return report;
    }

    private void settleSingleRecord(TrafficRecord record, TrafficConversionConfig pvConfig,
                                    TrafficConversionConfig uvConfig, LocalDate date,
                                    SettlementReport report) {
        HostedWebsite website = hostedWebsiteMapper.selectById(record.getHostedWebsiteId());
        if (website == null) {
            log.warn("Website not found for traffic record: websiteId={}", record.getHostedWebsiteId());
            report.incrementFailed();
            return;
        }

        String sourceId = record.getHostedWebsiteId() + ":" + date;

        transactionTemplate.execute(status -> {
            // 幂等性检查：同一日期同一 website 不重复结算
            int existingTx = creditsTransactionMapper.countBySource(
                    website.getOwnerId(), "EARN_TRAFFIC", sourceId);
            if (existingTx > 0) {
                log.debug("Settlement already processed: websiteId={}, date={}",
                        record.getHostedWebsiteId(), date);
                return null;
            }

            BigDecimal pvCredits = calculateCredits(record.getPvCount(), pvConfig);
            BigDecimal uvCredits = calculateCredits(record.getUvCount(), uvConfig);
            BigDecimal totalCredits = pvCredits.add(uvCredits)
                    .setScale(4, RoundingMode.HALF_UP);

            if (totalCredits.compareTo(BigDecimal.ZERO) > 0) {
                creditsAccountService.credit(website.getOwnerId(), totalCredits,
                        CreditsTransactionType.EARN_TRAFFIC, "EARN_TRAFFIC", sourceId,
                        String.format("流量收益 %s PV=%d UV=%d", date,
                                record.getPvCount(), record.getUvCount()));

                // 更新网站累计收益
                website.setTrafficCreditsEarned(
                        website.getTrafficCreditsEarned().add(totalCredits));
                website.setLastPayoutAt(LocalDateTime.now());
                hostedWebsiteMapper.updateById(website);
            }

            // 更新流量记录（标记为已处理）
            record.setCreditsEarned(totalCredits);
            trafficRecordMapper.updateById(record);

            report.addSuccess(record.getPvCount(), record.getUvCount(), totalCredits);
            return null;
        });
    }

    private TrafficConversionConfig resolveConfig(List<TrafficConversionConfig> configs, String metricType) {
        return configs.stream()
                .filter(c -> metricType.equalsIgnoreCase(c.getMetricType()))
                .findFirst()
                .orElseGet(() -> createDefaultConfig(metricType));
    }

    private TrafficConversionConfig createDefaultConfig(String metricType) {
        TrafficConversionConfig config = new TrafficConversionConfig();
        config.setMetricType(metricType);
        config.setThreshold("PV".equalsIgnoreCase(metricType) ? DEFAULT_PV_THRESHOLD : DEFAULT_UV_THRESHOLD);
        config.setCreditsReward(DEFAULT_CREDITS_REWARD);
        config.setIsActive(true);
        return config;
    }

    private BigDecimal calculateCredits(long count, TrafficConversionConfig config) {
        if (config == null || config.getThreshold() == null || config.getThreshold() <= 0) {
            return BigDecimal.ZERO;
        }
        long units = count / config.getThreshold();
        return BigDecimal.valueOf(units).multiply(config.getCreditsReward());
    }
}
