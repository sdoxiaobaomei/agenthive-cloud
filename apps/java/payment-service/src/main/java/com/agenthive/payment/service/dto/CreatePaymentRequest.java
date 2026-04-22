package com.agenthive.payment.service.dto;

import com.agenthive.payment.domain.enums.PaymentChannel;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreatePaymentRequest {
    @NotBlank(message = "订单号不能为空")
    private String orderNo;
    @NotNull(message = "用户ID不能为空")
    private Long userId;
    @NotNull(message = "金额不能为空")
    @DecimalMin(value = "0.01", message = "金额必须大于0")
    private BigDecimal amount;
    @NotNull(message = "支付渠道不能为空")
    private PaymentChannel channel;
}
