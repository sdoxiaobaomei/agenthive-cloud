package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AgentUsageVO {

    private Long userId;

    private BigDecimal creditsRemaining;

    private BigDecimal creditsUsedThisMonth;

    private BigDecimal creditsUsedTotal;
}
