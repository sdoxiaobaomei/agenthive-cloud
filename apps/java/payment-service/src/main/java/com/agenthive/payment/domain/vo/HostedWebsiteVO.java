package com.agenthive.payment.domain.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class HostedWebsiteVO {

    private Long id;
    private Long projectId;
    private Long ownerId;
    private String subdomain;
    private String customDomain;
    private String status;
    private Long trafficCount;
    private BigDecimal trafficCreditsEarned;
    private LocalDateTime lastPayoutAt;
    private String deployConfig;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
