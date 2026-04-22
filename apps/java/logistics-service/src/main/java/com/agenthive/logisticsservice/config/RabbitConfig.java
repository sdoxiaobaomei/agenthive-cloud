package com.agenthive.logisticsservice.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE_AGENTHIVE = "agenthive.event";

    // Queues for publishing
    public static final String ROUTING_KEY_LOGISTICS_CREATED = "logistics.created";
    public static final String ROUTING_KEY_LOGISTICS_SHIPPED = "logistics.shipped";
    public static final String ROUTING_KEY_LOGISTICS_DELIVERED = "logistics.delivered";

    // Queues for consuming
    public static final String QUEUE_ORDER_PAID = "order.paid.logistics";
    public static final String ROUTING_KEY_ORDER_PAID = "order.paid";

    @Bean
    public DirectExchange agentHiveExchange() {
        return new DirectExchange(EXCHANGE_AGENTHIVE);
    }

    @Bean
    public Queue orderPaidQueue() {
        return QueueBuilder.durable(QUEUE_ORDER_PAID).build();
    }

    @Bean
    public Binding orderPaidBinding(Queue orderPaidQueue, DirectExchange agentHiveExchange) {
        return BindingBuilder.bind(orderPaidQueue).to(agentHiveExchange).with(ROUTING_KEY_ORDER_PAID);
    }
}
