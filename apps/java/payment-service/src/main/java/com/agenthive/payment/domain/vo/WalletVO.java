package com.agenthive.payment.domain.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class WalletVO {
    private Long userId;
    private BigDecimal balance;
    private BigDecimal frozenBalance;
    private LocalDateTime updatedAt;
}
