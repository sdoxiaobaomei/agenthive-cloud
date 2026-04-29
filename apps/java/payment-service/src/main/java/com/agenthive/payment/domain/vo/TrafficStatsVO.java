package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class TrafficStatsVO {

    private Long websiteId;

    private String date;

    private Long pvCount;

    private Long uvCount;

    private BigDecimal creditsEarned;
}
