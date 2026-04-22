package com.agenthive.payment.mq;

import com.agenthive.payment.domain.entity.Payment;
import com.agenthive.payment.domain.enums.PaymentChannel;
import com.agenthive.payment.domain.enums.PaymentStatus;
import com.agenthive.payment.internal.common.SnowflakeIdGenerator;
import com.agenthive.payment.mapper.PaymentMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderCreatedListener {

    private final PaymentMapper paymentMapper;
    private final SnowflakeIdGenerator idGenerator;

    @RabbitListener(queues = "order.created.queue")
    public void onOrderCreated(Map<String, Object> message) {
        String orderNo = (String) message.get("orderNo");
        Long userId = ((Number) message.get("userId")).longValue();
        BigDecimal amount = new BigDecimal(message.get("totalAmount").toString());
        log.info("Received order.created: orderNo={}, userId={}", orderNo, userId);

        Payment payment = new Payment();
        payment.setPaymentNo("PAY" + idGenerator.nextIdStr());
        payment.setOrderNo(orderNo);
        payment.setUserId(userId);
        payment.setAmount(amount);
        payment.setChannel(PaymentChannel.BALANCE);
        payment.setStatus(PaymentStatus.PENDING);
        paymentMapper.insert(payment);
        log.info("Auto-created payment for order: {}", orderNo);
    }
}
