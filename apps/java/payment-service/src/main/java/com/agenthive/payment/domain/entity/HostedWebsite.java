package com.agenthive.payment.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@TableName("t_hosted_website")
public class HostedWebsite {

    @TableId(type = IdType.AUTO)
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
