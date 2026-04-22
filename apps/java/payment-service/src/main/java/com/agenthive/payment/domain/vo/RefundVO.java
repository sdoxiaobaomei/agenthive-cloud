package com.agenthive.payment.domain.vo;

import com.agenthive.payment.domain.enums.RefundStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class RefundVO {
    private String refundNo;
    private String paymentNo;
    private BigDecimal amount;
    private RefundStatus status;
    private String reason;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
