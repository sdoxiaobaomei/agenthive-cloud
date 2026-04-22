package com.agenthive.order.mq;

import com.agenthive.order.domain.entity.Order;
import com.agenthive.order.domain.enums.OrderStatus;
import com.agenthive.order.internal.common.BusinessException;
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
public class PaymentSuccessListener {

    private final OrderMapper orderMapper;
    private final OrderMqProducer orderMqProducer;

    @RabbitListener(queues = "payment.success.queue")
    @Transactional(rollbackFor = Exception.class)
    public void onPaymentSuccess(Map<String, Object> message) {
        String orderNo = (String) message.get("orderNo");
        Long userId = ((Number) message.get("userId")).longValue();
        log.info("Received payment.success: orderNo={}, userId={}", orderNo, userId);

        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            log.warn("Order not found: {}", orderNo);
            return;
        }
        if (order.getStatus() != OrderStatus.CREATED) {
            log.warn("Order status is not CREATED: {}", orderNo);
            return;
        }
        order.setStatus(OrderStatus.PAID);
        order.setPayStatus("PAID");
        order.setPaidAt(LocalDateTime.now());
        orderMapper.updateById(order);
        orderMqProducer.sendOrderPaid(orderNo, userId);
    }
}
