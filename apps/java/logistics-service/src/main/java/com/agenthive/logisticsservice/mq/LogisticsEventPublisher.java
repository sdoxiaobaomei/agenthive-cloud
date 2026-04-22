package com.agenthive.logisticsservice.mq;

import com.agenthive.logisticsservice.config.RabbitConfig;
import com.agenthive.logisticsservice.domain.entity.Logistics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LogisticsEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishLogisticsCreated(Logistics logistics) {
        Map<String, Object> message = buildMessage(logistics, "LOGISTICS_CREATED");
        rabbitTemplate.convertAndSend(
                RabbitConfig.EXCHANGE_AGENTHIVE,
                RabbitConfig.ROUTING_KEY_LOGISTICS_CREATED,
                message
        );
        log.info("Published logistics created event: {}", logistics.getTrackingNo());
    }

    public void publishLogisticsShipped(Logistics logistics) {
        Map<String, Object> message = buildMessage(logistics, "LOGISTICS_SHIPPED");
        rabbitTemplate.convertAndSend(
                RabbitConfig.EXCHANGE_AGENTHIVE,
                RabbitConfig.ROUTING_KEY_LOGISTICS_SHIPPED,
                message
        );
        log.info("Published logistics shipped event: {}", logistics.getTrackingNo());
    }

    public void publishLogisticsDelivered(Logistics logistics) {
        Map<String, Object> message = buildMessage(logistics, "LOGISTICS_DELIVERED");
        rabbitTemplate.convertAndSend(
                RabbitConfig.EXCHANGE_AGENTHIVE,
                RabbitConfig.ROUTING_KEY_LOGISTICS_DELIVERED,
                message
        );
        log.info("Published logistics delivered event: {}", logistics.getTrackingNo());
    }

    private Map<String, Object> buildMessage(Logistics logistics, String eventType) {
        Map<String, Object> message = new HashMap<>();
        message.put("orderNo", logistics.getOrderNo());
        message.put("trackingNo", logistics.getTrackingNo());
        message.put("carrier", logistics.getCarrier() != null ? logistics.getCarrier().name() : null);
        message.put("status", logistics.getStatus() != null ? logistics.getStatus().name() : null);
        message.put("eventType", eventType);
        message.put("timestamp", System.currentTimeMillis());
        return message;
    }
}
