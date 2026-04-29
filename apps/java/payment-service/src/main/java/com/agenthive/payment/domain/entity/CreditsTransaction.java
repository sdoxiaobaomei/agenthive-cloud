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
@TableName("t_credits_transaction")
public class CreditsTransaction {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String type;

    private BigDecimal amount;

    private BigDecimal balanceAfter;

    private String sourceType;

    private String sourceId;

    private String description;

    private LocalDateTime createdAt;
}
