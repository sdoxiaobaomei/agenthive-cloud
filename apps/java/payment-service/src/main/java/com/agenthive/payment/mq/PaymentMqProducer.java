package com.agenthive.payment.mq;

import com.agenthive.payment.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentMqProducer {

    private final RabbitTemplate rabbitTemplate;

    public void sendPaymentCreated(String paymentNo, String orderNo, Long userId, String channel) {
        Map<String, Object> message = new HashMap<>();
        message.put("paymentNo", paymentNo);
        message.put("orderNo", orderNo);
        message.put("userId", userId);
        message.put("channel", channel);
        message.put("eventType", "payment.created");
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_PAYMENT, RabbitConfig.ROUTING_PAYMENT_CREATED, message);
        log.info("Sent payment.created: paymentNo={}", paymentNo);
    }

    public void sendPaymentSuccess(String paymentNo, String orderNo, Long userId) {
        Map<String, Object> message = new HashMap<>();
        message.put("paymentNo", paymentNo);
        message.put("orderNo", orderNo);
        message.put("userId", userId);
        message.put("eventType", "payment.success");
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_PAYMENT, RabbitConfig.ROUTING_PAYMENT_SUCCESS, message);
        log.info("Sent payment.success: paymentNo={}", paymentNo);
    }

    public void sendPaymentRefunded(String paymentNo, String refundNo, Long userId) {
        Map<String, Object> message = new HashMap<>();
        message.put("paymentNo", paymentNo);
        message.put("refundNo", refundNo);
        message.put("userId", userId);
        message.put("eventType", "payment.refunded");
        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_PAYMENT, RabbitConfig.ROUTING_PAYMENT_REFUNDED, message);
        log.info("Sent payment.refunded: paymentNo={}", paymentNo);
    }
}
