package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ApplyWithdrawalRequest {

    @NotNull
    private Long userId;

    @NotNull
    @DecimalMin("0.0001")
    private BigDecimal amount;

    @NotBlank
    private String channel;

    @NotBlank
    private String accountInfo;
}
