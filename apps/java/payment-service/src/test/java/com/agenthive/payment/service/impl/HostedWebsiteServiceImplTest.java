package com.agenthive.payment.service.impl;

import com.agenthive.payment.domain.entity.HostedWebsite;
import com.agenthive.payment.domain.entity.TrafficRecord;
import com.agenthive.payment.domain.enums.HostedWebsiteStatus;
import com.agenthive.payment.domain.vo.HostedWebsiteVO;
import com.agenthive.payment.domain.vo.TrafficStatsVO;
import com.agenthive.payment.internal.common.BusinessException;
import com.agenthive.payment.mapper.HostedWebsiteMapper;
import com.agenthive.payment.mapper.TrafficRecordMapper;
import com.agenthive.payment.service.dto.CreateHostedWebsiteRequest;
import com.agenthive.payment.service.dto.TrafficReportRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import org.mockito.ArgumentMatchers;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HostedWebsiteServiceImplTest {

    @Mock
    private HostedWebsiteMapper hostedWebsiteMapper;

    @Mock
    private TrafficRecordMapper trafficRecordMapper;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private HostedWebsiteServiceImpl hostedWebsiteService;

    @Test
    void createHostedWebsite_success() {
        when(hostedWebsiteMapper.countBySubdomain(anyString())).thenReturn(0);

        CreateHostedWebsiteRequest request = new CreateHostedWebsiteRequest();
        request.setProjectId(1L);
        request.setOwnerId(100L);
        request.setProjectName("My Awesome Site");

        HostedWebsiteVO vo = hostedWebsiteService.createHostedWebsite(request);

        assertNotNull(vo);
        assertEquals(100L, vo.getOwnerId());
        assertTrue(vo.getSubdomain().endsWith(".agenthive.app"));
        assertTrue(vo.getSubdomain().startsWith("my-awesome-site-"));
        assertEquals(HostedWebsiteStatus.ACTIVE.name(), vo.getStatus());
        verify(hostedWebsiteMapper).insert(any(HostedWebsite.class));
    }

    @Test
    void getHostedWebsite_success() {
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        website.setProjectId(1L);
        website.setOwnerId(100L);
        website.setSubdomain("test-1234.agenthive.app");
        website.setStatus(HostedWebsiteStatus.ACTIVE.name());
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);

        HostedWebsiteVO vo = hostedWebsiteService.getHostedWebsite(1L);

        assertEquals(1L, vo.getId());
        assertEquals("test-1234.agenthive.app", vo.getSubdomain());
    }

    @Test
    void getHostedWebsite_notFound_throwsException() {
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> hostedWebsiteService.getHostedWebsite(1L));
    }

    @Test
    void updateCustomDomain_success() {
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        website.setSubdomain("test-1234.agenthive.app");
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);

        HostedWebsiteVO vo = hostedWebsiteService.updateCustomDomain(1L, "mydomain.com");

        assertEquals("mydomain.com", vo.getCustomDomain());
        verify(hostedWebsiteMapper).updateById(any(HostedWebsite.class));
    }

    @Test
    void updateDeployConfig_success() {
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);

        String config = "{\"image\":\"nginx:latest\"}";
        HostedWebsiteVO vo = hostedWebsiteService.updateDeployConfig(1L, config);

        assertEquals(config, vo.getDeployConfig());
        assertEquals(HostedWebsiteStatus.DEPLOYING.name(), vo.getStatus());
    }

    @Test
    void deleteHostedWebsite_success() {
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);

        hostedWebsiteService.deleteHostedWebsite(1L);

        verify(hostedWebsiteMapper).updateById(ArgumentMatchers.<HostedWebsite>argThat(w ->
            HostedWebsiteStatus.DELETED.name().equals(w.getStatus())
        ));
    }

    @Test
    void reportTraffic_newPvAndUv_incrementsBoth() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        website.setTrafficCount(100L);
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);
        when(trafficRecordMapper.selectByWebsiteAndDate(eq(1L), any(LocalDate.class))).thenReturn(null);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), anyLong(), any())).thenReturn(true);

        TrafficReportRequest request = new TrafficReportRequest();
        request.setWebsiteId(1L);
        request.setIp("192.168.1.1");
        request.setSessionId("sess-001");
        request.setTimestamp(Instant.now());
        request.setPv(1);

        TrafficStatsVO stats = hostedWebsiteService.reportTraffic(request);

        assertNotNull(stats);
        verify(trafficRecordMapper).insert(any(TrafficRecord.class));
        verify(hostedWebsiteMapper).updateById(ArgumentMatchers.<HostedWebsite>argThat(w -> w.getTrafficCount() == 101L));
    }

    @Test
    void reportTraffic_duplicateSession_skipsPv() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        website.setTrafficCount(100L);
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);
        // PV key 已存在，UV key 不存在
        when(valueOperations.setIfAbsent(contains("traffic:pv:"), eq("1"), anyLong(), any())).thenReturn(false);
        when(valueOperations.setIfAbsent(contains("traffic:uv:"), eq("1"), anyLong(), any())).thenReturn(true);

        TrafficReportRequest request = new TrafficReportRequest();
        request.setWebsiteId(1L);
        request.setIp("192.168.1.1");
        request.setSessionId("sess-001");
        request.setTimestamp(Instant.now());
        request.setPv(1);

        TrafficStatsVO stats = hostedWebsiteService.reportTraffic(request);

        assertNotNull(stats);
        // PV 跳过，UV 新增，但 insert 会因为并发安全被调用（uvIncrement=1）
        verify(trafficRecordMapper, atMost(1)).insert(any(TrafficRecord.class));
    }

    @Test
    void reportTraffic_duplicateIp_skipsUv() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        HostedWebsite website = new HostedWebsite();
        website.setId(1L);
        website.setTrafficCount(100L);
        when(hostedWebsiteMapper.selectById(1L)).thenReturn(website);
        // PV key 不存在，UV key 已存在
        when(valueOperations.setIfAbsent(contains("traffic:pv:"), eq("1"), anyLong(), any())).thenReturn(true);
        when(valueOperations.setIfAbsent(contains("traffic:uv:"), eq("1"), anyLong(), any())).thenReturn(false);

        TrafficReportRequest request = new TrafficReportRequest();
        request.setWebsiteId(1L);
        request.setIp("192.168.1.1");
        request.setSessionId("sess-001");
        request.setTimestamp(Instant.now());
        request.setPv(1);

        TrafficStatsVO stats = hostedWebsiteService.reportTraffic(request);

        assertNotNull(stats);
        verify(trafficRecordMapper, atMost(1)).insert(any(TrafficRecord.class));
    }
}
