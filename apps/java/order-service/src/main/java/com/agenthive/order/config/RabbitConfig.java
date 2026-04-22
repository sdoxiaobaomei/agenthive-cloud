package com.agenthive.order.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE_ORDER = "order.exchange";
    public static final String EXCHANGE_PAYMENT = "payment.exchange";
    public static final String EXCHANGE_LOGISTICS = "logistics.exchange";

    public static final String QUEUE_ORDER_CREATED = "order.created.queue";
    public static final String QUEUE_ORDER_PAID = "order.paid.queue";
    public static final String QUEUE_ORDER_CANCELLED = "order.cancelled.queue";
    public static final String QUEUE_PAYMENT_SUCCESS = "payment.success.queue";
    public static final String QUEUE_LOGISTICS_SHIPPED = "logistics.shipped.queue";
    public static final String QUEUE_LOGISTICS_DELIVERED = "logistics.delivered.queue";

    public static final String ROUTING_ORDER_CREATED = "order.created";
    public static final String ROUTING_ORDER_PAID = "order.paid";
    public static final String ROUTING_ORDER_CANCELLED = "order.cancelled";
    public static final String ROUTING_PAYMENT_SUCCESS = "payment.success";
    public static final String ROUTING_LOGISTICS_SHIPPED = "logistics.shipped";
    public static final String ROUTING_LOGISTICS_DELIVERED = "logistics.delivered";

    @Bean
    public DirectExchange orderExchange() {
        return new DirectExchange(EXCHANGE_ORDER);
    }

    @Bean
    public DirectExchange paymentExchange() {
        return new DirectExchange(EXCHANGE_PAYMENT);
    }

    @Bean
    public DirectExchange logisticsExchange() {
        return new DirectExchange(EXCHANGE_LOGISTICS);
    }

    @Bean
    public Queue orderCreatedQueue() {
        return QueueBuilder.durable(QUEUE_ORDER_CREATED).build();
    }

    @Bean
    public Queue orderPaidQueue() {
        return QueueBuilder.durable(QUEUE_ORDER_PAID).build();
    }

    @Bean
    public Queue orderCancelledQueue() {
        return QueueBuilder.durable(QUEUE_ORDER_CANCELLED).build();
    }

    @Bean
    public Queue paymentSuccessQueue() {
        return QueueBuilder.durable(QUEUE_PAYMENT_SUCCESS).build();
    }

    @Bean
    public Queue logisticsShippedQueue() {
        return QueueBuilder.durable(QUEUE_LOGISTICS_SHIPPED).build();
    }

    @Bean
    public Queue logisticsDeliveredQueue() {
        return QueueBuilder.durable(QUEUE_LOGISTICS_DELIVERED).build();
    }

    @Bean
    public Binding orderCreatedBinding() {
        return BindingBuilder.bind(orderCreatedQueue()).to(orderExchange()).with(ROUTING_ORDER_CREATED);
    }

    @Bean
    public Binding orderPaidBinding() {
        return BindingBuilder.bind(orderPaidQueue()).to(orderExchange()).with(ROUTING_ORDER_PAID);
    }

    @Bean
    public Binding orderCancelledBinding() {
        return BindingBuilder.bind(orderCancelledQueue()).to(orderExchange()).with(ROUTING_ORDER_CANCELLED);
    }

    @Bean
    public Binding paymentSuccessBinding() {
        return BindingBuilder.bind(paymentSuccessQueue()).to(paymentExchange()).with(ROUTING_PAYMENT_SUCCESS);
    }

    @Bean
    public Binding logisticsShippedBinding() {
        return BindingBuilder.bind(logisticsShippedQueue()).to(logisticsExchange()).with(ROUTING_LOGISTICS_SHIPPED);
    }

    @Bean
    public Binding logisticsDeliveredBinding() {
        return BindingBuilder.bind(logisticsDeliveredQueue()).to(logisticsExchange()).with(ROUTING_LOGISTICS_DELIVERED);
    }
}
