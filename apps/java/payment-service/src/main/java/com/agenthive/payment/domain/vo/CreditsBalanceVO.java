package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class CreditsBalanceVO {
    private Long userId;
    private BigDecimal balance;
    private BigDecimal frozenBalance;
    private BigDecimal totalEarned;
    private BigDecimal totalSpent;
    private BigDecimal totalWithdrawn;
    private LocalDateTime updatedAt;
}
