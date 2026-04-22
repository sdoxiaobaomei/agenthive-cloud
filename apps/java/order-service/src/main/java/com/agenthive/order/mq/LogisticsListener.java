package com.agenthive.order.mq;

import com.agenthive.order.domain.entity.Order;
import com.agenthive.order.domain.enums.OrderStatus;
import com.agenthive.order.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LogisticsListener {

    private final OrderMapper orderMapper;

    @RabbitListener(queues = "logistics.shipped.queue")
    @Transactional(rollbackFor = Exception.class)
    public void onLogisticsShipped(Map<String, Object> message) {
        String orderNo = (String) message.get("orderNo");
        log.info("Received logistics.shipped: orderNo={}", orderNo);
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null || order.getStatus() != OrderStatus.PAID) {
            log.warn("Cannot ship order: {}", orderNo);
            return;
        }
        order.setStatus(OrderStatus.SHIPPED);
        order.setLogisticsStatus("SHIPPED");
        order.setShippedAt(LocalDateTime.now());
        orderMapper.updateById(order);
    }

    @RabbitListener(queues = "logistics.delivered.queue")
    @Transactional(rollbackFor = Exception.class)
    public void onLogisticsDelivered(Map<String, Object> message) {
        String orderNo = (String) message.get("orderNo");
        log.info("Received logistics.delivered: orderNo={}", orderNo);
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null || order.getStatus() != OrderStatus.SHIPPED) {
            log.warn("Cannot deliver order: {}", orderNo);
            return;
        }
        order.setStatus(OrderStatus.DELIVERED);
        order.setLogisticsStatus("DELIVERED");
        order.setDeliveredAt(LocalDateTime.now());
        orderMapper.updateById(order);
    }
}
