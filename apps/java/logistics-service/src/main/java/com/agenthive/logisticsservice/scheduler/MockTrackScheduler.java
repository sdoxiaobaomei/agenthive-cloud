package com.agenthive.logisticsservice.scheduler;

import com.agenthive.logisticsservice.domain.entity.Logistics;
import com.agenthive.logisticsservice.domain.entity.LogisticsTrack;
import com.agenthive.logisticsservice.domain.enums.LogisticsStatus;
import com.agenthive.logisticsservice.mapper.LogisticsMapper;
import com.agenthive.logisticsservice.mapper.LogisticsTrackMapper;
import com.agenthive.logisticsservice.mq.LogisticsEventPublisher;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MockTrackScheduler {

    private final LogisticsMapper logisticsMapper;
    private final LogisticsTrackMapper logisticsTrackMapper;
    private final LogisticsEventPublisher eventPublisher;

    @Scheduled(fixedDelay = 30000)
    public void simulateTrackProgress() {
        LocalDateTime now = LocalDateTime.now();

        // SHIPPED -> IN_TRANSIT after 1 minute
        LambdaQueryWrapper<Logistics> shippedQuery = new LambdaQueryWrapper<>();
        shippedQuery.eq(Logistics::getStatus, LogisticsStatus.SHIPPED);
        List<Logistics> shippedList = logisticsMapper.selectList(shippedQuery);

        for (Logistics logistics : shippedList) {
            if (logistics.getShippedAt() != null
                    && logistics.getShippedAt().plusMinutes(1).isBefore(now)) {
                logistics.setStatus(LogisticsStatus.IN_TRANSIT);
                logisticsMapper.updateById(logistics);

                addTrack(logistics.getTrackingNo(), "运输中", "全国");
                log.info("Auto-updated logistics {} to IN_TRANSIT", logistics.getTrackingNo());
            }
        }

        // IN_TRANSIT -> DELIVERED after 2 minutes from shipped
        LambdaQueryWrapper<Logistics> transitQuery = new LambdaQueryWrapper<>();
        transitQuery.eq(Logistics::getStatus, LogisticsStatus.IN_TRANSIT);
        List<Logistics> transitList = logisticsMapper.selectList(transitQuery);

        for (Logistics logistics : transitList) {
            if (logistics.getShippedAt() != null
                    && logistics.getShippedAt().plusMinutes(2).isBefore(now)) {
                logistics.setStatus(LogisticsStatus.DELIVERED);
                logistics.setDeliveredAt(now);
                logisticsMapper.updateById(logistics);

                addTrack(logistics.getTrackingNo(), "已签收", null);
                eventPublisher.publishLogisticsDelivered(logistics);
                log.info("Auto-updated logistics {} to DELIVERED", logistics.getTrackingNo());
            }
        }
    }

    private void addTrack(String trackingNo, String eventDesc, String location) {
        LogisticsTrack track = new LogisticsTrack();
        track.setTrackingNo(trackingNo);
        track.setEventTime(LocalDateTime.now());
        track.setEventDesc(eventDesc);
        track.setLocation(location);
        logisticsTrackMapper.insert(track);
    }
}
