package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class WithdrawalVO {

    private Long id;
    private Long userId;
    private BigDecimal amount;
    private BigDecimal feeRate;
    private BigDecimal feeAmount;
    private BigDecimal netAmount;
    private String channel;
    private String status;
    private LocalDateTime appliedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime completedAt;
    private String rejectReason;
    private Long adminId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
