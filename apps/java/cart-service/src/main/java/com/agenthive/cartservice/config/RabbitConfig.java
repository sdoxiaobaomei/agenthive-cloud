package com.agenthive.cartservice.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE_AGENTHIVE = "agenthive.event";
    public static final String QUEUE_CART_EVENTS = "cart.events";
    public static final String ROUTING_KEY_CART_UPDATED = "cart.updated";

    @Bean
    public DirectExchange agentHiveExchange() {
        return new DirectExchange(EXCHANGE_AGENTHIVE);
    }

    @Bean
    public Queue cartEventsQueue() {
        return QueueBuilder.durable(QUEUE_CART_EVENTS).build();
    }

    @Bean
    public Binding cartEventsBinding(Queue cartEventsQueue, DirectExchange agentHiveExchange) {
        return BindingBuilder.bind(cartEventsQueue).to(agentHiveExchange).with(ROUTING_KEY_CART_UPDATED);
    }
}
