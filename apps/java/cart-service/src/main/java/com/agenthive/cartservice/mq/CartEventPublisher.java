package com.agenthive.cartservice.mq;

import com.agenthive.cartservice.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class CartEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishCartUpdated(Long userId) {
        Map<String, Object> message = new HashMap<>();
        message.put("userId", userId);
        message.put("eventType", "CART_UPDATED");
        message.put("timestamp", System.currentTimeMillis());

        rabbitTemplate.convertAndSend(
                RabbitConfig.EXCHANGE_AGENTHIVE,
                RabbitConfig.ROUTING_KEY_CART_UPDATED,
                message
        );
        log.info("Published cart updated event for user {}", userId);
    }
}
