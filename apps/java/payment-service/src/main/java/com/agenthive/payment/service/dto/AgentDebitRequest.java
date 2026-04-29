package com.agenthive.payment.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AgentDebitRequest {

    @NotNull
    private Long userId;

    @NotBlank
    private String taskId;

    private String sessionId;

    @NotBlank
    private String workerRole;

    private BigDecimal tokensUsed;
}
