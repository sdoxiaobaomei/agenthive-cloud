package com.agenthive.payment.domain.entity;

import com.agenthive.payment.domain.enums.RefundStatus;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_refund")
public class Refund {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String refundNo;
    private String paymentNo;
    private BigDecimal amount;
    private RefundStatus status;
    private String reason;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
