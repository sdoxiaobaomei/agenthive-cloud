package com.agenthive.common.rabbitmq.listener;

import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;

import java.io.IOException;

@Slf4j
public abstract class RabbitListenerBase<T> {

    protected abstract void process(T payload);

    @RabbitListener(queues = "#{@rabbitAdmin.getQueueProperties('dummy') != null ? 'dummy' : 'default'}")
    public void onMessage(Message message, Channel channel, T payload) throws IOException {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            process(payload);
            channel.basicAck(deliveryTag, false);
            log.debug("Message processed and acknowledged");
        } catch (Exception e) {
            log.error("Message processing failed", e);
            if (message.getMessageProperties().getRedelivered()) {
                channel.basicReject(deliveryTag, false);
                log.warn("Message rejected to dead letter queue");
            } else {
                channel.basicNack(deliveryTag, false, true);
            }
        }
    }
}
