package com.agenthive.logisticsservice.mq;

import com.agenthive.logisticsservice.service.LogisticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderPaidListener {

    private final LogisticsService logisticsService;

    @RabbitListener(queues = "order.paid.logistics")
    public void onOrderPaid(Map<String, Object> message) {
        String orderNo = (String) message.get("orderNo");
        if (orderNo == null) {
            log.warn("Received order.paid message without orderNo");
            return;
        }
        log.info("Received order.paid event for order: {}", orderNo);
        logisticsService.autoCreateForOrder(orderNo);
    }
}
