package com.agenthive.payment.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@TableName("t_credits_account")
public class CreditsAccount {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private BigDecimal balance;

    private BigDecimal frozenBalance;

    private BigDecimal totalEarned;

    private BigDecimal totalSpent;

    private BigDecimal totalWithdrawn;

    @Version
    private Long version;

    private LocalDateTime updatedAt;
}
