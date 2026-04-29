package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.HostedWebsite;
import com.agenthive.payment.domain.entity.TrafficConversionConfig;
import com.agenthive.payment.domain.entity.TrafficRecord;
import com.agenthive.payment.domain.enums.CreditsTransactionType;
import com.agenthive.payment.mapper.CreditsTransactionMapper;
import com.agenthive.payment.mapper.HostedWebsiteMapper;
import com.agenthive.payment.mapper.TrafficConversionConfigMapper;
import com.agenthive.payment.mapper.TrafficRecordMapper;
import com.agenthive.payment.service.CreditsAccountService;
import com.agenthive.payment.service.dto.SettlementReport;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.quality.Strictness;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = Strictness.LENIENT)
class TrafficSettlementServiceImplTest {

    @Mock
    private TrafficRecordMapper trafficRecordMapper;

    @Mock
    private HostedWebsiteMapper hostedWebsiteMapper;

    @Mock
    private TrafficConversionConfigMapper configMapper;

    @Mock
    private CreditsAccountService creditsAccountService;

    @Mock
    private CreditsTransactionMapper creditsTransactionMapper;

    @Mock
    private TransactionTemplate transactionTemplate;

    @InjectMocks
    private TrafficSettlementServiceImpl trafficSettlementService;

    private LocalDate targetDate;
    private TrafficRecord record;
    private HostedWebsite website;
    private TrafficConversionConfig pvConfig;
    private TrafficConversionConfig uvConfig;

    @BeforeEach
    void setUp() {
        targetDate = LocalDate.of(2025, 1, 15);

        record = new TrafficRecord();
        record.setId(1L);
        record.setHostedWebsiteId(10L);
        record.setDate(targetDate);
        record.setPvCount(2500L);
        record.setUvCount(150L);
        record.setCreditsEarned(BigDecimal.ZERO);

        website = new HostedWebsite();
        website.setId(10L);
        website.setOwnerId(100L);
        website.setTrafficCreditsEarned(new BigDecimal("5.0000"));

        pvConfig = new TrafficConversionConfig();
        pvConfig.setMetricType("PV");
        pvConfig.setThreshold(1000L);
        pvConfig.setCreditsReward(BigDecimal.ONE);
        pvConfig.setIsActive(true);

        uvConfig = new TrafficConversionConfig();
        uvConfig.setMetricType("UV");
        uvConfig.setThreshold(100L);
        uvConfig.setCreditsReward(BigDecimal.ONE);
        uvConfig.setIsActive(true);

        // Setup transaction template to execute immediately (no-op wrapping)
        when(transactionTemplate.execute(any(org.springframework.transaction.support.TransactionCallback.class)))
                .thenAnswer(inv -> {
                    org.springframework.transaction.support.TransactionCallback<?> callback = inv.getArgument(0);
                    return callback.doInTransaction(null);
                });
    }

    @Test
    void settleTrafficForDate_success_calculatesAndCredits() {
        when(configMapper.selectActiveConfigs()).thenReturn(List.of(pvConfig, uvConfig));
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record));
        when(hostedWebsiteMapper.selectById(10L)).thenReturn(website);
        when(creditsTransactionMapper.countBySource(100L, "EARN_TRAFFIC", "10:" + targetDate)).thenReturn(0);
        doNothing().when(creditsAccountService).credit(any(), any(), any(), any(), any(), any());
        when(trafficRecordMapper.updateById(any(TrafficRecord.class))).thenReturn(1);
        when(hostedWebsiteMapper.updateById(any(HostedWebsite.class))).thenReturn(1);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        assertEquals(1, report.getSettledWebsites());
        assertEquals(0, report.getFailedWebsites());
        assertEquals(2500, report.getTotalPv());
        assertEquals(150, report.getTotalUv());
        // 2500/1000 = 2, 150/100 = 1, total = 3 credits
        assertEquals(new BigDecimal("3.0000"), report.getTotalCredits());

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(creditsAccountService).credit(eq(100L), amountCaptor.capture(),
                eq(CreditsTransactionType.EARN_TRAFFIC), eq("EARN_TRAFFIC"),
                eq("10:" + targetDate), anyString());
        assertEquals(new BigDecimal("3.0000"), amountCaptor.getValue());
    }

    @Test
    void settleTrafficForDate_duplicateTransaction_skipsIdempotently() {
        when(configMapper.selectActiveConfigs()).thenReturn(List.of(pvConfig, uvConfig));
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record));
        when(hostedWebsiteMapper.selectById(10L)).thenReturn(website);
        when(creditsTransactionMapper.countBySource(100L, "EARN_TRAFFIC", "10:" + targetDate)).thenReturn(1);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        assertEquals(0, report.getSettledWebsites());
        assertEquals(0, report.getFailedWebsites());
        verify(creditsAccountService, never()).credit(any(), any(), any(), any(), any(), any());
        verify(trafficRecordMapper, never()).updateById(any(TrafficRecord.class));
    }

    @Test
    void settleTrafficForDate_websiteNotFound_countsAsFailed() {
        when(configMapper.selectActiveConfigs()).thenReturn(List.of(pvConfig, uvConfig));
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record));
        when(hostedWebsiteMapper.selectById(10L)).thenReturn(null);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        assertEquals(0, report.getSettledWebsites());
        assertEquals(1, report.getFailedWebsites());
        verify(creditsAccountService, never()).credit(any(), any(), any(), any(), any(), any());
    }

    @Test
    void settleTrafficForDate_zeroCredits_stillUpdatesRecord() {
        record.setPvCount(500L);
        record.setUvCount(50L);

        when(configMapper.selectActiveConfigs()).thenReturn(List.of(pvConfig, uvConfig));
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record));
        when(hostedWebsiteMapper.selectById(10L)).thenReturn(website);
        when(creditsTransactionMapper.countBySource(100L, "EARN_TRAFFIC", "10:" + targetDate)).thenReturn(0);
        when(trafficRecordMapper.updateById(any(TrafficRecord.class))).thenReturn(1);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        assertEquals(1, report.getSettledWebsites());
        assertEquals(0, report.getTotalCredits().compareTo(BigDecimal.ZERO));
        verify(creditsAccountService, never()).credit(any(), any(), any(), any(), any(), any());
        verify(trafficRecordMapper).updateById(any(TrafficRecord.class));
    }

    @Test
    void settleTrafficForDate_noConfig_usesDefaults() {
        when(configMapper.selectActiveConfigs()).thenReturn(List.of());
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record));
        when(hostedWebsiteMapper.selectById(10L)).thenReturn(website);
        when(creditsTransactionMapper.countBySource(100L, "EARN_TRAFFIC", "10:" + targetDate)).thenReturn(0);
        doNothing().when(creditsAccountService).credit(any(), any(), any(), any(), any(), any());
        when(trafficRecordMapper.updateById(any(TrafficRecord.class))).thenReturn(1);
        when(hostedWebsiteMapper.updateById(any(HostedWebsite.class))).thenReturn(1);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        // Default: 1000 PV = 1 credit, 100 UV = 1 credit
        // 2500/1000 = 2, 150/100 = 1 -> 3 credits
        assertEquals(new BigDecimal("3.0000"), report.getTotalCredits());
    }

    @Test
    void settleTrafficForDate_creditServiceThrows_exceptionIsolated() {
        TrafficRecord record2 = new TrafficRecord();
        record2.setId(2L);
        record2.setHostedWebsiteId(20L);
        record2.setDate(targetDate);
        record2.setPvCount(1000L);
        record2.setUvCount(100L);
        record2.setCreditsEarned(BigDecimal.ZERO);

        HostedWebsite website2 = new HostedWebsite();
        website2.setId(20L);
        website2.setOwnerId(200L);
        website2.setTrafficCreditsEarned(BigDecimal.ZERO);

        when(configMapper.selectActiveConfigs()).thenReturn(List.of(pvConfig, uvConfig));
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record, record2));

        // First record throws
        when(hostedWebsiteMapper.selectById(10L)).thenReturn(website);
        when(creditsTransactionMapper.countBySource(100L, "EARN_TRAFFIC", "10:" + targetDate)).thenReturn(0);
        doThrow(new RuntimeException("credit service error"))
                .when(creditsAccountService).credit(eq(100L), any(), any(), any(), eq("10:" + targetDate), any());

        // Second record succeeds
        when(hostedWebsiteMapper.selectById(20L)).thenReturn(website2);
        when(creditsTransactionMapper.countBySource(200L, "EARN_TRAFFIC", "20:" + targetDate)).thenReturn(0);
        doNothing().when(creditsAccountService).credit(eq(200L), any(), any(), any(), eq("20:" + targetDate), any());
        when(trafficRecordMapper.updateById(any(TrafficRecord.class))).thenReturn(1);
        when(hostedWebsiteMapper.updateById(any(HostedWebsite.class))).thenReturn(1);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        assertEquals(1, report.getSettledWebsites());
        assertEquals(1, report.getFailedWebsites());
    }

    @Test
    void settleTrafficForDate_multipleRecords_aggregatesCorrectly() {
        TrafficRecord record2 = new TrafficRecord();
        record2.setId(2L);
        record2.setHostedWebsiteId(20L);
        record2.setDate(targetDate);
        record2.setPvCount(3000L);
        record2.setUvCount(200L);
        record2.setCreditsEarned(BigDecimal.ZERO);

        HostedWebsite website2 = new HostedWebsite();
        website2.setId(20L);
        website2.setOwnerId(200L);
        website2.setTrafficCreditsEarned(BigDecimal.ZERO);

        when(configMapper.selectActiveConfigs()).thenReturn(List.of(pvConfig, uvConfig));
        when(trafficRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record, record2));

        when(hostedWebsiteMapper.selectById(10L)).thenReturn(website);
        when(creditsTransactionMapper.countBySource(100L, "EARN_TRAFFIC", "10:" + targetDate)).thenReturn(0);

        when(hostedWebsiteMapper.selectById(20L)).thenReturn(website2);
        when(creditsTransactionMapper.countBySource(200L, "EARN_TRAFFIC", "20:" + targetDate)).thenReturn(0);

        doNothing().when(creditsAccountService).credit(any(), any(), any(), any(), any(), any());
        when(trafficRecordMapper.updateById(any(TrafficRecord.class))).thenReturn(1);
        when(hostedWebsiteMapper.updateById(any(HostedWebsite.class))).thenReturn(1);

        SettlementReport report = trafficSettlementService.settleTrafficForDate(targetDate);

        assertEquals(2, report.getSettledWebsites());
        assertEquals(5500, report.getTotalPv()); // 2500 + 3000
        assertEquals(350, report.getTotalUv());  // 150 + 200
        // record1: 2 + 1 = 3; record2: 3 + 2 = 5; total = 8
        assertEquals(new BigDecimal("8.0000"), report.getTotalCredits());
    }
}
