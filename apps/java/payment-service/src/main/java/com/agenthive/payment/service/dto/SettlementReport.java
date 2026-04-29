package com.agenthive.payment.service.dto;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class SettlementReport {

    private int settledWebsites = 0;
    private int failedWebsites = 0;
    private long totalPv = 0;
    private long totalUv = 0;
    private BigDecimal totalCredits = BigDecimal.ZERO;

    public void addSuccess(long pv, long uv, BigDecimal credits) {
        this.settledWebsites++;
        this.totalPv += pv;
        this.totalUv += uv;
        this.totalCredits = this.totalCredits.add(credits);
    }

    public void incrementFailed() {
        this.failedWebsites++;
    }
}
