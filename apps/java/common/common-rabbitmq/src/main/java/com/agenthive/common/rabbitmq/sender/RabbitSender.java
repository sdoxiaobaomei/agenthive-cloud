package com.agenthive.common.rabbitmq.sender;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RabbitSender {

    private final RabbitTemplate rabbitTemplate;

    @Retryable(
        retryFor = { Exception.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2)
    )
    public void send(String exchange, String routingKey, Object message) {
        log.info("Sending message to exchange={}, routingKey={}", exchange, routingKey);
        rabbitTemplate.convertAndSend(exchange, routingKey, message);
    }

    @Retryable(
        retryFor = { Exception.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2)
    )
    public void send(String exchange, String routingKey, Object message, String correlationId) {
        rabbitTemplate.convertAndSend(exchange, routingKey, message, msg -> {
            msg.getMessageProperties().setCorrelationId(correlationId);
            return msg;
        });
    }
}
