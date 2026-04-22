package com.agenthive.payment.domain.vo;

import com.agenthive.payment.domain.enums.PaymentChannel;
import com.agenthive.payment.domain.enums.PaymentStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class PaymentVO {
    private String paymentNo;
    private String orderNo;
    private Long userId;
    private BigDecimal amount;
    private PaymentChannel channel;
    private PaymentStatus status;
    private String thirdPartyNo;
    private String payUrl;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
