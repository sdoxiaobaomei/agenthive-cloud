package com.agenthive.order.domain.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreatorEarningVO {

    private Long id;
    private Long creatorId;
    private Long productId;
    private String productName;
    private Long buyerId;
    private Integer creditsAmount;
    private BigDecimal fiatAmount;
    private BigDecimal platformFee;
    private BigDecimal netEarning;
    private LocalDateTime settledAt;
    private LocalDateTime createdAt;
}
