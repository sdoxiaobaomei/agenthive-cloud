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
@TableName("t_agent_quota_config")
public class AgentQuotaConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String workerRole;

    private String pricingType;

    private BigDecimal unitPrice;

    private BigDecimal tokenPrice;

    private String currency;

    private Boolean isActive;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
