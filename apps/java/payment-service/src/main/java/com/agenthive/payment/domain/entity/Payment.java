package com.agenthive.payment.domain.entity;

import com.agenthive.payment.domain.enums.PaymentChannel;
import com.agenthive.payment.domain.enums.PaymentStatus;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("t_payment")
public class Payment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String paymentNo;
    private String orderNo;
    private Long userId;
    private BigDecimal amount;
    private PaymentChannel channel;
    private PaymentStatus status;
    private String thirdPartyNo;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
