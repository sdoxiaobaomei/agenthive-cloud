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
@TableName("t_withdrawal_record")
public class WithdrawalRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private BigDecimal amount;

    private BigDecimal feeRate;

    private BigDecimal feeAmount;

    private BigDecimal netAmount;

    private String channel;

    private String accountInfoEncrypted;

    private String status;

    private LocalDateTime appliedAt;

    private LocalDateTime approvedAt;

    private LocalDateTime completedAt;

    private String rejectReason;

    private Long adminId;

    private Long version;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
