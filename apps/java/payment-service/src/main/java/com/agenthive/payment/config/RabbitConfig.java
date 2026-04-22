package com.agenthive.payment.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE_PAYMENT = "payment.exchange";
    public static final String EXCHANGE_ORDER = "order.exchange";

    public static final String QUEUE_PAYMENT_CREATED = "payment.created.queue";
    public static final String QUEUE_PAYMENT_SUCCESS = "payment.success.queue";
    public static final String QUEUE_PAYMENT_REFUNDED = "payment.refunded.queue";
    public static final String QUEUE_ORDER_CREATED = "order.created.queue";

    public static final String ROUTING_PAYMENT_CREATED = "payment.created";
    public static final String ROUTING_PAYMENT_SUCCESS = "payment.success";
    public static final String ROUTING_PAYMENT_REFUNDED = "payment.refunded";
    public static final String ROUTING_ORDER_CREATED = "order.created";

    @Bean
    public DirectExchange paymentExchange() {
        return new DirectExchange(EXCHANGE_PAYMENT);
    }

    @Bean
    public DirectExchange orderExchange() {
        return new DirectExchange(EXCHANGE_ORDER);
    }

    @Bean
    public Queue paymentCreatedQueue() {
        return QueueBuilder.durable(QUEUE_PAYMENT_CREATED).build();
    }

    @Bean
    public Queue paymentSuccessQueue() {
        return QueueBuilder.durable(QUEUE_PAYMENT_SUCCESS).build();
    }

    @Bean
    public Queue paymentRefundedQueue() {
        return QueueBuilder.durable(QUEUE_PAYMENT_REFUNDED).build();
    }

    @Bean
    public Queue orderCreatedQueue() {
        return QueueBuilder.durable(QUEUE_ORDER_CREATED).build();
    }

    @Bean
    public Binding paymentCreatedBinding() {
        return BindingBuilder.bind(paymentCreatedQueue()).to(paymentExchange()).with(ROUTING_PAYMENT_CREATED);
    }

    @Bean
    public Binding paymentSuccessBinding() {
        return BindingBuilder.bind(paymentSuccessQueue()).to(paymentExchange()).with(ROUTING_PAYMENT_SUCCESS);
    }

    @Bean
    public Binding paymentRefundedBinding() {
        return BindingBuilder.bind(paymentRefundedQueue()).to(paymentExchange()).with(ROUTING_PAYMENT_REFUNDED);
    }

    @Bean
    public Binding orderCreatedBinding() {
        return BindingBuilder.bind(orderCreatedQueue()).to(orderExchange()).with(ROUTING_ORDER_CREATED);
    }
}
