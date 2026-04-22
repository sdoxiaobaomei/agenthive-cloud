package com.agenthive.logisticsservice.service.impl;

import com.agenthive.logisticsservice.domain.dto.CreateLogisticsRequest;
import com.agenthive.logisticsservice.domain.entity.Logistics;
import com.agenthive.logisticsservice.domain.entity.LogisticsTrack;
import com.agenthive.logisticsservice.domain.enums.CarrierType;
import com.agenthive.logisticsservice.domain.enums.LogisticsStatus;
import com.agenthive.logisticsservice.domain.vo.LogisticsVO;
import com.agenthive.logisticsservice.domain.vo.TrackVO;
import com.agenthive.logisticsservice.internal.common.BaseException;
import com.agenthive.logisticsservice.internal.common.SnowflakeIdWorker;
import com.agenthive.logisticsservice.mapper.LogisticsMapper;
import com.agenthive.logisticsservice.mapper.LogisticsTrackMapper;
import com.agenthive.logisticsservice.mq.LogisticsEventPublisher;
import com.agenthive.logisticsservice.service.LogisticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogisticsServiceImpl implements LogisticsService {

    private final LogisticsMapper logisticsMapper;
    private final LogisticsTrackMapper logisticsTrackMapper;
    private final LogisticsEventPublisher eventPublisher;
    private final SnowflakeIdWorker snowflakeIdWorker = new SnowflakeIdWorker(1, 1);

    @Override
    @Transactional
    public LogisticsVO createLogistics(CreateLogisticsRequest request) {
        String trackingNo = generateTrackingNo(request.getCarrier());

        Logistics logistics = new Logistics();
        logistics.setOrderNo(request.getOrderNo());
        logistics.setTrackingNo(trackingNo);
        logistics.setCarrier(request.getCarrier());
        logistics.setStatus(LogisticsStatus.PENDING);
        logistics.setSenderInfo(request.getSenderInfo());
        logistics.setReceiverInfo(request.getReceiverInfo());
        logistics.setCreatedAt(LocalDateTime.now());

        logisticsMapper.insert(logistics);

        eventPublisher.publishLogisticsCreated(logistics);
        log.info("Created logistics record for order {}, trackingNo: {}", request.getOrderNo(), trackingNo);
        return toVO(logistics);
    }

    @Override
    public LogisticsVO getByOrderNo(String orderNo) {
        Logistics logistics = logisticsMapper.selectByOrderNo(orderNo);
        if (logistics == null) {
            throw new BaseException(404, "Logistics not found for order: " + orderNo);
        }
        return toVO(logistics);
    }

    @Override
    public List<TrackVO> getTracks(String trackingNo) {
        List<LogisticsTrack> tracks = logisticsTrackMapper.selectByTrackingNo(trackingNo);
        return tracks.stream().map(this::toTrackVO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void ship(String trackingNo) {
        Logistics logistics = logisticsMapper.selectByTrackingNo(trackingNo);
        if (logistics == null) {
            throw new BaseException(404, "Logistics not found");
        }
        if (logistics.getStatus() != LogisticsStatus.PENDING) {
            throw new BaseException(400, "Only PENDING logistics can be shipped");
        }

        logistics.setStatus(LogisticsStatus.SHIPPED);
        logistics.setShippedAt(LocalDateTime.now());
        logisticsMapper.updateById(logistics);

        // Record track event
        addTrack(trackingNo, "已发货", null);

        // Generate mock track events for demo
        generateMockTrackEvents(trackingNo);

        eventPublisher.publishLogisticsShipped(logistics);
        log.info("Shipped logistics: {}", trackingNo);
    }

    @Override
    @Transactional
    public void deliver(String trackingNo) {
        Logistics logistics = logisticsMapper.selectByTrackingNo(trackingNo);
        if (logistics == null) {
            throw new BaseException(404, "Logistics not found");
        }
        if (logistics.getStatus() != LogisticsStatus.SHIPPED && logistics.getStatus() != LogisticsStatus.IN_TRANSIT) {
            throw new BaseException(400, "Only SHIPPED or IN_TRANSIT logistics can be delivered");
        }

        logistics.setStatus(LogisticsStatus.DELIVERED);
        logistics.setDeliveredAt(LocalDateTime.now());
        logisticsMapper.updateById(logistics);

        addTrack(trackingNo, "已签收", null);

        eventPublisher.publishLogisticsDelivered(logistics);
        log.info("Delivered logistics: {}", trackingNo);
    }

    @Override
    @Transactional
    public LogisticsVO autoCreateForOrder(String orderNo) {
        Logistics existing = logisticsMapper.selectByOrderNo(orderNo);
        if (existing != null) {
            log.warn("Logistics already exists for order: {}", orderNo);
            return toVO(existing);
        }

        String trackingNo = generateTrackingNo(CarrierType.SF);
        Logistics logistics = new Logistics();
        logistics.setOrderNo(orderNo);
        logistics.setTrackingNo(trackingNo);
        logistics.setCarrier(CarrierType.SF);
        logistics.setStatus(LogisticsStatus.PENDING);
        logistics.setCreatedAt(LocalDateTime.now());

        logisticsMapper.insert(logistics);
        eventPublisher.publishLogisticsCreated(logistics);
        log.info("Auto-created logistics for order {}, trackingNo: {}", orderNo, trackingNo);
        return toVO(logistics);
    }

    private String generateTrackingNo(CarrierType carrier) {
        String prefix = switch (carrier) {
            case SF -> "SF";
            case YTO -> "YT";
            case ZTO -> "ZT";
            case JD -> "JD";
        };
        return prefix + snowflakeIdWorker.nextId();
    }

    private void addTrack(String trackingNo, String eventDesc, String location) {
        LogisticsTrack track = new LogisticsTrack();
        track.setTrackingNo(trackingNo);
        track.setEventTime(LocalDateTime.now());
        track.setEventDesc(eventDesc);
        track.setLocation(location);
        logisticsTrackMapper.insert(track);
    }

    private void generateMockTrackEvents(String trackingNo) {
        List<String[]> mockEvents = new ArrayList<>();
        mockEvents.add(new String[]{"[上海] 包裹已揽收", "上海"});
        mockEvents.add(new String[]{"[上海转运中心] 包裹到达", "上海转运中心"});
        mockEvents.add(new String[]{"[上海转运中心] 包裹发出", "上海转运中心"});
        mockEvents.add(new String[]{"[北京转运中心] 包裹到达", "北京转运中心"});
        mockEvents.add(new String[]{"[北京] 快递员正在派送", "北京"});
        mockEvents.add(new String[]{"[北京] 已签收", "北京"});

        // Insert all mock events with slightly different timestamps
        LocalDateTime baseTime = LocalDateTime.now().minusMinutes(5);
        for (int i = 0; i < mockEvents.size(); i++) {
            LogisticsTrack track = new LogisticsTrack();
            track.setTrackingNo(trackingNo);
            track.setEventTime(baseTime.plusMinutes(i));
            track.setEventDesc(mockEvents.get(i)[0]);
            track.setLocation(mockEvents.get(i)[1]);
            logisticsTrackMapper.insert(track);
        }
    }

    private LogisticsVO toVO(Logistics entity) {
        if (entity == null) return null;
        LogisticsVO vo = new LogisticsVO();
        vo.setId(entity.getId());
        vo.setOrderNo(entity.getOrderNo());
        vo.setTrackingNo(entity.getTrackingNo());
        vo.setCarrier(entity.getCarrier());
        vo.setStatus(entity.getStatus());
        vo.setSenderInfo(entity.getSenderInfo());
        vo.setReceiverInfo(entity.getReceiverInfo());
        vo.setCreatedAt(entity.getCreatedAt());
        vo.setShippedAt(entity.getShippedAt());
        vo.setDeliveredAt(entity.getDeliveredAt());
        return vo;
    }

    private TrackVO toTrackVO(LogisticsTrack entity) {
        if (entity == null) return null;
        TrackVO vo = new TrackVO();
        vo.setId(entity.getId());
        vo.setTrackingNo(entity.getTrackingNo());
        vo.setEventTime(entity.getEventTime());
        vo.setEventDesc(entity.getEventDesc());
        vo.setLocation(entity.getLocation());
        return vo;
    }
}
