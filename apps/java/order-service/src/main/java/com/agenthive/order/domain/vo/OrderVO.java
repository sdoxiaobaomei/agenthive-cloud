package com.agenthive.order.domain.vo;

import com.agenthive.order.domain.enums.OrderStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderVO {
    private String orderNo;
    private Long userId;
    private BigDecimal totalAmount;
    private OrderStatus status;
    private String payStatus;
    private String logisticsStatus;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
    private LocalDateTime shippedAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime completedAt;
    private List<OrderItemVO> items;
}
