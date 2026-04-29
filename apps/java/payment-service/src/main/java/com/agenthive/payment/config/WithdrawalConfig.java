package com.agenthive.payment.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

@Getter
@Configuration
public class WithdrawalConfig {

    @Value("${withdrawal.fee.rate:0.10}")
    private BigDecimal feeRate;

    @Value("${withdrawal.min.amount:100}")
    private BigDecimal minAmount;

    @Value("${withdrawal.max.daily.count:3}")
    private int maxDailyCount;

    @Value("${withdrawal.max.daily.amount:10000}")
    private BigDecimal maxDailyAmount;

    @Value("${withdrawal.auto.approve.threshold:5000}")
    private BigDecimal autoApproveThreshold;

    @PostConstruct
    public void validate() {
        if (feeRate.compareTo(BigDecimal.ZERO) < 0 || feeRate.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalStateException("[CONFIG] withdrawal.fee.rate must be between 0 and 1");
        }
        if (minAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("[CONFIG] withdrawal.min.amount must be > 0");
        }
        if (maxDailyCount <= 0) {
            throw new IllegalStateException("[CONFIG] withdrawal.max.daily.count must be > 0");
        }
        if (maxDailyAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("[CONFIG] withdrawal.max.daily.amount must be > 0");
        }
        if (autoApproveThreshold.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("[CONFIG] withdrawal.auto.approve.threshold must be > 0");
        }
    }
}
