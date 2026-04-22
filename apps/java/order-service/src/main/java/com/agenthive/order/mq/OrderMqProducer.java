package com.agenthive.order.mq;

import com.agenthive.order.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderMqProducer {

    private final RabbitTemplate rabbitTemplate;

    public void sendOrderCreated(String orderNo, Long userId, java.math.BigDecimal totalAmount, List<Map<String, Object>> items) {
        Map<String, Object> message = new HashMap<>();
        message.put("orderNo", orderNo);
        message.put("userId", userId);
        message.put("totalAmount", totalAmount);
        message.put("items", items);
        message.put("eventType", "order.created");
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_ORDER, RabbitConfig.ROUTING_ORDER_CREATED, message);
        log.info("Sent order.created: orderNo={}", orderNo);
    }

    public void sendOrderPaid(String orderNo, Long userId) {
        Map<String, Object> message = new HashMap<>();
        message.put("orderNo", orderNo);
        message.put("userId", userId);
        message.put("eventType", "order.paid");
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_ORDER, RabbitConfig.ROUTING_ORDER_PAID, message);
        log.info("Sent order.paid: orderNo={}", orderNo);
    }

    public void sendOrderCancelled(String orderNo, Long userId) {
        Map<String, Object> message = new HashMap<>();
        message.put("orderNo", orderNo);
        message.put("userId", userId);
        message.put("eventType", "order.cancelled");
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_ORDER, RabbitConfig.ROUTING_ORDER_CANCELLED, message);
        log.info("Sent order.cancelled: orderNo={}", orderNo);
    }
}
