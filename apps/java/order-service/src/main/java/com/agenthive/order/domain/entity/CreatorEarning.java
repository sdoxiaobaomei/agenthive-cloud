package com.agenthive.order.domain.entity;

import com.agenthive.common.mybatis.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_creator_earning")
public class CreatorEarning extends BaseEntity {

    private Long creatorId;
    private Long productId;
    private String productName;
    private Long buyerId;
    private Integer creditsAmount;
    private BigDecimal fiatAmount;
    private BigDecimal platformFee;
    private BigDecimal netEarning;
    private LocalDateTime settledAt;
}
